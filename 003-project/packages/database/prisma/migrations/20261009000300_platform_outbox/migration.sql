-- BV-107 (EN-027) — contexto platform: outbox transacional, eventos processados e Idempotency-Key.
-- Fonte: modelo-dados.md §3.7, ADR-0010 (outbox + pg_notify), guia de desenvolvimento §7.
-- Classificação: expand (tabelas novas).
-- squawk-ignore-file require-concurrent-index-creation
-- (índices criados junto com a tabela, ainda vazia, na mesma transação)
SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" SMALLINT NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "trace_parent" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_events_event_version_ck" CHECK ("event_version" >= 1),
    CONSTRAINT "outbox_events_attempts_ck" CHECK ("attempts" >= 0),
    CONSTRAINT "outbox_events_payload_ck" CHECK (jsonb_typeof("payload") = 'object')
);

-- CreateIndex
CREATE INDEX "outbox_aggregate_ix" ON "outbox_events"("aggregate_type", "aggregate_id", "id");
-- Índice parcial (não modelado no Prisma): fila do relay em ordem de id (UUID v7)
CREATE INDEX "outbox_unpublished_ix" ON "outbox_events"("id") WHERE "published_at" IS NULL;

-- Acorda o relay sem esperar o polling (ADR-0010). NOTIFY só é entregue no COMMIT: o relay
-- nunca vê evento de transação abortada.
CREATE FUNCTION "outbox_notify"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('outbox_new', NEW.id::text);
    RETURN NULL;
END $$;

CREATE TRIGGER "outbox_notify_trg" AFTER INSERT ON "outbox_events"
    FOR EACH ROW EXECUTE FUNCTION "outbox_notify"();

-- CreateTable
CREATE TABLE "processed_events" (
    "consumer" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("consumer", "event_id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "account_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "request_hash" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" SMALLINT,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '24:00:00'::interval),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("account_id", "key"),
    CONSTRAINT "idempotency_keys_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "idempotency_keys_key_ck" CHECK (char_length("key") BETWEEN 8 AND 128),
    CONSTRAINT "idempotency_keys_status_ck" CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT "idempotency_keys_completed_ck" CHECK ("status" <> 'COMPLETED' OR "response_status" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_ix" ON "idempotency_keys"("expires_at");
