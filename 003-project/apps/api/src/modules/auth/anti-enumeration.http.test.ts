import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, startAuthApp, type TestApp } from '../../testing/http-app.js';
import { PasswordHasher } from './password-hasher.js';

/**
 * Gate de CI do SEC-22 (BV-153) / SEC-08 (BV-141): pelo HTTP, cadastro e login não revelam se
 * um e-mail/CPF existe — mesmo status, mesmo corpo, mesmos cabeçalhos relevantes e o mesmo
 * trabalho de Argon2id (sem atalho de tempo). Roda em `npm run test:security`.
 * Recuperação de senha entra no mesmo gate quando o endpoint existir (US de recuperação).
 */
const PASSWORD = randomBytes(12).toString('base64url');

const register = (email: string, cpf: string) => ({
  account_type: 'PF',
  name: 'Fulano da Silva',
  email,
  password: PASSWORD,
  cpf,
  accepted_terms_version: '2026-01-01',
  accepted_privacy_version: '2026-01-01',
  captcha_token: 'token',
});

async function snapshot(response: Response) {
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    setCookie: response.headers.getSetCookie().length,
    body: await response.text(),
  };
}

describe('Anti-enumeração pelo HTTP (SEC-08, SEC-22)', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await startAuthApp();
    await app.request('/auth/register', json(register('existe@example.com', '529.982.247-25')));
    // Aquece o hash fictício (gerado uma vez por processo) para não contar nas asserções.
    await app.request('/auth/register', json(register('existe@example.com', '529.982.247-25')));
  });
  afterAll(async () => {
    await app.close();
  });

  it('cadastro: e-mail existente, CPF existente e conta nova são indistinguíveis', async () => {
    const hashes = vi.spyOn(PasswordHasher.prototype, 'hash');
    const dummies = vi.spyOn(PasswordHasher.prototype, 'dummyVerify');

    const fresh = await snapshot(
      await app.request('/auth/register', json(register('nova@example.com', '111.444.777-35'))),
    );
    const sameEmail = await snapshot(
      await app.request('/auth/register', json(register('existe@example.com', '390.533.447-05'))),
    );
    const sameCpf = await snapshot(
      await app.request('/auth/register', json(register('outra@example.com', '529.982.247-25'))),
    );

    expect(sameEmail).toEqual(fresh);
    expect(sameCpf).toEqual(fresh);
    // Conta nova paga um hash; duplicadas pagam uma verificação de mesmo custo.
    expect(hashes).toHaveBeenCalledTimes(1);
    expect(dummies).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('login: senha errada e e-mail inexistente são indistinguíveis e ambos custam um Argon2id', async () => {
    const verifies = vi.spyOn(PasswordHasher.prototype, 'verify');

    const wrongPassword = await snapshot(
      await app.request('/auth/login', json({ email: 'existe@example.com', password: 'x' })),
    );
    const unknownEmail = await snapshot(
      await app.request('/auth/login', json({ email: 'ninguem@example.com', password: 'x' })),
    );

    expect(unknownEmail).toEqual(wrongPassword);
    expect(wrongPassword.status).toBe(401);
    // verify real (senha errada) + verify dentro do dummyVerify (e-mail inexistente).
    expect(verifies).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
