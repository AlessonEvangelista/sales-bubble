-- BV-107 (EN-027) — contexto bubble: bolhas, degraus e cotas.
-- Fonte: modelo-dados.md §3.2 e §4.1, ADR-0002 (concorrência de cota), ADR-0004, ADR-0006, ADR-0011.
-- Classificação: expand (tabelas novas).
--
-- Divergência consciente do DDL dos docs: `duration interval` virou `duration_minutes integer`
-- porque o Prisma não suporta o tipo interval (a coluna ficaria Unsupported e o client não
-- conseguiria criar bolhas). As regras são as mesmas: 1 h a 5 dias; compra até 4 dias.
-- FKs que dependem de contextos futuros entram com eles: bubbles.selected_bid_id → bids
-- (bidding) e quotas.payment_id → payments (payment), como no próprio DDL (§3.3/§3.4).
-- squawk-ignore-file require-concurrent-index-creation
-- (índices criados junto com a tabela, ainda vazia, na mesma transação)
SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- CreateTable
CREATE TABLE "bubbles" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "creator_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image_url" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "initial_price" BIGINT NOT NULL,
    "target_price" BIGINT NOT NULL,
    "final_unit_price" BIGINT,
    "min_quotas" INTEGER NOT NULL,
    "max_quotas" INTEGER NOT NULL,
    "filled_quotas" INTEGER NOT NULL DEFAULT 0,
    "reserved_quotas" INTEGER NOT NULL DEFAULT 0,
    "max_pj_share" SMALLINT NOT NULL DEFAULT 50,
    "shipping_days" SMALLINT NOT NULL DEFAULT 7,
    "duration_minutes" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "exploded_at" TIMESTAMPTZ(6),
    "explode_reason" TEXT,
    "bid_selection_deadline" TIMESTAMPTZ(6),
    "selected_bid_id" UUID,
    "cancel_reason" TEXT,
    "closed_at" TIMESTAMPTZ(6),
    "canvas_x" DOUBLE PRECISION,
    "canvas_y" DOUBLE PRECISION,
    "on_canvas" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bubbles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bubbles_creator_id_fkey" FOREIGN KEY ("creator_id")
        REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "bubbles_type_ck" CHECK ("type" IN ('SALE', 'PURCHASE')),
    CONSTRAINT "bubbles_title_ck" CHECK (char_length("title") BETWEEN 5 AND 80),
    CONSTRAINT "bubbles_description_ck" CHECK (char_length("description") <= 2000),
    -- `image_urls` é NOT NULL no DDL dos docs; o Prisma gera listas sem NOT NULL, então o
    -- invariante fica num CHECK (equivalente e sem drift no `prisma migrate diff`).
    CONSTRAINT "bubbles_image_urls_ck" CHECK ("image_urls" IS NOT NULL AND cardinality("image_urls") <= 5),
    CONSTRAINT "bubbles_status_ck" CHECK ("status" IN
        ('DRAFT', 'ACTIVE', 'EXPIRED_SUCCESS', 'EXPIRED_FAILED', 'IN_TRIAGE', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT "bubbles_currency_ck" CHECK ("currency" = 'BRL'),
    -- Dinheiro em centavos; preço mínimo por cota R$ 1,00 (Spec F3)
    CONSTRAINT "bubbles_initial_price_ck" CHECK ("initial_price" >= 100),
    CONSTRAINT "bubbles_target_price_ck" CHECK ("target_price" >= 100),
    CONSTRAINT "bubbles_final_price_ck" CHECK ("final_unit_price" >= 100),
    CONSTRAINT "bubbles_min_quotas_ck" CHECK ("min_quotas" >= 1),
    CONSTRAINT "bubbles_max_quotas_ck" CHECK ("max_quotas" BETWEEN 2 AND 10000),
    CONSTRAINT "bubbles_max_pj_share_ck" CHECK ("max_pj_share" BETWEEN 10 AND 100),
    CONSTRAINT "bubbles_shipping_days_ck" CHECK ("shipping_days" BETWEEN 1 AND 30),
    CONSTRAINT "bubbles_explode_reason_ck" CHECK ("explode_reason" IN ('TIME', 'FULL')),
    CONSTRAINT "bubbles_cancel_reason_ck" CHECK ("cancel_reason" IN ('CREATOR_DISCARDED', 'CREATOR_CANCELLED',
        'MODERATION', 'GOAL_NOT_MET', 'NO_VALID_BID', 'TRIAGE_ALL_CANCELLED')),
    CONSTRAINT "bubbles_version_ck" CHECK ("version" >= 0),

    -- Invariantes de contagem: o CHECK é a última linha de defesa contra overbooking (ADR-0002).
    -- A guarda principal é o UPDATE condicional `filled_quotas + reserved_quotas + :n <= max_quotas`.
    CONSTRAINT "bubbles_quotas_ck" CHECK ("min_quotas" <= "max_quotas"),
    CONSTRAINT "bubbles_filled_ck" CHECK ("filled_quotas" BETWEEN 0 AND "max_quotas"),
    CONSTRAINT "bubbles_reserved_ck" CHECK ("reserved_quotas" >= 0
        AND "filled_quotas" + "reserved_quotas" <= "max_quotas"),
    CONSTRAINT "bubbles_reserved_state_ck" CHECK ("reserved_quotas" = 0 OR "status" = 'ACTIVE'),
    CONSTRAINT "bubbles_price_order_ck" CHECK ("target_price" <= "initial_price"),
    -- PURCHASE: o participante autoriza até target_price; não há curva de degraus
    CONSTRAINT "bubbles_purchase_price_ck" CHECK ("type" = 'SALE' OR "initial_price" = "target_price"),
    -- Duração: 1 h a 5 dias (Spec F3)
    CONSTRAINT "bubbles_duration_ck" CHECK ("duration_minutes" BETWEEN 60 AND 7200),
    -- Compra: máx. 4 dias, para que duração + 24 h de seleção de lance <= 5 dias de pré-autorização (R5)
    CONSTRAINT "bubbles_purchase_duration_ck" CHECK ("type" = 'SALE' OR "duration_minutes" <= 5760),
    CONSTRAINT "bubbles_window_ck" CHECK (
        ("starts_at" IS NULL AND "expires_at" IS NULL AND "status" IN ('DRAFT', 'CANCELLED'))
        OR ("starts_at" IS NOT NULL
            AND "expires_at" = "starts_at" + make_interval(mins => "duration_minutes"))),
    CONSTRAINT "bubbles_canvas_ck" CHECK ("starts_at" IS NULL
        OR ("canvas_x" IS NOT NULL AND "canvas_y" IS NOT NULL)),
    CONSTRAINT "bubbles_exploded_ck" CHECK (
        ("status" IN ('EXPIRED_SUCCESS', 'EXPIRED_FAILED', 'IN_TRIAGE', 'COMPLETED')
            AND "exploded_at" IS NOT NULL AND "explode_reason" IS NOT NULL)
        OR "status" IN ('DRAFT', 'ACTIVE', 'CANCELLED')),
    -- Explosão por lotação só com todas as vagas pagas (Spec F5, D8)
    CONSTRAINT "bubbles_full_ck" CHECK ("explode_reason" IS DISTINCT FROM 'FULL'
        OR "filled_quotas" = "max_quotas"),
    CONSTRAINT "bubbles_selected_bid_ck" CHECK ("selected_bid_id" IS NULL OR "type" = 'PURCHASE')
);

-- CreateIndex
CREATE INDEX "bubbles_creator_ix" ON "bubbles"("creator_id", "created_at" DESC);
-- Índices parciais / de expressão (não modelados no Prisma) — modelo-dados §4.2 e §4.3
-- Canvas por bbox: só bolhas visíveis (ACTIVE + encerradas há < 24 h)
CREATE INDEX "bubbles_canvas_gist_ix" ON "bubbles" USING gist (point("canvas_x", "canvas_y")) WHERE "on_canvas";
-- Linha de base B-tree do benchmark do canvas
CREATE INDEX "bubbles_canvas_btree_ix" ON "bubbles"("canvas_x", "canvas_y") WHERE "on_canvas";
-- Reconciliador (ADR-0011): ativas vencidas
CREATE INDEX "bubbles_active_expires_ix" ON "bubbles"("expires_at") WHERE "status" = 'ACTIVE';
-- Seleção de lance pendente (PURCHASE)
CREATE INDEX "bubbles_bid_window_ix" ON "bubbles"("bid_selection_deadline")
    WHERE "status" = 'EXPIRED_SUCCESS' AND "type" = 'PURCHASE' AND "selected_bid_id" IS NULL;
-- Job que tira do canvas as encerradas há mais de 24 h
CREATE INDEX "bubbles_canvas_cleanup_ix" ON "bubbles"((coalesce("exploded_at", "closed_at")))
    WHERE "on_canvas" AND "status" <> 'ACTIVE';

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" UUID NOT NULL,
    "bubble_id" UUID NOT NULL,
    "min_filled_quotas" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "price_tiers_bubble_id_fkey" FOREIGN KEY ("bubble_id")
        REFERENCES "bubbles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "price_tiers_min_filled_ck" CHECK ("min_filled_quotas" >= 0),
    CONSTRAINT "price_tiers_unit_price_ck" CHECK ("unit_price" >= 100)
);
-- Regras de várias linhas (degrau 0 = initial_price, último = target_price, limites crescentes,
-- preços não crescentes, 1 a 10 degraus) são validadas no domínio (PriceCurve, ADR-0004).

-- CreateIndex
CREATE UNIQUE INDEX "price_tiers_uk" ON "price_tiers"("bubble_id", "min_filled_quotas");

-- CreateTable
CREATE TABLE "quotas" (
    "id" UUID NOT NULL,
    "bubble_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "account_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "is_creator_quota" BOOLEAN NOT NULL DEFAULT false,
    "payment_id" UUID NOT NULL,
    "reserved_until" TIMESTAMPTZ(6),
    "acquired_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quotas_bubble_id_fkey" FOREIGN KEY ("bubble_id")
        REFERENCES "bubbles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "quotas_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "quotas_account_type_ck" CHECK ("account_type" IN ('PF', 'PJ')),
    CONSTRAINT "quotas_quantity_ck" CHECK ("quantity" > 0),
    CONSTRAINT "quotas_status_ck" CHECK ("status" IN ('RESERVED', 'ACTIVE', 'RELEASED', 'CANCELLED')),
    CONSTRAINT "quotas_cancel_reason_ck" CHECK ("cancel_reason" IN ('RESERVATION_EXPIRED',
        'BUBBLE_EXPLODED_UNPAID', 'BUBBLE_CANCELLED', 'GOAL_NOT_MET', 'ACCOUNT_SUSPENDED')),
    -- PF: sempre 1 cota (Spec F5); o teto da PJ (ADR-0006) é checado sob advisory lock no caso de uso
    CONSTRAINT "quotas_pf_single_ck" CHECK ("account_type" = 'PJ' OR "quantity" = 1),
    CONSTRAINT "quotas_creator_single_ck" CHECK (NOT "is_creator_quota" OR "quantity" = 1),
    CONSTRAINT "quotas_reserved_ck" CHECK ("status" <> 'RESERVED'
        OR ("reserved_until" IS NOT NULL AND "acquired_at" IS NULL)),
    CONSTRAINT "quotas_active_ck" CHECK ("status" <> 'ACTIVE' OR "acquired_at" IS NOT NULL),
    CONSTRAINT "quotas_released_ck" CHECK (("status" = 'RELEASED') = ("released_at" IS NOT NULL)),
    CONSTRAINT "quotas_cancelled_ck" CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "quotas_payment_uk" ON "quotas"("payment_id");
CREATE INDEX "quotas_account_ix" ON "quotas"("account_id", "created_at" DESC);
-- ADR-0002: PF no máximo 1 cota (reservada ou ativa) por bolha, garantido pelo banco, inclusive
-- sob concorrência. RESERVED entra no predicado por causa da reserva Pix (Spec v1.1 F5).
CREATE UNIQUE INDEX "quotas_pf_one_per_bubble_uk" ON "quotas"("bubble_id", "account_id")
    WHERE "account_type" = 'PF' AND "status" IN ('RESERVED', 'ACTIVE');
-- Cotas vivas por bolha (soma do teto PJ e listagem de participantes)
CREATE INDEX "quotas_bubble_live_ix" ON "quotas"("bubble_id") INCLUDE ("account_id", "quantity")
    WHERE "status" IN ('RESERVED', 'ACTIVE');
-- Reservas Pix vencidas (job quota-reservation-expire e reconciliador)
CREATE INDEX "quotas_reserved_expiry_ix" ON "quotas"("reserved_until") WHERE "status" = 'RESERVED';
-- Anti-abuso de Pix: reservas abertas (máx. 3) e expiradas nas últimas 24 h
CREATE INDEX "quotas_account_reserved_ix" ON "quotas"("account_id") WHERE "status" = 'RESERVED';
CREATE INDEX "quotas_account_expired_ix" ON "quotas"("account_id", "cancelled_at")
    WHERE "cancel_reason" = 'RESERVATION_EXPIRED';
