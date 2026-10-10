/**
 * Segredos que a API resolve pelo loader (`secrets.ts`) antes de validar o ambiente.
 * Inventário e rotação: 002-llm/002 Docs/08-seguranca-compliance/gestao-segredos.md §2.
 * Ao passar a consumir um segredo novo, acrescente-o aqui E no inventário.
 */
export const API_SECRET_NAMES = [
  'DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'REDIS_URL',
  'PII_DATA_KEY_BASE64',
  'PII_HMAC_KEY_BASE64',
  'PAGARME_SECRET_KEY',
  'PAGARME_WEBHOOK_SECRET',
  'OAUTH_GOOGLE_CLIENT_SECRET',
  'CAPTCHA_SECRET',
  'SENTRY_DSN',
] as const;
