import { PiiCryptoError } from './errors.js';

export const HMAC_MIN_KEY_BYTES = 32;

export interface HmacKeyMaterial {
  readonly version: number;
  readonly key: Buffer;
}

/**
 * Chaveiro dos *peppers* do HMAC de busca (Secret Manager — threat-model §7). Versão ativa calcula
 * hashes novos; as anteriores ficam disponíveis para busca enquanto o job de recálculo roda.
 * Chaves em campo privado: não aparecem em `JSON.stringify`/`util.inspect`.
 */
export class HmacKeyring {
  readonly activeVersion: number;
  readonly #keys = new Map<number, Buffer>();

  constructor(active: HmacKeyMaterial, previous: readonly HmacKeyMaterial[] = []) {
    for (const hk of [active, ...previous]) {
      if (!Number.isInteger(hk.version) || hk.version < 1 || hk.version > 32_767) {
        // smallint no banco (`pii_key_version`).
        throw new PiiCryptoError('INVALID_CONFIG', 'Versão de HMAC deve ser inteiro 1..32767.');
      }
      if (hk.key.length < HMAC_MIN_KEY_BYTES) {
        throw new PiiCryptoError(
          'INVALID_KEY',
          `Chave de HMAC v${hk.version} deve ter ao menos ${HMAC_MIN_KEY_BYTES} bytes.`,
        );
      }
      if (this.#keys.has(hk.version)) {
        throw new PiiCryptoError('INVALID_CONFIG', `Chave de HMAC v${hk.version} duplicada.`);
      }
      this.#keys.set(hk.version, Buffer.from(hk.key));
    }
    this.activeVersion = active.version;
  }

  versions(): readonly number[] {
    return [this.activeVersion, ...[...this.#keys.keys()].filter((v) => v !== this.activeVersion)];
  }

  key(version: number): Buffer {
    const key = this.#keys.get(version);
    if (!key) {
      throw new PiiCryptoError('UNKNOWN_KEY', `Chave de HMAC v${version} não configurada.`);
    }
    return key;
  }

  toJSON(): Record<string, unknown> {
    return { activeVersion: this.activeVersion, versions: this.versions() };
  }
}
