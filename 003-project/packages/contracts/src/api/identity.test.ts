import { describe, expect, it } from 'vitest';
import {
  ForgotPasswordRequest,
  GENERIC_ACCEPTED_RESPONSE,
  GENERIC_REGISTER_RESPONSE,
  GenericAcceptedResponse,
  RegisterAcceptedResponse,
  RegisterRequest,
  UpdateMeRequest,
} from './identity.js';
import { ROUTES, type RouteDef } from './routes.js';

const route = (id: string): RouteDef => ROUTES.find((r) => r.operationId === id)!;

const pf = {
  account_type: 'PF',
  name: 'Carlos Silva',
  email: 'carlos@example.com',
  password: 'x'.repeat(20),
  cpf: '123.456.789-09',
  accepted_terms_version: '2026-10-01',
  accepted_privacy_version: '2026-10-01',
  marketing_opt_in: false,
  captcha_token: 'tok',
};

describe('cadastro (api-rest §2.1)', () => {
  it('aceita o exemplo PF e o PJ com cnpj', () => {
    expect(RegisterRequest.parse(pf).account_type).toBe('PF');
    expect(
      RegisterRequest.parse({ ...pf, account_type: 'PJ', cnpj: '12.345.678/0001-95' }).account_type,
    ).toBe('PJ');
  });

  it('rejeita campos fora da allowlist (sem mass assignment)', () => {
    expect(RegisterRequest.safeParse({ ...pf, roles: ['admin'] }).success).toBe(false);
    expect(RegisterRequest.safeParse({ ...pf, cnpj: '12.345.678/0001-95' }).success).toBe(false);
  });

  it('exige senha mínima de 15 caracteres (TM-10)', () => {
    expect(RegisterRequest.safeParse({ ...pf, password: 'x'.repeat(10) }).success).toBe(false);
  });
});

describe('anti-enumeração (SEC-08 / SEC-22)', () => {
  it('a resposta do cadastro é constante e válida', () => {
    expect(RegisterAcceptedResponse.parse(GENERIC_REGISTER_RESPONSE)).toEqual({
      status: 'PENDING_EMAIL_CONFIRMATION',
      message: 'Se os dados forem válidos, enviaremos a confirmação por e-mail.',
    });
    expect(Object.isFrozen(GENERIC_REGISTER_RESPONSE)).toBe(true);
  });

  it('o schema não admite campo extra nem outro valor (nada que revele a conta)', () => {
    expect(
      RegisterAcceptedResponse.safeParse({ ...GENERIC_REGISTER_RESPONSE, account_id: 'x' }).success,
    ).toBe(false);
    expect(
      RegisterAcceptedResponse.safeParse({
        ...GENERIC_REGISTER_RESPONSE,
        status: 'ALREADY_REGISTERED',
      }).success,
    ).toBe(false);
    expect(
      RegisterAcceptedResponse.safeParse({
        ...GENERIC_REGISTER_RESPONSE,
        message: 'Você já tem conta',
      }).success,
    ).toBe(false);
  });

  it('cadastro, reenvio e recuperação respondem só 202 genérico', () => {
    for (const id of ['register', 'forgotPassword', 'resendConfirmationEmail']) {
      expect(Object.keys(route(id).responses), id).toEqual(['202']);
    }
    expect(route('register').responses[202]?.schema).toBe(RegisterAcceptedResponse);
    expect(route('forgotPassword').responses[202]?.schema).toBe(GenericAcceptedResponse);
    expect(GenericAcceptedResponse.parse(GENERIC_ACCEPTED_RESPONSE)).toEqual(
      GENERIC_ACCEPTED_RESPONSE,
    );
  });

  it('cadastro e recuperação não documentam erros que revelem existência de conta', () => {
    const revealing = [
      'DOCUMENT_ALREADY_REGISTERED',
      'NOT_FOUND',
      'INVALID_CREDENTIALS',
      'ACCOUNT_SUSPENDED',
    ];
    for (const id of ['register', 'forgotPassword', 'resendConfirmationEmail']) {
      for (const code of revealing) expect(route(id).errors, `${id}/${code}`).not.toContain(code);
    }
  });

  it('DOCUMENT_ALREADY_REGISTERED só existe em PATCH /me (autenticado)', () => {
    const users = ROUTES.filter((r) =>
      (r.errors as readonly string[]).includes('DOCUMENT_ALREADY_REGISTERED'),
    );
    expect(users.map((r) => r.operationId)).toEqual(['updateMe']);
    expect(route('updateMe').auth).toBe('authenticated');
  });

  it('forgot aceita só o e-mail', () => {
    expect(ForgotPasswordRequest.safeParse({ email: 'a@b.com', extra: 1 }).success).toBe(false);
  });
});

describe('PATCH /me', () => {
  it('aceita campos parciais e rejeita desconhecidos', () => {
    expect(UpdateMeRequest.parse({ nickname: 'Bolhista' })).toEqual({ nickname: 'Bolhista' });
    expect(UpdateMeRequest.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });
});
