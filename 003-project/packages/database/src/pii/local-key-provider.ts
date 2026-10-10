import { assertAesKey, openAesGcm, packSealed, sealAesGcm, unpackSealed } from './aes-gcm.js';
import { assertKekId } from './envelope.js';
import { PiiCryptoError } from './errors.js';
import { HmacKeyring, type HmacKeyMaterial } from './hmac-keyring.js';
import type { KeyProvider, WrappedDataKeyParts } from './key-provider.js';

export interface LocalKek {
  readonly id: string;
  readonly key: Buffer;
}

export interface LocalKeyProviderOptions {
  /** KEK ativa (cifra DEKs novas). */
  readonly activeKek: LocalKek;
  /** KEKs aposentadas: só decifram DEKs antigas até o *rewrap* (rotação). */
  readonly previousKeks?: readonly LocalKek[];
  readonly activeHmacKey: HmacKeyMaterial;
  /** *Peppers* anteriores, mantidos durante o recálculo em lote dos hashes. */
  readonly previousHmacKeys?: readonly HmacKeyMaterial[];
  /** `local` (dev/CI) ou `secret-manager` (material entregue pelo secret manager em runtime). */
  readonly kind?: 'local' | 'secret-manager';
}

/**
 * Adapter local da porta `KeyProvider`: a KEK é uma chave AES-256 em memória e o *wrap* da DEK é
 * AES-256-GCM com AAD = `bv:pii:dek|<kekId>|<contexto>`.
 *
 * Uso: dev/CI (`PII_KMS_PROVIDER=local`, chaves de `npm run keys:dev`) — c4.md §7: "chave local de
 * dev, nunca usada fora do dev". Em staging/produção a KEK fica no KMS (`CloudKmsKeyProvider`).
 *
 * As chaves ficam em campos privados (`#`): não aparecem em `JSON.stringify` nem em `util.inspect`.
 */
export class LocalKeyProvider implements KeyProvider {
  readonly kind: 'local' | 'secret-manager';
  readonly activeKekId: string;
  readonly #keks = new Map<string, Buffer>();
  readonly #hmac: HmacKeyring;

  constructor(options: LocalKeyProviderOptions) {
    this.kind = options.kind ?? 'local';
    for (const kek of [options.activeKek, ...(options.previousKeks ?? [])]) {
      assertKekId(kek.id);
      assertAesKey(kek.key, `KEK "${kek.id}"`);
      if (this.#keks.has(kek.id)) {
        throw new PiiCryptoError('INVALID_CONFIG', `KEK "${kek.id}" duplicada.`);
      }
      this.#keks.set(kek.id, Buffer.from(kek.key));
    }
    this.activeKekId = options.activeKek.id;
    this.#hmac = new HmacKeyring(options.activeHmacKey, options.previousHmacKeys);
  }

  get activeHmacVersion(): number {
    return this.#hmac.activeVersion;
  }

  async wrapDataKey(dek: Buffer, context: Buffer): Promise<WrappedDataKeyParts> {
    assertAesKey(dek, 'DEK');
    const kek = this.#kek(this.activeKekId);
    const sealed = sealAesGcm(kek, dek, wrapAad(this.activeKekId, context));
    return { kekId: this.activeKekId, wrapped: packSealed(sealed) };
  }

  async unwrapDataKey(parts: WrappedDataKeyParts, context: Buffer): Promise<Buffer> {
    const kek = this.#kek(parts.kekId);
    const dek = openAesGcm(kek, unpackSealed(parts.wrapped), wrapAad(parts.kekId, context));
    assertAesKey(dek, 'DEK');
    return dek;
  }

  hmacVersions(): readonly number[] {
    return this.#hmac.versions();
  }

  async hmacKey(version: number): Promise<Buffer> {
    return this.#hmac.key(version);
  }

  toJSON(): Record<string, unknown> {
    return {
      kind: this.kind,
      activeKekId: this.activeKekId,
      activeHmacVersion: this.activeHmacVersion,
    };
  }

  #kek(id: string): Buffer {
    const kek = this.#keks.get(id);
    if (!kek) {
      throw new PiiCryptoError('UNKNOWN_KEY', `KEK "${id}" não configurada.`);
    }
    return kek;
  }
}

function wrapAad(kekId: string, context: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`bv:pii:dek|${kekId}|`, 'utf8'), context]);
}
