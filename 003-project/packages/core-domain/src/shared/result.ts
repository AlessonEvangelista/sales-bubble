/**
 * Falhas de negócio esperadas são valores de retorno (guia §5.3): `Result<T, E>`.
 * Exceções ficam para violação de invariante (bug) e falhas de infraestrutura.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Erros de negócio do domínio (guia §5.3). O controller mapeia `code` para problem+json
 * (RFC 9457); o catálogo de `type` URIs vive em `@bolha/contracts` (BV-111).
 */
export type DomainError =
  | { code: 'BUBBLE_NOT_ACTIVE' }
  | { code: 'QUOTA_SOLD_OUT'; available: number }
  | { code: 'PF_QUOTA_LIMIT' }
  | { code: 'PJ_SHARE_EXCEEDED'; maxForAccount: number }
  | { code: 'CREATOR_CANNOT_JOIN' }
  | { code: 'ACCOUNT_NOT_VERIFIED' }
  | { code: 'PAYMENT_DECLINED'; reason: string }
  | { code: 'BID_ABOVE_TARGET' }
  | { code: 'CNPJ_INVALID' }
  | { code: 'CNPJ_NOT_ACTIVE' };

export type DomainErrorCode = DomainError['code'];
