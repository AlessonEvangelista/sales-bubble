/**
 * `@bolha/database/pii` — criptografia de PII em coluna (ADR-0012, BV-109 / EN-029 / SEC-04).
 *
 * - `KmsEnvelopeCipher` (porta `PiiCipherPort`): AES-256-GCM com DEK por conta (envelope).
 * - `HmacBlindIndex`: HMAC-SHA256 com *pepper* versionado para busca e unicidade.
 * - Porta `KeyProvider`: `LocalKeyProvider` (dev/CI) e `CloudKmsKeyProvider` (esqueleto, BV-104).
 *
 * Formatos de coluna e operação (rotação, *crypto-shredding*): ver `README.md` desta pasta.
 */
import { HmacBlindIndex } from './blind-index.js';
import { createKeyProviderFromEnv, type KeyProviderFactoryOptions, type PiiEnv } from './config.js';
import type { KeyProvider } from './key-provider.js';
import { KmsEnvelopeCipher, type KmsEnvelopeCipherOptions } from './kms-envelope-cipher.js';

export { PiiCryptoError, type PiiCryptoErrorCode } from './errors.js';
export type { KeyProvider, WrappedDataKeyParts } from './key-provider.js';
export {
  DATA_KEY_FORMAT_V1,
  FIELD_FORMAT_V1,
  decodeWrappedDataKey,
  fieldFormatVersion,
  type PiiAad,
} from './envelope.js';
export { HMAC_MIN_KEY_BYTES, type HmacKeyMaterial } from './hmac-keyring.js';
export {
  LocalKeyProvider,
  type LocalKek,
  type LocalKeyProviderOptions,
} from './local-key-provider.js';
export {
  CloudKmsKeyProvider,
  type CloudKmsKeyProviderOptions,
  type KmsClient,
} from './cloud-kms-key-provider.js';
export {
  KmsEnvelopeCipher,
  type DataKeyRef,
  type KmsEnvelopeCipherOptions,
  type PiiCipherPort,
} from './kms-envelope-cipher.js';
export {
  HmacBlindIndex,
  hashEquals,
  normalizeForHash,
  type BlindIndexValue,
  type PiiHashKind,
} from './blind-index.js';
export { createKeyProviderFromEnv, type KeyProviderFactoryOptions, type PiiEnv } from './config.js';

export interface PiiCrypto {
  readonly keyProvider: KeyProvider;
  readonly cipher: KmsEnvelopeCipher;
  readonly blindIndex: HmacBlindIndex;
}

/** Monta o módulo a partir das variáveis de ambiente (composição da api/worker). */
export function createPiiCryptoFromEnv(
  env: PiiEnv,
  options: KeyProviderFactoryOptions & KmsEnvelopeCipherOptions = {},
): PiiCrypto {
  const keyProvider = createKeyProviderFromEnv(env, options);
  return {
    keyProvider,
    cipher: new KmsEnvelopeCipher(keyProvider, options),
    blindIndex: new HmacBlindIndex(keyProvider),
  };
}
