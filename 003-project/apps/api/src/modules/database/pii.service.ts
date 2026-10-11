import { Injectable } from '@nestjs/common';
import {
  createPiiCryptoFromEnv,
  type PiiCrypto,
  type PiiAad,
  type DataKeyRef,
} from '@bolha/database/pii';

@Injectable()
export class PiiService {
  readonly #crypto: PiiCrypto;

  constructor() {
    this.#crypto = createPiiCryptoFromEnv(process.env);
  }

  get crypto(): PiiCrypto {
    return this.#crypto;
  }

  async createDataKey(subjectId: string): Promise<Buffer> {
    return this.#crypto.cipher.createDataKey(subjectId);
  }

  async encrypt(plaintext: string, key: DataKeyRef, aad: PiiAad): Promise<Buffer> {
    return this.#crypto.cipher.encrypt(plaintext, key, aad);
  }

  async decrypt(ciphertext: Uint8Array, key: DataKeyRef, aad: PiiAad): Promise<string> {
    return this.#crypto.cipher.decrypt(ciphertext, key, aad);
  }

  async hashEmail(email: string) {
    return this.#crypto.blindIndex.hash('email', email);
  }

  async hashDocument(document: string) {
    return this.#crypto.blindIndex.hash('document', document);
  }
}
