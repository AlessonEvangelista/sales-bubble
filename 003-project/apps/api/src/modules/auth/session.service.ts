import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AccountType, LoginRequest, SessionResponse } from '@bolha/contracts';
import { PrismaClient } from '@bolha/database';
import type { z } from 'zod';
import { PiiService, type Bytes } from '../database/index.js';
import { ProblemException } from '../../http/problem.js';
import { toApiAccountStatus } from './account-status.js';
import type { RequestMeta } from './auth.service.js';
import { LoginThrottle } from './login-throttle.js';
import { PasswordHasher } from './password-hasher.js';
import { REFRESH_TTL_SECONDS } from './session-cookies.js';
import { TokenService } from './token.service.js';

export type LoginPayload = z.output<typeof LoginRequest>;

/** Sessão emitida: corpo da resposta + refresh token em claro (vai só no cookie). */
export interface IssuedSession {
  session: SessionResponse;
  refreshToken: string;
}

interface SessionAccount {
  id: string;
  role: string;
  accountType: string;
  pseudonym: string;
  status: string;
}

const USER_AGENT_MAX = 512;

/** Rotação perdida para outra requisição com o mesmo refresh (corrida = reuso). */
class ConcurrentRotation extends Error {}

/**
 * Login e sessão (BV-14, BV-15, SEC-06): access token RS256 de 15 min e refresh opaco de 30
 * dias, rotativo, guardado só como SHA-256. Reapresentar um refresh já rotacionado revoga a
 * família inteira (detecção de roubo).
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(PiiService) private readonly pii: PiiService,
    @Inject(PasswordHasher) private readonly passwordHasher: PasswordHasher,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(LoginThrottle) private readonly throttle: LoginThrottle,
  ) {}

  async login(dto: LoginPayload, meta: RequestMeta = {}): Promise<IssuedSession> {
    const emailBlind = await this.pii.hashEmail(dto.email);
    const ipHash = meta.ip ? await this.pii.hashIp(meta.ip) : undefined;
    const subject = hex(emailBlind.hash);
    await this.throttle.check({
      subject,
      ipKey: ipHash ? hex(ipHash.hash) : undefined,
      remoteIp: meta.ip,
      captchaToken: dto.captcha_token,
    });

    const account = await this.prisma.account.findFirst({
      where: { emailHash: emailBlind.hash },
    });
    // Conta inexistente, só OAuth ou excluída: mesmo custo de Argon2id e mesma resposta.
    const valid =
      account?.passwordHash && account.status !== 'DELETED'
        ? await this.passwordHasher.verify(account.passwordHash, dto.password)
        : await this.passwordHasher.dummyVerify(dto.password);
    if (!account || !valid) {
      await this.throttle.recordFailure(subject);
      throw new ProblemException('INVALID_CREDENTIALS');
    }
    await this.throttle.recordSuccess(subject);
    // Só depois da senha correta: não revela a situação de contas alheias.
    if (account.status === 'SUSPENDED') throw new ProblemException('ACCOUNT_SUSPENDED');

    return this.issue(account, randomUUID(), meta, ipHash?.hash);
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta = {}): Promise<IssuedSession> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawRefreshToken) },
      include: { account: true },
    });
    if (!record || record.revokedAt) throw new ProblemException('UNAUTHENTICATED');
    if (record.rotatedAt) {
      await this.revokeFamily(record.familyId);
      throw new ProblemException('REFRESH_TOKEN_REUSED');
    }
    if (record.expiresAt.getTime() <= Date.now()) throw new ProblemException('UNAUTHENTICATED');
    if (record.account.status === 'SUSPENDED' || record.account.status === 'DELETED') {
      await this.revokeFamily(record.familyId);
      throw new ProblemException(
        record.account.status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'UNAUTHENTICATED',
      );
    }

    const ipHash = meta.ip ? (await this.pii.hashIp(meta.ip)).hash : undefined;
    try {
      return await this.issue(record.account, record.familyId, meta, ipHash, record.id);
    } catch (error) {
      if (!(error instanceof ConcurrentRotation)) throw error;
      await this.revokeFamily(record.familyId);
      throw new ProblemException('REFRESH_TOKEN_REUSED');
    }
  }

  /** Revoga a família do refresh apresentado (idempotente). */
  async logout(rawRefreshToken: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawRefreshToken) },
      select: { familyId: true },
    });
    if (record) await this.revokeFamily(record.familyId);
  }

  /**
   * Cria o refresh novo e, numa rotação, marca o anterior como substituído na mesma transação.
   * A marcação é condicional (`rotated_at IS NULL AND revoked_at IS NULL`): duas renovações
   * simultâneas com o mesmo token não geram dois filhos — a segunda vira reuso.
   */
  private async issue(
    account: SessionAccount,
    familyId: string,
    meta: RequestMeta,
    ipHash: Bytes | undefined,
    rotatedFromId?: string,
  ): Promise<IssuedSession> {
    const refreshToken = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          id,
          accountId: account.id,
          familyId,
          tokenHash: sha256(refreshToken),
          expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
          ipHash: ipHash ?? null,
          userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX) ?? null,
        },
      });
      if (rotatedFromId) {
        const { count } = await tx.refreshToken.updateMany({
          where: { id: rotatedFromId, rotatedAt: null, revokedAt: null },
          data: { rotatedAt: now, replacedBy: id },
        });
        if (count !== 1) throw new ConcurrentRotation();
      }
    });

    const { accessToken, expiresIn } = this.tokens.signAccessToken({
      sub: account.id,
      role: account.role,
      account_type: account.accountType,
      pseudonym: account.pseudonym,
    });
    return {
      refreshToken,
      session: {
        access_token: accessToken,
        expires_in: expiresIn,
        account: {
          id: account.id,
          account_type: account.accountType as AccountType,
          pseudonym: account.pseudonym,
          status: toApiAccountStatus(account.status),
        },
      },
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function sha256(value: string): Bytes {
  return Uint8Array.from(createHash('sha256').update(value).digest());
}

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}
