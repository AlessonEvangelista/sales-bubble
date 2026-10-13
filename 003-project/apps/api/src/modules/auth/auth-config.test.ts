import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCaptchaVerifier } from './captcha.js';
import { InMemoryThrottleStore } from './login-throttle.js';
import { loadJwtKeys } from './token.service.js';

const env = {
  JWT_ACCESS_PRIVATE_KEY_PATH: './.secrets/jwt-access.pem',
  JWT_ACCESS_PUBLIC_KEY_PATH: './.secrets/jwt-access.pub',
  JWT_ACCESS_TTL_SECONDS: 900,
};

describe('chaves do access token (fail-closed)', () => {
  it('sem os arquivos a API não sobe — nunca gera par efêmero', () => {
    const empty = mkdtempSync(join(tmpdir(), 'bv-keys-'));
    expect(() => loadJwtKeys(env, empty)).toThrow(/JWT_ACCESS_PRIVATE_KEY_PATH.*keys:dev/);
  });

  it('acha as chaves pela raiz do monorepo quando roda de apps/api', () => {
    const root = mkdtempSync(join(tmpdir(), 'bv-root-'));
    const app = join(root, 'apps', 'api');
    const secrets = join(root, '.secrets');
    for (const dir of [app, secrets]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(secrets, 'jwt-access.pem'), 'PRIVATE');
    writeFileSync(join(secrets, 'jwt-access.pub'), 'PUBLIC');

    expect(loadJwtKeys(env, app)).toEqual({
      privateKey: 'PRIVATE',
      publicKey: 'PUBLIC',
      ttlSeconds: 900,
    });
  });
});

describe('CAPTCHA', () => {
  it('none: aceita token não vazio (dev/CI)', async () => {
    const verifier = createCaptchaVerifier({ CAPTCHA_PROVIDER: 'none' });
    await expect(verifier.verify('x')).resolves.toBe(true);
    await expect(verifier.verify('  ')).resolves.toBe(false);
  });

  it('turnstile: consulta o siteverify e falha fechado em erro de rede', async () => {
    const fetchOk = vi.fn(async () => Response.json({ success: true }));
    const ok = createCaptchaVerifier(
      { CAPTCHA_PROVIDER: 'turnstile', CAPTCHA_SECRET: 'segredo' },
      fetchOk,
    );
    await expect(ok.verify('token', '203.0.113.7')).resolves.toBe(true);
    const [url, init] = fetchOk.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('challenges.cloudflare.com/turnstile');
    expect(String(init.body)).toContain('remoteip=203.0.113.7');

    const down = createCaptchaVerifier(
      { CAPTCHA_PROVIDER: 'turnstile', CAPTCHA_SECRET: 'segredo' },
      async () => {
        throw new Error('rede');
      },
    );
    await expect(down.verify('token')).resolves.toBe(false);
  });
});

describe('InMemoryThrottleStore', () => {
  it('janela fixa: conta, expira e informa o tempo restante', async () => {
    let now = 0;
    const store = new InMemoryThrottleStore(() => now);
    expect(await store.hit('k', 60)).toEqual({ count: 1, ttlSeconds: 60 });
    now = 30_000;
    expect(await store.hit('k', 60)).toEqual({ count: 2, ttlSeconds: 30 });
    now = 61_000;
    expect(await store.count('k')).toBe(0);
    expect((await store.hit('k', 60)).count).toBe(1);
  });
});
