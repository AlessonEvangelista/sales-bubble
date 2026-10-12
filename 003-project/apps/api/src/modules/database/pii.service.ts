import { Inject, Injectable } from '@nestjs/common';
import type { DataKeyRef, PiiAad, PiiCrypto } from '@bolha/database/pii';
import { PII_CRYPTO } from './tokens.js';

/** Bytes com `ArrayBuffer` próprio — o tipo que o Prisma 7 aceita em colunas `Bytes`. */
export type Bytes = Uint8Array<ArrayBuffer>;

export interface BlindHash {
  readonly version: number;
  readonly hash: Bytes;
}

/**
 * Fachada do `@bolha/database/pii` (BV-109) para os módulos da API: cifra por envelope e
 * hash de busca (HMAC com pepper). Nenhum método registra ou devolve o texto claro em erro.
 */
@Injectable()
export class PiiService {
  constructor(@Inject(PII_CRYPTO) private readonly crypto: PiiCrypto) {}

  async createDataKey(subjectId: string): Promise<Bytes> {
    return toBytes(await this.crypto.cipher.createDataKey(subjectId));
  }

  async encrypt(plaintext: string, key: DataKeyRef, aad: PiiAad): Promise<Bytes> {
    return toBytes(await this.crypto.cipher.encrypt(plaintext, key, aad));
  }

  async decrypt(ciphertext: Uint8Array, key: DataKeyRef, aad: PiiAad): Promise<string> {
    return this.crypto.cipher.decrypt(ciphertext, key, aad);
  }

  async hashEmail(email: string): Promise<BlindHash> {
    return this.blindHash('email', email);
  }

  async hashDocument(document: string): Promise<BlindHash> {
    return this.blindHash('document', document);
  }

  async hashIp(ip: string): Promise<BlindHash> {
    return this.blindHash('ip', ip);
  }

  private async blindHash(kind: 'email' | 'document' | 'ip', value: string): Promise<BlindHash> {
    const { version, hash } = await this.crypto.blindIndex.hash(kind, value);
    return { version, hash: toBytes(hash) };
  }
}

function toBytes(buffer: Uint8Array): Bytes {
  return Uint8Array.from(buffer);
}
