import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { GENERIC_REGISTER_RESPONSE } from '@bolha/contracts';
import { PiiService } from '../database/index.js';
import { ProblemException } from '../../http/problem.js';
import {
  createInMemoryPrisma,
  createTestPiiCrypto,
  type InMemoryDb,
} from '../../testing/in-memory-prisma.js';
import { AuthService, type RegisterPfPayload } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';

/** Gerada em tempo de execução (política do gitleaks — gestao-segredos.md). */
const PASSWORD = randomBytes(12).toString('base64url');

const dto = (overrides: Partial<RegisterPfPayload> = {}): RegisterPfPayload => ({
  account_type: 'PF',
  name: 'Fulano da Silva',
  email: 'fulano@example.com',
  password: PASSWORD,
  cpf: '529.982.247-25',
  accepted_terms_version: '2026-01-01',
  accepted_privacy_version: '2026-01-01',
  marketing_opt_in: false,
  captcha_token: 'token',
  ...overrides,
});

describe('AuthService.registerPf (BV-11)', () => {
  let db: InMemoryDb;
  let pii: PiiService;
  let auth: AuthService;

  beforeEach(() => {
    const memory = createInMemoryPrisma();
    db = memory.db;
    pii = new PiiService(createTestPiiCrypto());
    auth = new AuthService(memory.prisma, pii, new PasswordHasher());
  });

  it('CPF com dígito inválido → 422 CPF_INVALID e nada é gravado', async () => {
    const error = await auth.registerPf(dto({ cpf: '123.456.789-00' })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemException);
    expect((error as ProblemException).getStatus()).toBe(422);
    expect((error as ProblemException).code).toBe('CPF_INVALID');
    expect(db.accounts).toHaveLength(0);
  });

  it('cria a conta com PII cifrada, pseudônimo Bolhista#XXXX e aceites com IP (hash) e user agent', async () => {
    const response = await auth.registerPf(dto({ marketing_opt_in: true }), {
      ip: '203.0.113.7',
      userAgent: 'vitest',
    });

    expect(response).toEqual(GENERIC_REGISTER_RESPONSE);
    const [account] = db.accounts;
    expect(account).toBeDefined();
    expect(account?.pseudonym).toMatch(/^Bolhista#[0-9A-F]{4}$/);
    expect(account?.status).toBe('PENDING_VERIFICATION');
    expect(account?.role).toBe('USER');
    expect(account?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,(t=3,p=4|p=4,t=3)\$/);
    // Nenhum dado pessoal em claro nas colunas cifradas.
    for (const column of [account?.nameEnc, account?.emailEnc, account?.documentEnc]) {
      const text = Buffer.from(column ?? new Uint8Array()).toString('latin1');
      expect(text).not.toMatch(/Fulano|fulano@example\.com|52998224725/);
    }
    const keyRef = { subjectId: account!.id, wrappedDek: account!.piiDataKey };
    const aad = { table: 'accounts', column: 'document_enc', rowId: account!.id };
    await expect(pii.decrypt(account!.documentEnc, keyRef, aad)).resolves.toBe('52998224725');

    expect(db.consents.map((c) => c.purpose).sort()).toEqual([
      'MARKETING_EMAIL',
      'PRIVACY_POLICY',
      'TERMS_OF_USE',
    ]);
    const ipHash = (await pii.hashIp('203.0.113.7')).hash;
    for (const consent of db.consents) {
      expect(consent.documentVersion).toBe('2026-01-01');
      expect(consent.userAgent).toBe('vitest');
      expect(Buffer.compare(consent.ipHash!, ipHash)).toBe(0);
    }
  });

  it.each([
    ['e-mail', { cpf: '111.444.777-35' }],
    ['CPF', { email: 'outra@example.com' }],
  ])('%s já cadastrado → mesma resposta genérica, sem duplicar (SEC-08)', async (_, other) => {
    await auth.registerPf(dto());
    const response = await auth.registerPf(dto(other));

    expect(response).toEqual(GENERIC_REGISTER_RESPONSE);
    expect(db.accounts).toHaveLength(1);
  });

  it('pseudônimo em colisão é sorteado de novo (até 5 tentativas)', async () => {
    const queue = ['Bolhista#AAAA', 'Bolhista#AAAA', 'Bolhista#BEEF'];
    class Scripted extends AuthService {
      protected override generatePseudonym(): string {
        return queue.shift() ?? 'Bolhista#FFFF';
      }
    }
    const memory = createInMemoryPrisma();
    const service = new Scripted(memory.prisma, pii, new PasswordHasher());

    await service.registerPf(dto());
    await service.registerPf(dto({ email: 'outra@example.com', cpf: '111.444.777-35' }));

    expect(memory.db.accounts.map((a) => a.pseudonym)).toEqual(['Bolhista#AAAA', 'Bolhista#BEEF']);
  });
});
