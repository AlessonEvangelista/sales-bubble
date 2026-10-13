import { describe, expect, it } from 'vitest';
import { GENERIC_REGISTER_RESPONSE, GENERIC_ACCEPTED_RESPONSE } from '@bolha/contracts';

describe('Anti-Enumeration CI Pentest Gate (SEC-08, SEC-22 / BV-141, BV-153)', () => {
  it('respostas de cadastro e recuperação de senha são estritas, imutáveis e sem vazamento de estado', () => {
    // 1. Resposta de registro
    expect(GENERIC_REGISTER_RESPONSE).toEqual({
      status: 'PENDING_EMAIL_CONFIRMATION',
      message: 'Se os dados forem válidos, enviaremos a confirmação por e-mail.',
    });

    const registerKeys = Object.keys(GENERIC_REGISTER_RESPONSE);
    expect(registerKeys).toEqual(['status', 'message']);
    expect(registerKeys).not.toContain('id');
    expect(registerKeys).not.toContain('account_id');
    expect(registerKeys).not.toContain('exists');
    expect(registerKeys).not.toContain('email');

    // 2. Resposta de recuperação de senha / reenvio de confirmação
    expect(GENERIC_ACCEPTED_RESPONSE).toEqual({
      status: 'ACCEPTED',
      message: 'Se houver uma conta com este e-mail, enviaremos as instruções.',
    });

    const acceptedKeys = Object.keys(GENERIC_ACCEPTED_RESPONSE);
    expect(acceptedKeys).toEqual(['status', 'message']);
    expect(acceptedKeys).not.toContain('id');
    expect(acceptedKeys).not.toContain('user');
    expect(acceptedKeys).not.toContain('found');
  });
});
