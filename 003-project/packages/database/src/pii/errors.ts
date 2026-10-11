/**
 * Erro único do módulo de criptografia de PII (ADR-0012).
 *
 * Regra: a mensagem NUNCA contém texto claro, chaves, ciphertext ou o valor normalizado.
 * Só um código estável e uma descrição genérica — o erro pode chegar ao log ou ao Sentry.
 */
export type PiiCryptoErrorCode =
  | 'INVALID_KEY'
  | 'INVALID_INPUT'
  | 'INVALID_FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN_KEY'
  | 'DECRYPT_FAILED'
  | 'KMS_UNAVAILABLE'
  | 'KMS_NOT_CONFIGURED'
  | 'INVALID_CONFIG';

export class PiiCryptoError extends Error {
  override readonly name = 'PiiCryptoError';

  constructor(
    readonly code: PiiCryptoErrorCode,
    message: string,
  ) {
    super(`[${code}] ${message}`);
  }
}
