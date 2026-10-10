-- BV-107 (EN-027) — contexto identity. Fonte: modelo-dados.md §3.1 e §3.8, ADR-0012.
-- Classificação: expand (tabelas novas). Enumerações em text + CHECK (modelo-dados §1).
-- PII (envelope encryption): *_enc = AES-256-GCM com a DEK da conta (0x01‖nonce‖ciphertext‖tag);
-- pii_data_key = DEK cifrada pela KEK (o blob carrega o id da KEK; formato em @bolha/database/pii,
-- BV-109); *_hash = HMAC-SHA256 com pepper (busca/unicidade); pii_key_version = versão do pepper.
-- A coluna pii_data_key não está no DDL §3.1 dos docs, mas é exigida pelo ADR-0012/§3.8 ("DEK por
-- conta guardada junto").
-- squawk-ignore-file require-concurrent-index-creation
-- (índices criados junto com a tabela, ainda vazia, na mesma transação)
SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "account_type" TEXT NOT NULL,
    "pseudonym" TEXT NOT NULL,
    "email_enc" BYTEA NOT NULL,
    "email_hash" BYTEA NOT NULL,
    "document_enc" BYTEA NOT NULL,
    "document_hash" BYTEA NOT NULL,
    "name_enc" BYTEA NOT NULL,
    "phone_enc" BYTEA,
    "password_hash" TEXT,
    "oauth_provider" TEXT,
    "oauth_subject_hash" BYTEA,
    "pii_data_key" BYTEA NOT NULL,
    "pii_key_version" SMALLINT NOT NULL DEFAULT 1,
    "pix_blocked_until" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "role" TEXT NOT NULL DEFAULT 'USER',
    "score" SMALLINT NOT NULL DEFAULT 500,
    "score_model_version" TEXT NOT NULL DEFAULT 'v1',
    "score_updated_at" TIMESTAMPTZ(6),
    "gateway_recipient_id" TEXT,
    "gateway_recipient_status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accounts_account_type_ck" CHECK ("account_type" IN ('PF', 'PJ')),
    CONSTRAINT "accounts_oauth_provider_ck" CHECK ("oauth_provider" IN ('GOOGLE')),
    CONSTRAINT "accounts_status_ck" CHECK ("status" IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED')),
    CONSTRAINT "accounts_role_ck" CHECK ("role" IN ('USER', 'MODERATOR', 'ADMIN')),
    CONSTRAINT "accounts_score_ck" CHECK ("score" BETWEEN 0 AND 1000),
    CONSTRAINT "accounts_recipient_status_ck" CHECK ("gateway_recipient_status" IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT "accounts_pii_key_version_ck" CHECK ("pii_key_version" >= 1),
    -- Formato mínimo do envelope (ADR-0012): 1 B versão (0x01) + 12 B nonce + 16 B tag.
    -- DEK cifrada: 0x01 ‖ len(kekId) ‖ kekId ‖ DEK cifrada pela KEK (BV-109, pii/envelope.ts)
    CONSTRAINT "accounts_pii_data_key_ck" CHECK (
        octet_length("pii_data_key") >= 3 AND get_byte("pii_data_key", 0) = 1),
    CONSTRAINT "accounts_pii_enc_ck" CHECK (
        octet_length("email_enc") >= 29 AND get_byte("email_enc", 0) = 1
        AND octet_length("document_enc") >= 29 AND get_byte("document_enc", 0) = 1
        AND octet_length("name_enc") >= 29 AND get_byte("name_enc", 0) = 1
        AND ("phone_enc" IS NULL OR (octet_length("phone_enc") >= 29 AND get_byte("phone_enc", 0) = 1))),
    -- HMAC-SHA256 = 32 bytes.
    CONSTRAINT "accounts_pii_hash_ck" CHECK (
        octet_length("email_hash") = 32 AND octet_length("document_hash") = 32
        AND ("oauth_subject_hash" IS NULL OR octet_length("oauth_subject_hash") = 32)),
    CONSTRAINT "accounts_auth_ck" CHECK ("password_hash" IS NOT NULL OR "oauth_subject_hash" IS NOT NULL),
    CONSTRAINT "accounts_oauth_pair_ck" CHECK (("oauth_provider" IS NULL) = ("oauth_subject_hash" IS NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_pseudonym_uk" ON "accounts"("pseudonym");
CREATE UNIQUE INDEX "accounts_email_hash_uk" ON "accounts"("email_hash");
CREATE UNIQUE INDEX "accounts_document_hash_uk" ON "accounts"("document_hash");
-- Índice parcial (não modelado no Prisma)
CREATE UNIQUE INDEX "accounts_oauth_uk" ON "accounts"("oauth_provider", "oauth_subject_hash")
    WHERE "oauth_subject_hash" IS NOT NULL;

-- CreateTable
CREATE TABLE "company_profiles" (
    "account_id" UUID NOT NULL,
    "legal_name" TEXT,
    "trade_name" TEXT,
    "cnae_principal" TEXT,
    "cnpj_status" TEXT NOT NULL DEFAULT 'DESCONHECIDA',
    "cnpj_provider" TEXT,
    "cnpj_checked_at" TIMESTAMPTZ(6),
    "cnpj_next_check_at" TIMESTAMPTZ(6),
    "verification_attempts" SMALLINT NOT NULL DEFAULT 0,
    "verification_retry_until" TIMESTAMPTZ(6),
    "next_retry_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("account_id"),
    CONSTRAINT "company_profiles_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "company_profiles_cnpj_status_ck" CHECK (
        "cnpj_status" IN ('ATIVA', 'SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA', 'DESCONHECIDA')),
    CONSTRAINT "company_profiles_cnpj_provider_ck" CHECK ("cnpj_provider" IN ('BRASILAPI', 'RECEITAWS')),
    CONSTRAINT "company_profiles_attempts_ck" CHECK ("verification_attempts" >= 0),
    CONSTRAINT "company_profiles_verified_ck" CHECK ("cnpj_status" = 'DESCONHECIDA'
        OR ("cnpj_provider" IS NOT NULL AND "cnpj_checked_at" IS NOT NULL AND "cnpj_next_check_at" IS NOT NULL))
);

-- CreateIndex
CREATE INDEX "company_profiles_next_check_ix" ON "company_profiles"("cnpj_next_check_at");
-- Índice parcial (não modelado no Prisma): retentativa a cada 15 min por 24 h (Spec F1)
CREATE INDEX "company_profiles_retry_ix" ON "company_profiles"("next_retry_at")
    WHERE "cnpj_status" = 'DESCONHECIDA';

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "document_version" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_hash" BYTEA,
    "user_agent" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consents_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "consents_purpose_ck" CHECK ("purpose" IN ('TERMS_OF_USE', 'PRIVACY_POLICY', 'MARKETING_EMAIL')),
    CONSTRAINT "consents_revoked_ck" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "granted_at")
);

-- Índice parcial (não modelado no Prisma): um aceite vigente por finalidade
CREATE UNIQUE INDEX "consents_active_uk" ON "consents"("account_id", "purpose") WHERE "revoked_at" IS NULL;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "rotated_at" TIMESTAMPTZ(6),
    "replaced_by" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_hash" BYTEA,
    "user_agent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "refresh_tokens_replaced_by_fkey" FOREIGN KEY ("replaced_by")
        REFERENCES "refresh_tokens"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "refresh_tokens_expiry_ck" CHECK ("expires_at" > "issued_at")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_family_ix" ON "refresh_tokens"("family_id");
CREATE INDEX "refresh_tokens_expires_ix" ON "refresh_tokens"("expires_at");
