import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openAesGcm, sealAesGcm } from './aes-gcm.js';
import { PiiCryptoError } from './errors.js';

const zeros = (n: number) => Buffer.alloc(n);
const hex = (s: string) => Buffer.from(s, 'hex');

describe('AES-256-GCM — vetores conhecidos (NIST, especificação do GCM)', () => {
  it('caso 13: K=0²⁵⁶, IV=0⁹⁶, P vazio', () => {
    const sealed = sealAesGcm(zeros(32), Buffer.alloc(0), Buffer.alloc(0), zeros(12));
    expect(sealed.ciphertext.length).toBe(0);
    expect(sealed.tag.toString('hex')).toBe('530f8afbc74536b9a963b4f1c4cb738b');
  });

  it('caso 14: K=0²⁵⁶, IV=0⁹⁶, P=0¹²⁸', () => {
    const sealed = sealAesGcm(zeros(32), zeros(16), Buffer.alloc(0), zeros(12));
    expect(sealed.ciphertext.toString('hex')).toBe('cea7403d4d606b6e074ec5d3baf39d18');
    expect(sealed.tag.toString('hex')).toBe('d0d1c8a799996bf0265b98b5d48ab919');
    expect(openAesGcm(zeros(32), sealed, Buffer.alloc(0))).toEqual(zeros(16));
  });

  it('tag adulterada falha com DECRYPT_FAILED', () => {
    const sealed = sealAesGcm(zeros(32), zeros(16), Buffer.alloc(0), zeros(12));
    const tag = Buffer.from(sealed.tag);
    tag[0] = (tag[0] ?? 0) ^ 1;
    expect(() => openAesGcm(zeros(32), { ...sealed, tag }, Buffer.alloc(0))).toThrow(
      expect.objectContaining({ code: 'DECRYPT_FAILED' }) as PiiCryptoError,
    );
  });

  it('recusa chave com tamanho diferente de 32 bytes', () => {
    expect(() => sealAesGcm(zeros(16), zeros(1), Buffer.alloc(0))).toThrow(PiiCryptoError);
  });
});

describe('HMAC-SHA256 — vetor conhecido (RFC 4231, caso 2)', () => {
  it('confere o primitivo usado pelo índice de busca', () => {
    const mac = createHmac('sha256', 'Jefe').update('what do ya want for nothing?').digest('hex');
    expect(mac).toBe(
      hex('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843').toString('hex'),
    );
  });
});
