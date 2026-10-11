import { createHash, randomBytes } from 'node:crypto';
import { AES_KEY_BYTES, openAesGcm, packSealed, sealAesGcm, unpackSealed } from './aes-gcm.js';
import {
  FIELD_FORMAT_V1,
  decodeWrappedDataKey,
  encodeWrappedDataKey,
  fieldAad,
  type PiiAad,
} from './envelope.js';
import { PiiCryptoError } from './errors.js';
import type { KeyProvider } from './key-provider.js';

/** Referência à DEK de um titular: id do dono (conta) + DEK cifrada guardada no banco. */
export interface DataKeyRef {
  /** Dono da DEK (id da conta). Vai no contexto do *wrap*: a DEK não pode trocar de dono. */
  readonly subjectId: string;
  /** Blob `bytea` com a DEK cifrada (formato em `envelope.ts`). */
  readonly wrappedDek: Uint8Array;
}

/**
 * Porta `PiiCipherPort` (ADR-0012, c4 §4.1 — módulo identity). Cifragem em coluna com *envelope
 * encryption*: uma DEK AES-256 por conta, cifrada pela KEK do KMS.
 */
export interface PiiCipherPort {
  /** Gera a DEK de um titular novo e devolve-a cifrada (guardar na linha da conta). */
  createDataKey(subjectId: string): Promise<Buffer>;
  encrypt(plaintext: string, key: DataKeyRef, aad: PiiAad): Promise<Buffer>;
  decrypt(ciphertext: Uint8Array, key: DataKeyRef, aad: PiiAad): Promise<string>;
  /** Rotação da KEK: recifra a DEK com a KEK ativa, sem recifrar os dados. */
  rewrapDataKey(key: DataKeyRef): Promise<Buffer>;
  /** `true` se a DEK foi cifrada por uma KEK que não é a ativa (candidata a *rewrap*). */
  needsRewrap(wrappedDek: Uint8Array): boolean;
  /** *Crypto-shredding*: tira a DEK do cache (o chamador apaga o blob no banco). */
  forgetDataKey(key: DataKeyRef): void;
}

export interface KmsEnvelopeCipherOptions {
  /** TTL do cache de DEK decifrada (ADR-0012: até 5 min). Padrão: 5 min. 0 desliga o cache. */
  readonly cacheTtlMs?: number;
  /** Limite de DEKs em cache. Padrão: 10 000. */
  readonly cacheMaxEntries?: number;
  /** Relógio injetável (testes). */
  readonly now?: () => number;
}

const MAX_TTL_MS = 5 * 60_000;
const MAX_PLAINTEXT_BYTES = 64 * 1024;

interface CacheEntry {
  readonly dek: Buffer;
  readonly expiresAt: number;
}

/**
 * Adapter `KmsEnvelopeCipher` — único ponto que decifra PII (ADR-0012 item 3).
 *
 * Campo cifrado: `0x01‖nonce‖ciphertext‖tag` com AAD `tabela:coluna:id` (envelope.ts).
 * Não registra nada em log: nenhum método recebe logger, e os erros só têm códigos genéricos.
 */
export class KmsEnvelopeCipher implements PiiCipherPort {
  readonly #provider: KeyProvider;
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #cache = new Map<string, CacheEntry>();

  constructor(provider: KeyProvider, options: KmsEnvelopeCipherOptions = {}) {
    const ttl = options.cacheTtlMs ?? MAX_TTL_MS;
    if (ttl < 0 || ttl > MAX_TTL_MS) {
      throw new PiiCryptoError('INVALID_CONFIG', 'TTL do cache de DEK deve ficar entre 0 e 5 min.');
    }
    this.#provider = provider;
    this.#ttlMs = ttl;
    this.#maxEntries = options.cacheMaxEntries ?? 10_000;
    this.#now = options.now ?? Date.now;
  }

  async createDataKey(subjectId: string): Promise<Buffer> {
    const dek = randomBytes(AES_KEY_BYTES);
    try {
      const parts = await this.#provider.wrapDataKey(dek, subjectContext(subjectId));
      const blob = encodeWrappedDataKey(parts.kekId, parts.wrapped);
      this.#remember(blob, subjectId, dek);
      return blob;
    } finally {
      // O cache guarda a sua própria cópia; esta é zerada.
      dek.fill(0);
    }
  }

  async encrypt(plaintext: string, key: DataKeyRef, aad: PiiAad): Promise<Buffer> {
    const data = Buffer.from(plaintext, 'utf8');
    if (data.length === 0 || data.length > MAX_PLAINTEXT_BYTES) {
      throw new PiiCryptoError('INVALID_INPUT', 'Valor a cifrar vazio ou grande demais.');
    }
    const dek = await this.#dataKey(key);
    try {
      const sealed = sealAesGcm(dek, data, fieldAad(FIELD_FORMAT_V1, aad));
      return Buffer.concat([Buffer.of(FIELD_FORMAT_V1), packSealed(sealed)]);
    } finally {
      dek.fill(0);
      data.fill(0);
    }
  }

  async decrypt(ciphertext: Uint8Array, key: DataKeyRef, aad: PiiAad): Promise<string> {
    const buf = Buffer.from(ciphertext);
    const version = buf[0];
    if (version === undefined) {
      throw new PiiCryptoError('INVALID_FORMAT', 'Campo cifrado vazio.');
    }
    if (version !== FIELD_FORMAT_V1) {
      throw new PiiCryptoError('UNSUPPORTED_VERSION', 'Versão de formato do campo não suportada.');
    }
    const dek = await this.#dataKey(key);
    try {
      const plain = openAesGcm(dek, unpackSealed(buf.subarray(1)), fieldAad(version, aad));
      const text = plain.toString('utf8');
      plain.fill(0);
      return text;
    } finally {
      dek.fill(0);
    }
  }

  async rewrapDataKey(key: DataKeyRef): Promise<Buffer> {
    const dek = await this.#unwrap(key);
    try {
      const parts = await this.#provider.wrapDataKey(dek, subjectContext(key.subjectId));
      return encodeWrappedDataKey(parts.kekId, parts.wrapped);
    } finally {
      dek.fill(0);
    }
  }

  needsRewrap(wrappedDek: Uint8Array): boolean {
    return decodeWrappedDataKey(wrappedDek).kekId !== this.#provider.activeKekId;
  }

  forgetDataKey(key: DataKeyRef): void {
    this.#evict(cacheKey(key.wrappedDek, key.subjectId));
  }

  /** Zera e esvazia o cache (desligamento do processo, testes). */
  clearCache(): void {
    for (const id of [...this.#cache.keys()]) this.#evict(id);
  }

  toJSON(): Record<string, unknown> {
    return { adapter: 'KmsEnvelopeCipher', provider: this.#provider.kind };
  }

  /**
   * Devolve uma CÓPIA da DEK, que o chamador zera após o uso: o cache pode zerar a sua cópia
   * (expiração/limite) enquanto outra operação assíncrona ainda a usaria.
   */
  async #dataKey(key: DataKeyRef): Promise<Buffer> {
    const id = cacheKey(key.wrappedDek, key.subjectId);
    const hit = this.#cache.get(id);
    if (hit) {
      if (hit.expiresAt > this.#now()) return Buffer.from(hit.dek);
      this.#evict(id);
    }
    const dek = await this.#unwrap(key);
    this.#remember(key.wrappedDek, key.subjectId, dek);
    return dek;
  }

  async #unwrap(key: DataKeyRef): Promise<Buffer> {
    const parts = decodeWrappedDataKey(key.wrappedDek);
    return this.#provider.unwrapDataKey(parts, subjectContext(key.subjectId));
  }

  #remember(wrappedDek: Uint8Array, subjectId: string, dek: Buffer): void {
    if (this.#ttlMs === 0) return;
    if (this.#cache.size >= this.#maxEntries) {
      const oldest = this.#cache.keys().next();
      if (!oldest.done) this.#evict(oldest.value);
    }
    this.#cache.set(cacheKey(wrappedDek, subjectId), {
      dek: Buffer.from(dek),
      expiresAt: this.#now() + this.#ttlMs,
    });
  }

  #evict(id: string): void {
    const entry = this.#cache.get(id);
    if (entry) {
      entry.dek.fill(0);
      this.#cache.delete(id);
    }
  }
}

function subjectContext(subjectId: string): Buffer {
  if (subjectId.length === 0 || subjectId.length > 128) {
    throw new PiiCryptoError('INVALID_INPUT', 'Id do titular inválido.');
  }
  return Buffer.from(`account:${subjectId}`, 'utf8');
}

/** Chave do cache: hash do blob (já cifrado) + titular. Não contém material secreto. */
function cacheKey(wrappedDek: Uint8Array, subjectId: string): string {
  return createHash('sha256').update(wrappedDek).update('\0').update(subjectId).digest('base64');
}
