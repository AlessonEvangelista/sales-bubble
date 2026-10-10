import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CloudKmsKeyProvider, type KmsClient } from './cloud-kms-key-provider.js';
import { decodeWrappedDataKey } from './envelope.js';
import { createPiiCryptoFromEnv } from './index.js';
import { LocalKeyProvider } from './local-key-provider.js';

const b64 = (n = 32) => randomBytes(n).toString('base64');

const devEnv = () => ({
  PII_KMS_PROVIDER: 'local',
  PII_DATA_KEY_BASE64: b64(),
  PII_DATA_KEY_ID: 'dev-key-1',
  PII_HMAC_KEY_BASE64: b64(),
});

describe('createPiiCryptoFromEnv — adapter local', () => {
  it('monta cipher e índice a partir das variáveis do .env.example', async () => {
    const pii = createPiiCryptoFromEnv(devEnv());
    expect(pii.keyProvider).toBeInstanceOf(LocalKeyProvider);
    const aad = { table: 'accounts', column: 'document_enc', rowId: 'acc-1' };
    const key = { subjectId: 'acc-1', wrappedDek: await pii.cipher.createDataKey('acc-1') };
    expect(decodeWrappedDataKey(key.wrappedDek).kekId).toBe('dev-key-1');
    const ct = await pii.cipher.encrypt('52998224725', key, aad);
    expect(await pii.cipher.decrypt(ct, key, aad)).toBe('52998224725');
    expect((await pii.blindIndex.hash('document', '529.982.247-25')).version).toBe(1);
  });

  it('aceita KEKs e peppers anteriores (rotação)', () => {
    const pii = createPiiCryptoFromEnv({
      ...devEnv(),
      PII_DATA_KEY_ID: 'dev-key-2',
      PII_DATA_KEYS_PREVIOUS: `dev-key-1:${b64()}`,
      PII_HMAC_KEY_VERSION: '2',
      PII_HMAC_KEYS_PREVIOUS: `1:${b64()}`,
    });
    expect(pii.keyProvider.activeKekId).toBe('dev-key-2');
    expect(pii.keyProvider.hmacVersions()).toEqual([2, 1]);
  });

  it.each([
    ['chave ausente', { PII_DATA_KEY_BASE64: '' }, /PII_DATA_KEY_BASE64 ausente/],
    ['base64 inválido', { PII_HMAC_KEY_BASE64: 'não-é-base64!' }, /não é base64/],
    ['KEK de 16 bytes', { PII_DATA_KEY_BASE64: b64(16) }, /INVALID_KEY/],
    ['pepper curto', { PII_HMAC_KEY_BASE64: b64(16) }, /INVALID_KEY/],
    ['versão inválida', { PII_HMAC_KEY_VERSION: '0' }, /versão/],
    ['lista anterior malformada', { PII_DATA_KEYS_PREVIOUS: 'sem-separador' }, /formato/],
  ])('falha rápido: %s (sem ecoar segredo)', (_name, override, message) => {
    const env = { ...devEnv(), ...override };
    let error: unknown;
    try {
      createPiiCryptoFromEnv(env);
    } catch (e) {
      error = e;
    }
    expect(String(error)).toMatch(message);
    expect(String(error)).not.toContain(env.PII_DATA_KEY_BASE64 || '\u0000');
    expect(String(error)).not.toContain(env.PII_HMAC_KEY_BASE64);
  });

  it('recusa PII_KMS_PROVIDER=local em produção', () => {
    expect(() => createPiiCryptoFromEnv({ ...devEnv(), NODE_ENV: 'production' })).toThrow(
      /só para dev\/CI/,
    );
  });
});

describe('createPiiCryptoFromEnv — KMS em nuvem (esqueleto, BV-104)', () => {
  it('sem cliente de KMS: KMS_NOT_CONFIGURED', () => {
    expect(() => createPiiCryptoFromEnv({ ...devEnv(), PII_KMS_PROVIDER: 'gcp-kms' })).toThrow(
      /KMS_NOT_CONFIGURED/,
    );
  });

  it('com cliente injetado: wrap/unwrap passam pelo KMS com o contexto como AAD', async () => {
    // KMS falso: "cifra" com XOR + guarda o AAD, só para exercitar o contrato.
    const kekByte = 0x5a;
    const client: KmsClient = {
      encrypt: vi.fn<KmsClient['encrypt']>(async ({ plaintext, aad }) =>
        Buffer.concat([Buffer.from([aad.length]), aad, plaintext.map((b) => b ^ kekByte)]),
      ),
      decrypt: vi.fn<KmsClient['decrypt']>(async ({ ciphertext, aad }) => {
        const len = ciphertext[0] ?? 0;
        if (!ciphertext.subarray(1, 1 + len).equals(aad)) throw new Error('aad mismatch: secret');
        return Buffer.from(ciphertext.subarray(1 + len).map((b) => b ^ kekByte));
      }),
    };
    const pii = createPiiCryptoFromEnv(
      {
        PII_KMS_PROVIDER: 'gcp-kms',
        PII_KMS_KEY_NAME: 'projects/p/locations/sa/keyRings/r/cryptoKeys/pii-kek',
        PII_HMAC_KEY_BASE64: b64(),
      },
      { kmsClient: client },
    );
    expect(pii.keyProvider).toBeInstanceOf(CloudKmsKeyProvider);
    const aad = { table: 'accounts', column: 'email_enc', rowId: 'acc-9' };
    const key = { subjectId: 'acc-9', wrappedDek: await pii.cipher.createDataKey('acc-9') };
    pii.cipher.clearCache();
    const ct = await pii.cipher.encrypt('x@y.com', key, aad);
    expect(await pii.cipher.decrypt(ct, key, aad)).toBe('x@y.com');
    expect(client.decrypt).toHaveBeenCalledTimes(1);

    // Erro do SDK vira KMS_UNAVAILABLE genérico (sem a mensagem original).
    pii.cipher.clearCache();
    const err = await pii.cipher
      .decrypt(ct, { subjectId: 'acc-other', wrappedDek: key.wrappedDek }, aad)
      .catch((e: unknown) => e);
    expect(String(err)).toMatch(/KMS_UNAVAILABLE/);
    expect(String(err)).not.toContain('secret');
  });

  it('timeout do KMS vira KMS_UNAVAILABLE', async () => {
    const hanging: KmsClient = {
      encrypt: ({ signal }) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
      decrypt: () => Promise.reject(new Error('n/a')),
    };
    const provider = new CloudKmsKeyProvider({
      client: hanging,
      activeKekName: 'pii-kek',
      activeHmacKey: { version: 1, key: randomBytes(32) },
      timeoutMs: 20,
    });
    await expect(provider.wrapDataKey(randomBytes(32), Buffer.from('ctx'))).rejects.toMatchObject({
      code: 'KMS_UNAVAILABLE',
    });
  });

  it('unwrap com KEK fora da allowlist é recusado sem chamar o KMS', async () => {
    const client: KmsClient = { encrypt: vi.fn(), decrypt: vi.fn() };
    const provider = new CloudKmsKeyProvider({
      client,
      activeKekName: 'pii-kek',
      activeHmacKey: { version: 1, key: randomBytes(32) },
    });
    await expect(
      provider.unwrapDataKey(
        { kekId: 'attacker-key', wrapped: Buffer.alloc(40) },
        Buffer.from('c'),
      ),
    ).rejects.toMatchObject({ code: 'UNKNOWN_KEY' });
    expect(client.decrypt).not.toHaveBeenCalled();
  });
});
