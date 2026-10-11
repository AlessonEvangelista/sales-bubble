import { describe, expect, it, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { GENERIC_REGISTER_RESPONSE } from '@bolha/contracts';

describe('AuthService — BV-11 Cadastro PF', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockPii: any;
  let passwordHasher: PasswordHasher;

  beforeEach(() => {
    mockPrisma = {
      account: {
        findFirst: async () => null,
      },
      $transaction: async (cb: any) => {
        const tx = {
          account: {
            create: async () => ({}),
          },
          consent: {
            createMany: async () => ({ count: 2 }),
          },
        };
        return cb(tx);
      },
    };

    mockPii = {
      hashEmail: async () => ({ version: 1, hash: Buffer.from('email_hash') }),
      hashDocument: async () => ({ version: 1, hash: Buffer.from('doc_hash') }),
      createDataKey: async () => Buffer.from('wrapped_dek'),
      encrypt: async (_text: string) => Buffer.from('encrypted_bytes'),
    };

    passwordHasher = new PasswordHasher();
    authService = new AuthService(mockPrisma, mockPii, passwordHasher);
  });

  it('rejeita CPF inválido com BadRequestException (code: CPF_INVALID)', async () => {
    const invalidDto = {
      account_type: 'PF' as const,
      name: 'Fulano da Silva',
      email: 'fulano@example.com',
      password: 'password12345678',
      cpf: '111.111.111-11',
      accepted_terms_version: '2026-01-01',
      accepted_privacy_version: '2026-01-01',
      marketing_opt_in: false,
      captcha_token: 'valid_token',
    };

    await expect(authService.registerPf(invalidDto)).rejects.toThrow(BadRequestException);
  });

  it('retorna GENERIC_REGISTER_RESPONSE e persiste conta e consentimentos para PF válida', async () => {
    let createdAccount: any = null;
    let createdConsents: any = null;

    mockPrisma.$transaction = async (cb: any) => {
      const tx = {
        account: {
          create: async (args: any) => {
            createdAccount = args.data;
            return createdAccount;
          },
        },
        consent: {
          createMany: async (args: any) => {
            createdConsents = args.data;
            return { count: args.data.length };
          },
        },
      };
      return cb(tx);
    };

    const validDto = {
      account_type: 'PF' as const,
      name: 'Fulano da Silva',
      email: 'fulano@example.com',
      password: 'password12345678',
      cpf: '529.982.247-25',
      accepted_terms_version: '2026-01-01',
      accepted_privacy_version: '2026-01-01',
      marketing_opt_in: true,
      captcha_token: 'valid_token',
    };

    const response = await authService.registerPf(validDto);
    expect(response).toEqual(GENERIC_REGISTER_RESPONSE);

    expect(createdAccount).toBeDefined();
    expect(createdAccount.accountType).toBe('PF');
    expect(createdAccount.status).toBe('PENDING_VERIFICATION');
    expect(createdAccount.role).toBe('USER');
    expect(createdAccount.pseudonym).toMatch(/^Bolhista#[0-9A-F]{4}$/);
    expect(createdConsents).toHaveLength(3); // TERMS, PRIVACY, MARKETING
  });

  it('anti-enumeração: se e-mail ou CPF já existem, retorna GENERIC_REGISTER_RESPONSE sem persistir duplicado', async () => {
    mockPrisma.account.findFirst = async () => ({ id: 'existing-id' });

    let transactionCalled = false;
    mockPrisma.$transaction = async () => {
      transactionCalled = true;
    };

    const validDto = {
      account_type: 'PF' as const,
      name: 'Fulano da Silva',
      email: 'fulano@example.com',
      password: 'password12345678',
      cpf: '529.982.247-25',
      accepted_terms_version: '2026-01-01',
      accepted_privacy_version: '2026-01-01',
      marketing_opt_in: false,
      captcha_token: 'valid_token',
    };

    const response = await authService.registerPf(validDto);
    expect(response).toEqual(GENERIC_REGISTER_RESPONSE);
    expect(transactionCalled).toBe(false);
  });
});
