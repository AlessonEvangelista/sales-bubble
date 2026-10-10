import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HmacBlindIndex, hashEquals, normalizeForHash } from './blind-index.js';
import { LocalKeyProvider } from './local-key-provider.js';

const kek = { id: 'dev-key-1', key: randomBytes(32) };
const v1 = { version: 1, key: randomBytes(32) };
const v2 = { version: 2, key: randomBytes(32) };

const index = (active = v1, previous: (typeof v1)[] = []) =>
  new HmacBlindIndex(
    new LocalKeyProvider({ activeKek: kek, activeHmacKey: active, previousHmacKeys: previous }),
  );

describe('normalizeForHash', () => {
  it('e-mail: lower(trim())', () => {
    expect(normalizeForHash('email', '  Maria.Silva@Example.COM \n')).toBe(
      'maria.silva@example.com',
    );
  });

  it('documento: só dígitos (CPF) / alfanumérico maiúsculo (CNPJ novo)', () => {
    expect(normalizeForHash('document', '529.982.247-25')).toBe('52998224725');
    expect(normalizeForHash('document', '11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizeForHash('document', '12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('documento inválido é recusado sem ecoar o valor', () => {
    expect(() => normalizeForHash('document', '529.982.247-2X!')).toThrow(/INVALID_INPUT/);
    try {
      normalizeForHash('document', '123');
    } catch (e) {
      expect(String(e)).not.toContain('123');
    }
  });

  it('oauth_subject preserva maiúsculas; valor vazio é recusado', () => {
    expect(normalizeForHash('oauth_subject', ' AbC123 ')).toBe('AbC123');
    expect(() => normalizeForHash('email', '   ')).toThrow(/INVALID_INPUT/);
  });
});

describe('HmacBlindIndex', () => {
  it('é determinístico e estável entre instâncias (mesma chave e versão)', async () => {
    const a = await index().hash('email', 'Maria.Silva@example.com');
    const b = await index().hash('email', '  maria.silva@EXAMPLE.com');
    expect(a.version).toBe(1);
    expect(a.hash.length).toBe(32);
    expect(hashEquals(a.hash, b.hash)).toBe(true);
  });

  it('segue o layout documentado: HMAC(chave, "bv:pii:<kind>:v1\\0" + normalizado)', async () => {
    const { hash } = await index().hash('document', '529.982.247-25');
    const expected = createHmac('sha256', v1.key)
      .update('bv:pii:document:v1\0')
      .update('52998224725')
      .digest();
    expect(hash.equals(expected)).toBe(true);
  });

  it('separa domínios: mesmo texto em tipos diferentes gera hashes diferentes', async () => {
    const idx = index();
    const a = await idx.hash('oauth_subject', '52998224725');
    const b = await idx.hash('document', '52998224725');
    expect(a.hash.equals(b.hash)).toBe(false);
  });

  it('não é SHA-256 puro: outra chave gera outro hash', async () => {
    const a = await index(v1).hash('email', 'a@b.com');
    const b = await index(v2).hash('email', 'a@b.com', 2);
    expect(a.hash.equals(b.hash)).toBe(false);
  });

  it('rotação do pepper: grava com v2 e ainda encontra registros com hash v1', async () => {
    const legacy = await index(v1).hash('email', 'a@b.com');
    const rotated = index(v2, [v1]);
    const fresh = await rotated.hash('email', 'a@b.com');
    expect(fresh.version).toBe(2);
    const candidates = await rotated.lookupCandidates('email', 'A@B.com');
    expect(candidates.map((c) => c.version)).toEqual([2, 1]);
    expect(candidates.some((c) => c.hash.equals(legacy.hash))).toBe(true);
    expect(candidates[0]?.hash.equals(fresh.hash)).toBe(true);
  });

  it('versão desconhecida falha com UNKNOWN_KEY', async () => {
    await expect(index().hash('email', 'a@b.com', 7)).rejects.toMatchObject({
      code: 'UNKNOWN_KEY',
    });
  });
});
