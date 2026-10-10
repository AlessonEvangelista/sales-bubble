import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PiiCryptoError } from './errors.js';

/** AES-256-GCM (ADR-0012): chave de 256 bits, nonce de 96 bits aleatório, tag de 128 bits. */
export const AES_KEY_BYTES = 32;
export const GCM_NONCE_BYTES = 12;
export const GCM_TAG_BYTES = 16;

export interface GcmSealed {
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

export function assertAesKey(key: Uint8Array, label: string): void {
  if (key.length !== AES_KEY_BYTES) {
    // Só o tamanho esperado: nunca o conteúdo da chave.
    throw new PiiCryptoError('INVALID_KEY', `${label} deve ter ${AES_KEY_BYTES} bytes.`);
  }
}

/**
 * Cifra com AES-256-GCM. O nonce é sempre aleatório (`randomBytes`); o parâmetro `nonce` existe
 * só para os testes de vetor conhecido (NIST) e não é exportado pelo índice do módulo.
 */
export function sealAesGcm(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
  nonce: Uint8Array = randomBytes(GCM_NONCE_BYTES),
): GcmSealed {
  assertAesKey(key, 'Chave AES');
  if (nonce.length !== GCM_NONCE_BYTES) {
    throw new PiiCryptoError('INVALID_INPUT', `Nonce deve ter ${GCM_NONCE_BYTES} bytes.`);
  }
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_BYTES });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce: Buffer.from(nonce), ciphertext, tag: cipher.getAuthTag() };
}

/** Decifra e verifica a tag; qualquer adulteração (dados, nonce, tag, AAD ou chave) falha. */
export function openAesGcm(key: Uint8Array, sealed: GcmSealed, aad: Uint8Array): Buffer {
  assertAesKey(key, 'Chave AES');
  if (sealed.nonce.length !== GCM_NONCE_BYTES || sealed.tag.length !== GCM_TAG_BYTES) {
    throw new PiiCryptoError('INVALID_FORMAT', 'Nonce ou tag com tamanho inválido.');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, sealed.nonce, {
      authTagLength: GCM_TAG_BYTES,
    });
    decipher.setAAD(aad);
    decipher.setAuthTag(sealed.tag);
    return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
  } catch {
    // A causa original não é propagada: não traz nada útil e não deve ir para o log.
    throw new PiiCryptoError(
      'DECRYPT_FAILED',
      'Falha de autenticação ao decifrar (dado adulterado, chave ou contexto incorretos).',
    );
  }
}

/** `nonce‖ciphertext‖tag` — usado dentro dos envelopes. */
export function packSealed(sealed: GcmSealed): Buffer {
  return Buffer.concat([sealed.nonce, sealed.ciphertext, sealed.tag]);
}

export function unpackSealed(bytes: Uint8Array): GcmSealed {
  if (bytes.length < GCM_NONCE_BYTES + GCM_TAG_BYTES) {
    throw new PiiCryptoError('INVALID_FORMAT', 'Ciphertext curto demais.');
  }
  const buf = Buffer.from(bytes);
  return {
    nonce: buf.subarray(0, GCM_NONCE_BYTES),
    ciphertext: buf.subarray(GCM_NONCE_BYTES, buf.length - GCM_TAG_BYTES),
    tag: buf.subarray(buf.length - GCM_TAG_BYTES),
  };
}
