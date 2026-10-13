/**
 * Violação de invariante dentro do domínio (guia §5.3): é bug, vira 500 e alerta no Sentry.
 * Nunca use para falhas de negócio esperadas — essas são `Result` (ver `result.ts`).
 */
export class DomainInvariantViolation extends Error {
  override readonly name = 'DomainInvariantViolation';
}
