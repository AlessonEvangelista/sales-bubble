import { assertAesKey } from './aes-gcm.js';
import { assertKekId } from './envelope.js';
import { PiiCryptoError } from './errors.js';
import { HmacKeyring, type HmacKeyMaterial } from './hmac-keyring.js';
import type { KeyProvider, WrappedDataKeyParts } from './key-provider.js';

/**
 * Cliente mínimo de um KMS gerenciado (GCP Cloud KMS, AWS KMS, Azure Key Vault…).
 *
 * ESQUELETO: a nuvem ainda não foi escolhida (BV-104, HITL). Quando for, implementar este contrato
 * com o SDK oficial do provedor (ex.: `KeyManagementServiceClient.encrypt/decrypt` com
 * `additionalAuthenticatedData`, ou `EncryptCommand/DecryptCommand` com `EncryptionContext`) e
 * autenticação por identidade de serviço (sem chave estática). Nada aqui depende de SDK.
 */
export interface KmsClient {
  encrypt(request: {
    keyName: string;
    plaintext: Buffer;
    aad: Buffer;
    signal: AbortSignal;
  }): Promise<Buffer>;
  decrypt(request: {
    keyName: string;
    ciphertext: Buffer;
    aad: Buffer;
    signal: AbortSignal;
  }): Promise<Buffer>;
}

export interface CloudKmsKeyProviderOptions {
  readonly client: KmsClient;
  /** Nome/alias da KEK ativa no KMS (ex.: `projects/…/cryptoKeys/pii-kek`). */
  readonly activeKekName: string;
  /** KEKs antigas ainda aceitas no *unwrap* (allowlist; um id desconhecido é recusado). */
  readonly previousKekNames?: readonly string[];
  /** *Peppers* do HMAC, lidos do Secret Manager na inicialização. */
  readonly activeHmacKey: HmacKeyMaterial;
  readonly previousHmacKeys?: readonly HmacKeyMaterial[];
  /** Timeout por chamada ao KMS (ADR-0012: dependência do KMS com *timeouts*). Padrão: 2 s. */
  readonly timeoutMs?: number;
}

/** Adapter de KMS em nuvem da porta `KeyProvider` (a KEK nunca sai do KMS). */
export class CloudKmsKeyProvider implements KeyProvider {
  readonly kind = 'cloud-kms' as const;
  readonly activeKekId: string;
  readonly #client: KmsClient;
  readonly #allowedKeks: ReadonlySet<string>;
  readonly #hmac: HmacKeyring;
  readonly #timeoutMs: number;

  constructor(options: CloudKmsKeyProviderOptions) {
    const names = [options.activeKekName, ...(options.previousKekNames ?? [])];
    names.forEach(assertKekId);
    this.activeKekId = options.activeKekName;
    this.#allowedKeks = new Set(names);
    this.#client = options.client;
    this.#hmac = new HmacKeyring(options.activeHmacKey, options.previousHmacKeys);
    this.#timeoutMs = options.timeoutMs ?? 2_000;
  }

  get activeHmacVersion(): number {
    return this.#hmac.activeVersion;
  }

  async wrapDataKey(dek: Buffer, context: Buffer): Promise<WrappedDataKeyParts> {
    assertAesKey(dek, 'DEK');
    const wrapped = await this.#call((signal) =>
      this.#client.encrypt({ keyName: this.activeKekId, plaintext: dek, aad: context, signal }),
    );
    return { kekId: this.activeKekId, wrapped };
  }

  async unwrapDataKey(parts: WrappedDataKeyParts, context: Buffer): Promise<Buffer> {
    if (!this.#allowedKeks.has(parts.kekId)) {
      throw new PiiCryptoError('UNKNOWN_KEY', 'KEK da DEK não está na lista de chaves aceitas.');
    }
    const dek = await this.#call((signal) =>
      this.#client.decrypt({
        keyName: parts.kekId,
        ciphertext: parts.wrapped,
        aad: context,
        signal,
      }),
    );
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
    return { kind: this.kind, activeKekId: this.activeKekId };
  }

  async #call(fn: (signal: AbortSignal) => Promise<Buffer>): Promise<Buffer> {
    try {
      return await fn(AbortSignal.timeout(this.#timeoutMs));
    } catch (error) {
      if (error instanceof PiiCryptoError) throw error;
      // Não propaga a mensagem do SDK (pode ecoar parâmetros da requisição).
      throw new PiiCryptoError('KMS_UNAVAILABLE', 'Falha ou timeout na chamada ao KMS.');
    }
  }
}
