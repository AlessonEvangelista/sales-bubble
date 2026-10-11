import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { GCM_NONCE_BYTES } from './aes-gcm.js';
import { decodeWrappedDataKey, type PiiAad } from './envelope.js';
import type { KeyProvider } from './key-provider.js';
import { KmsEnvelopeCipher } from './kms-envelope-cipher.js';
import { LocalKeyProvider, type LocalKek } from './local-key-provider.js';

const kek1: LocalKek = { id: 'kek-2026', key: randomBytes(32) };
const kek2: LocalKek = { id: 'kek-2027', key: randomBytes(32) };
const hmacKey = { version: 1, key: randomBytes(32) };

function provider(active: LocalKek, previous: LocalKek[] = []) {
  return new LocalKeyProvider({
    activeKek: active,
    previousKeks: previous,
    activeHmacKey: hmacKey,
  });
}

const ACCOUNT = '0f8a6c2e-3b1d-4e57-9a10-5c2b7d9e4f11';
const OTHER_ACCOUNT = '7d1c0b9a-2e3f-4a5b-8c6d-0e1f2a3b4c5d';
const EMAIL_AAD: PiiAad = { table: 'accounts', column: 'email_enc', rowId: ACCOUNT };
const EMAIL = 'maria.silva@example.com';

async function setup(options: ConstructorParameters<typeof KmsEnvelopeCipher>[1] = {}) {
  const cipher = new KmsEnvelopeCipher(provider(kek1), options);
  const wrappedDek = await cipher.createDataKey(ACCOUNT);
  return { cipher, key: { subjectId: ACCOUNT, wrappedDek } };
}

describe('KmsEnvelopeCipher — round-trip e formato', () => {
  it('cifra e decifra (round-trip), inclusive Unicode', async () => {
    const { cipher, key } = await setup();
    for (const value of [EMAIL, 'José da Conceição Ñandú 🫧', 'Rua A, 1 — Apto 2']) {
      const ct = await cipher.encrypt(value, key, EMAIL_AAD);
      expect(await cipher.decrypt(ct, key, EMAIL_AAD)).toBe(value);
    }
  });

  it('formato v1: versão‖nonce(12)‖ciphertext‖tag(16), sem texto claro', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    expect(ct[0]).toBe(0x01);
    expect(ct.length).toBe(1 + GCM_NONCE_BYTES + Buffer.byteLength(EMAIL) + 16);
    expect(ct.includes(Buffer.from(EMAIL))).toBe(false);
  });

  it('IV único: o mesmo valor cifrado 1000 vezes gera nonces e ciphertexts distintos', async () => {
    const { cipher, key } = await setup();
    const nonces = new Set<string>();
    const cts = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
      nonces.add(ct.subarray(1, 1 + GCM_NONCE_BYTES).toString('hex'));
      cts.add(ct.toString('hex'));
    }
    expect(nonces.size).toBe(1000);
    expect(cts.size).toBe(1000);
  });
});

describe('KmsEnvelopeCipher — adulteração detectada (tag GCM / AAD)', () => {
  it('qualquer byte alterado (nonce, ciphertext ou tag) falha', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    for (const pos of [1, 1 + GCM_NONCE_BYTES, ct.length - 1]) {
      const tampered = Buffer.from(ct);
      tampered[pos] = (tampered[pos] ?? 0) ^ 0x01;
      await expect(cipher.decrypt(tampered, key, EMAIL_AAD)).rejects.toMatchObject({
        code: 'DECRYPT_FAILED',
      });
    }
  });

  it('ciphertext truncado e versão desconhecida são recusados', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    await expect(cipher.decrypt(ct.subarray(0, 10), key, EMAIL_AAD)).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    });
    const v9 = Buffer.from(ct);
    v9[0] = 9;
    await expect(cipher.decrypt(v9, key, EMAIL_AAD)).rejects.toMatchObject({
      code: 'UNSUPPORTED_VERSION',
    });
  });

  it('AAD amarra tabela:coluna:id — mover o ciphertext de linha ou coluna falha', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    for (const aad of [
      { ...EMAIL_AAD, rowId: OTHER_ACCOUNT },
      { ...EMAIL_AAD, column: 'name_enc' },
      { ...EMAIL_AAD, table: 'triage_items' },
    ]) {
      await expect(cipher.decrypt(ct, key, aad)).rejects.toMatchObject({ code: 'DECRYPT_FAILED' });
    }
  });

  it('a DEK é amarrada ao titular: DEK de outra conta não decifra', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    const otherDek = await cipher.createDataKey(OTHER_ACCOUNT);
    await expect(
      cipher.decrypt(ct, { subjectId: ACCOUNT, wrappedDek: otherDek }, EMAIL_AAD),
    ).rejects.toMatchObject({ code: 'DECRYPT_FAILED' });
    // A DEK de uma conta usada com o id de outra conta falha no unwrap (contexto do KMS).
    cipher.clearCache();
    await expect(
      cipher.decrypt(ct, { subjectId: OTHER_ACCOUNT, wrappedDek: key.wrappedDek }, EMAIL_AAD),
    ).rejects.toMatchObject({ code: 'DECRYPT_FAILED' });
  });

  it('crypto-shredding: sem a DEK (descartada) a leitura falha de forma controlada', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    cipher.forgetDataKey(key);
    const shredded = { subjectId: ACCOUNT, wrappedDek: Buffer.alloc(0) };
    await expect(cipher.decrypt(ct, shredded, EMAIL_AAD)).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    });
  });
});

describe('KmsEnvelopeCipher — rotação da KEK', () => {
  it('decifra dados cuja DEK foi cifrada pela KEK antiga e faz rewrap sem recifrar dados', async () => {
    const before = new KmsEnvelopeCipher(provider(kek1));
    const wrappedOld = await before.createDataKey(ACCOUNT);
    const ct = await before.encrypt(
      EMAIL,
      { subjectId: ACCOUNT, wrappedDek: wrappedOld },
      EMAIL_AAD,
    );
    expect(decodeWrappedDataKey(wrappedOld).kekId).toBe('kek-2026');

    // Novo processo: KEK ativa = 2027, a de 2026 só para unwrap.
    const after = new KmsEnvelopeCipher(provider(kek2, [kek1]));
    const oldRef = { subjectId: ACCOUNT, wrappedDek: wrappedOld };
    expect(await after.decrypt(ct, oldRef, EMAIL_AAD)).toBe(EMAIL);
    expect(after.needsRewrap(wrappedOld)).toBe(true);

    const wrappedNew = await after.rewrapDataKey(oldRef);
    expect(decodeWrappedDataKey(wrappedNew).kekId).toBe('kek-2027');
    expect(after.needsRewrap(wrappedNew)).toBe(false);

    // Depois do rewrap, a KEK antiga pode ser retirada: o mesmo ciphertext continua legível.
    const retired = new KmsEnvelopeCipher(provider(kek2));
    expect(
      await retired.decrypt(ct, { subjectId: ACCOUNT, wrappedDek: wrappedNew }, EMAIL_AAD),
    ).toBe(EMAIL);
    // ...e a DEK antiga (KEK retirada) não é mais aceita.
    await expect(retired.decrypt(ct, oldRef, EMAIL_AAD)).rejects.toMatchObject({
      code: 'UNKNOWN_KEY',
    });
  });
});

describe('KmsEnvelopeCipher — cache de DEK (ADR-0012: até 5 min)', () => {
  function countingProvider() {
    const inner = provider(kek1);
    const unwrap = vi.fn(inner.unwrapDataKey.bind(inner));
    const p: KeyProvider = {
      kind: inner.kind,
      activeKekId: inner.activeKekId,
      activeHmacVersion: inner.activeHmacVersion,
      wrapDataKey: inner.wrapDataKey.bind(inner),
      unwrapDataKey: unwrap,
      hmacVersions: inner.hmacVersions.bind(inner),
      hmacKey: inner.hmacKey.bind(inner),
    };
    return { p, unwrap };
  }

  it('reaproveita a DEK dentro do TTL e volta ao KMS depois', async () => {
    let now = 0;
    const { p, unwrap } = countingProvider();
    const cipher = new KmsEnvelopeCipher(p, { now: () => now });
    const wrappedDek = await cipher.createDataKey(ACCOUNT);
    cipher.clearCache();
    const key = { subjectId: ACCOUNT, wrappedDek };
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    await cipher.decrypt(ct, key, EMAIL_AAD);
    expect(unwrap).toHaveBeenCalledTimes(1);
    now = 5 * 60_000 + 1;
    expect(await cipher.decrypt(ct, key, EMAIL_AAD)).toBe(EMAIL);
    expect(unwrap).toHaveBeenCalledTimes(2);
  });

  it('operações concorrentes não usam DEK zerada por despejo do cache', async () => {
    const cipher = new KmsEnvelopeCipher(provider(kek1), { cacheMaxEntries: 1 });
    const a = { subjectId: ACCOUNT, wrappedDek: await cipher.createDataKey(ACCOUNT) };
    const b = { subjectId: OTHER_ACCOUNT, wrappedDek: await cipher.createDataKey(OTHER_ACCOUNT) };
    const aadB = { ...EMAIL_AAD, rowId: OTHER_ACCOUNT };
    const cts = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 2 === 0 ? cipher.encrypt(EMAIL, a, EMAIL_AAD) : cipher.encrypt(EMAIL, b, aadB),
      ),
    );
    cipher.clearCache();
    for (const [i, ct] of cts.entries()) {
      expect(await cipher.decrypt(ct, i % 2 === 0 ? a : b, i % 2 === 0 ? EMAIL_AAD : aadB)).toBe(
        EMAIL,
      );
    }
  });

  it('recusa TTL acima de 5 min', () => {
    expect(() => new KmsEnvelopeCipher(provider(kek1), { cacheTtlMs: 10 * 60_000 })).toThrow(
      /INVALID_CONFIG/,
    );
  });
});

describe('Sem vazamento de PII ou chaves', () => {
  it('erros não contêm o texto claro, e objetos não serializam chaves', async () => {
    const { cipher, key } = await setup();
    const ct = await cipher.encrypt(EMAIL, key, EMAIL_AAD);
    const err = await cipher
      .decrypt(ct, key, { ...EMAIL_AAD, rowId: OTHER_ACCOUNT })
      .catch((e: unknown) => e);
    expect(String(err)).not.toContain(EMAIL);
    expect(inspect(err)).not.toContain(EMAIL);

    const p = provider(kek1);
    const secrets = [kek1.key.toString('base64'), hmacKey.key.toString('base64')];
    for (const dump of [
      JSON.stringify(p),
      inspect(p, { depth: 10 }),
      JSON.stringify(cipher),
      inspect(cipher, { depth: 10 }),
    ]) {
      for (const secret of secrets) expect(dump).not.toContain(secret);
      expect(dump).not.toContain(kek1.key.toString('hex'));
    }
  });
});
