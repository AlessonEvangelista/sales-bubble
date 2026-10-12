import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GENERIC_REGISTER_RESPONSE, ProblemDetails } from '@bolha/contracts';
import { json, startAuthApp, type TestApp } from '../../testing/http-app.js';

/** Gerada em tempo de execução (política do gitleaks — gestao-segredos.md). */
const PASSWORD = randomBytes(12).toString('base64url');

const body = (overrides: Record<string, unknown> = {}) => ({
  account_type: 'PF',
  name: 'Fulano da Silva',
  email: 'fulano@example.com',
  password: PASSWORD,
  cpf: '529.982.247-25',
  accepted_terms_version: '2026-01-01',
  accepted_privacy_version: '2026-01-01',
  captcha_token: 'token',
  ...overrides,
});

describe('POST /api/v1/auth/register (BV-11, SEC-08)', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await startAuthApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('conta nova e conta existente recebem a mesma resposta (status, corpo)', async () => {
    const first = await app.request('/auth/register', json(body()));
    const again = await app.request('/auth/register', json(body()));

    expect(first.status).toBe(202);
    expect(again.status).toBe(202);
    expect(await first.json()).toEqual(GENERIC_REGISTER_RESPONSE);
    expect(await again.json()).toEqual(GENERIC_REGISTER_RESPONSE);
    expect(app.db.accounts).toHaveLength(1);
  });

  it('CPF inválido → 422 problem+json CPF_INVALID', async () => {
    const response = await app.request('/auth/register', json(body({ cpf: '123.456.789-00' })));

    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const problem = ProblemDetails.parse(await response.json());
    expect(problem.code).toBe('CPF_INVALID');
  });

  it('corpo fora do contrato → 422 VALIDATION_FAILED com errors[] e sem ecoar valores', async () => {
    const response = await app.request(
      '/auth/register',
      json(body({ email: 'nao-e-email', extra: 'campo' })),
    );

    expect(response.status).toBe(422);
    const problem = ProblemDetails.parse(await response.json());
    expect(problem.code).toBe('VALIDATION_FAILED');
    expect(problem.errors?.map((e) => e.field)).toEqual(expect.arrayContaining(['email']));
    expect(JSON.stringify(problem)).not.toContain('nao-e-email');
  });
});
