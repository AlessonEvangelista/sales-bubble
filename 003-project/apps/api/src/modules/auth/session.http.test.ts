import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeResponse, ProblemDetails, SessionResponse } from '@bolha/contracts';
import { json, startAuthApp, testJwtKeys, type TestApp } from '../../testing/http-app.js';

/** Gerada em tempo de execução (política do gitleaks — gestao-segredos.md). */
const PASSWORD = randomBytes(12).toString('base64url');
const EMAIL = 'carlos@example.com';

const registerBody = {
  account_type: 'PF',
  name: 'Carlos Pereira',
  email: EMAIL,
  password: PASSWORD,
  cpf: '529.982.247-25',
  accepted_terms_version: '2026-01-01',
  accepted_privacy_version: '2026-01-02',
  marketing_opt_in: true,
  captcha_token: 'token',
};

interface Cookies {
  refresh: string;
  csrf: string;
  raw: string[];
}

function cookiesOf(response: Response): Cookies {
  const raw = response.headers.getSetCookie();
  const value = (name: string) =>
    raw
      .find((c) => c.startsWith(`${name}=`))
      ?.split(';')[0]
      ?.slice(name.length + 1) ?? '';
  return { refresh: value('__Host-bv_rt'), csrf: value('bv_csrf'), raw };
}

function withSession(cookies: Cookies, csrf: string | null = cookies.csrf): RequestInit {
  return {
    method: 'POST',
    headers: {
      cookie: `__Host-bv_rt=${cookies.refresh}; bv_csrf=${cookies.csrf}`,
      ...(csrf === null ? {} : { 'x-csrf-token': csrf }),
    },
  };
}

async function problem(response: Response): Promise<ProblemDetails> {
  expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
  return ProblemDetails.parse(await response.json());
}

describe('Login, sessão e /me (BV-14, BV-15, SEC-06)', () => {
  let app: TestApp;

  const login = (password = PASSWORD, extra: Record<string, unknown> = {}) =>
    app.request('/auth/login', json({ email: EMAIL, password, ...extra }));

  beforeEach(async () => {
    app = await startAuthApp();
    expect((await app.request('/auth/register', json(registerBody))).status).toBe(202);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('US-004 — login', () => {
    it('credenciais válidas: access de 15 min, cookie httpOnly de 30 dias e /me com score 500 Regular', async () => {
      const response = await login();
      expect(response.status).toBe(200);
      const session = SessionResponse.parse(await response.json());
      expect(session.expires_in).toBe(900);

      const cookies = cookiesOf(response);
      const refreshCookie = cookies.raw.find((c) => c.startsWith('__Host-bv_rt='))!;
      expect(refreshCookie).toMatch(/; Max-Age=2592000;/);
      expect(refreshCookie).toMatch(/; Path=\//);
      expect(refreshCookie).toMatch(/; HttpOnly/);
      expect(refreshCookie).toMatch(/; Secure/);
      expect(refreshCookie).toMatch(/; SameSite=Strict/);
      expect(refreshCookie).not.toMatch(/Domain=/i);
      expect(cookies.raw.find((c) => c.startsWith('bv_csrf='))).not.toMatch(/HttpOnly/);

      const me = await app.request('/me', {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      expect(me.status).toBe(200);
      expect(me.headers.get('etag')).toMatch(/^".+"$/);
      const body = MeResponse.parse(await me.json());
      expect(body).toMatchObject({
        account_type: 'PF',
        pseudonym: expect.stringMatching(/^Bolhista#[0-9A-F]{4}$/),
        name: 'Carlos Pereira',
        email: 'c•••••@example.com',
        document_masked: '***.982.247-**',
        roles: ['user'],
        score: { value: 500, band: 'REGULAR', model_version: 'v1' },
        consents: { terms: '2026-01-01', privacy: '2026-01-02', marketing: true },
      });
    });

    it('senha errada e e-mail inexistente: mesmo 401 INVALID_CREDENTIALS, mesmo corpo', async () => {
      const wrong = await login('senha-errada');
      const unknown = await app.request(
        '/auth/login',
        json({ email: 'ninguem@example.com', password: PASSWORD }),
      );

      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(await problem(wrong)).toEqual(await problem(unknown));
    });

    it('força bruta: 3 erros → 428 CAPTCHA_REQUIRED; mais de 5 no minuto → 429 com Retry-After', async () => {
      for (let i = 0; i < 3; i++) expect((await login('errada')).status).toBe(401);

      const fourth = await login();
      expect(fourth.status).toBe(428);
      expect((await problem(fourth)).code).toBe('CAPTCHA_REQUIRED');

      // Com CAPTCHA, a senha volta a ser verificada (e o acerto zera as falhas).
      expect((await login(PASSWORD, { captcha_token: 'ok' })).status).toBe(200);

      const sixth = await login();
      expect(sixth.status).toBe(429);
      expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
      expect((await problem(sixth)).code).toBe('RATE_LIMITED');
    });

    it('conta suspensa: 403 ACCOUNT_SUSPENDED só com a senha correta', async () => {
      app.db.accounts[0]!.status = 'SUSPENDED';

      expect((await problem(await login('errada'))).code).toBe('INVALID_CREDENTIALS');
      const response = await login();
      expect(response.status).toBe(403);
      expect((await problem(response)).code).toBe('ACCOUNT_SUSPENDED');
      expect(app.db.refreshTokens).toHaveLength(0);
    });
  });

  describe('US-005 — refresh rotativo e logout', () => {
    it('renovação devolve novo par e invalida o refresh anterior', async () => {
      const first = cookiesOf(await login());
      const renewed = await app.request('/auth/refresh', withSession(first));
      expect(renewed.status).toBe(200);
      SessionResponse.parse(await renewed.json());
      const second = cookiesOf(renewed);
      expect(second.refresh).not.toBe(first.refresh);

      expect((await app.request('/auth/refresh', withSession(second))).status).toBe(200);
    });

    it('reuso de refresh rotacionado: 401 REFRESH_TOKEN_REUSED e a família inteira é revogada', async () => {
      const stolen = cookiesOf(await login());
      const legit = cookiesOf(await app.request('/auth/refresh', withSession(stolen)));

      const replay = await app.request('/auth/refresh', withSession(stolen));
      expect(replay.status).toBe(401);
      expect((await problem(replay)).code).toBe('REFRESH_TOKEN_REUSED');

      // O token legítimo (filho) também caiu.
      const after = await app.request('/auth/refresh', withSession(legit));
      expect(after.status).toBe(401);
      expect(app.db.refreshTokens.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('duas renovações simultâneas com o mesmo refresh: só uma vence, a outra é reuso', async () => {
      const cookies = cookiesOf(await login());
      const results = await Promise.all([
        app.request('/auth/refresh', withSession(cookies)),
        app.request('/auth/refresh', withSession(cookies)),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
      expect(app.db.refreshTokens.filter((t) => t.rotatedAt !== null)).toHaveLength(1);
    });

    it('CSRF: refresh e logout sem X-CSRF-Token (ou diferente do cookie) → 403', async () => {
      const cookies = cookiesOf(await login());
      for (const path of ['/auth/refresh', '/auth/logout']) {
        expect((await app.request(path, withSession(cookies, null))).status).toBe(403);
        expect((await app.request(path, withSession(cookies, 'outro'))).status).toBe(403);
      }
      expect((await app.request('/auth/refresh', { method: 'POST' })).status).toBe(401);
    });

    it('logout: 204, limpa os cookies e o refresh passa a retornar 401', async () => {
      const cookies = cookiesOf(await login());
      const out = await app.request('/auth/logout', withSession(cookies));
      expect(out.status).toBe(204);
      expect(out.headers.getSetCookie().join()).toMatch(/__Host-bv_rt=;.*Expires=Thu, 01 Jan 1970/);

      const refresh = await app.request('/auth/refresh', withSession(cookies));
      expect(refresh.status).toBe(401);
      expect((await problem(refresh)).code).toBe('UNAUTHENTICATED');
    });
  });

  describe('access token (RS256)', () => {
    const me = (token: string) =>
      app.request('/me', { headers: { authorization: `Bearer ${token}` } });
    const claims = { sub: 'x', role: 'ADMIN', account_type: 'PF', pseudonym: 'Bolhista#0000' };

    it('sem token → 401 UNAUTHENTICATED; expirado → 401 TOKEN_EXPIRED', async () => {
      expect((await problem(await app.request('/me'))).code).toBe('UNAUTHENTICATED');
      const expired = jwt.sign(claims, testJwtKeys.privateKey, {
        algorithm: 'RS256',
        issuer: 'bolha-venda',
        audience: 'bolha-venda-api',
        expiresIn: -10,
      });
      expect((await problem(await me(expired))).code).toBe('TOKEN_EXPIRED');
    });

    it('recusa alg none e HS256 assinado com a chave pública (confusão de algoritmo)', async () => {
      const none = jwt.sign(claims, '', { algorithm: 'none' });
      const hs256 = jwt.sign(claims, Buffer.from(testJwtKeys.publicKey), { algorithm: 'HS256' });
      expect((await me(none)).status).toBe(401);
      expect((await me(hs256)).status).toBe(401);
    });
  });
});
