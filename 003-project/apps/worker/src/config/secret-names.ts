/**
 * Segredos que o worker resolve pelo loader (`secrets.ts`) antes de validar o ambiente.
 * Inventário e rotação: 002-llm/002 Docs/08-seguranca-compliance/gestao-segredos.md §2.
 * Ao passar a consumir um segredo novo, acrescente-o aqui E no inventário.
 */
export const WORKER_SECRET_NAMES = [
  'DATABASE_URL',
  'REDIS_URL',
  'PII_DATA_KEY_BASE64',
  'PII_HMAC_KEY_BASE64',
  'PAGARME_SECRET_KEY',
  'SENTRY_DSN',
] as const;
