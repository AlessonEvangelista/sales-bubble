import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  GENERIC_REGISTER_RESPONSE,
  type RegisterAcceptedResponse,
  type RegisterPfRequest,
} from '@bolha/contracts';
import type { z } from 'zod';
import { Cpf } from '@bolha/core-domain';
import { isUniqueViolation, PrismaClient } from '@bolha/database';
import { PiiService } from '../database/index.js';
import { ProblemException } from '../../http/problem.js';
import { PasswordHasher } from './password-hasher.js';

export type RegisterPfPayload = z.output<typeof RegisterPfRequest>;

/** Metadados da requisição gravados com o aceite (US-001: versão, data, IP e user agent). */
export interface RequestMeta {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

const PSEUDONYM_UNIQUE = 'accounts_pseudonym_uk';
const PSEUDONYM_ATTEMPTS = 5;
const USER_AGENT_MAX = 512;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(PiiService) private readonly pii: PiiService,
    @Inject(PasswordHasher) private readonly passwordHasher: PasswordHasher,
  ) {}

  /**
   * Cadastro de PF (BV-11). Anti-enumeração (SEC-08/SEC-22): e-mail ou CPF já cadastrados
   * recebem a mesma resposta `202` de uma conta nova, com custo de Argon2id equivalente.
   */
  async registerPf(
    dto: RegisterPfPayload,
    meta: RequestMeta = {},
  ): Promise<RegisterAcceptedResponse> {
    const cpf = Cpf.parse(dto.cpf);
    if (!cpf.ok) throw new ProblemException('CPF_INVALID');
    const document = cpf.value.value;

    const [emailBlind, docBlind] = await Promise.all([
      this.pii.hashEmail(dto.email),
      this.pii.hashDocument(document),
    ]);

    const existing = await this.prisma.account.findFirst({
      where: { OR: [{ emailHash: emailBlind.hash }, { documentHash: docBlind.hash }] },
      select: { id: true },
    });
    if (existing) {
      await this.passwordHasher.dummyVerify(dto.password);
      return GENERIC_REGISTER_RESPONSE;
    }

    const accountId = randomUUID();
    const wrappedDek = await this.pii.createDataKey(accountId);
    const keyRef = { subjectId: accountId, wrappedDek };
    const aad = (column: string) => ({ table: 'accounts', column, rowId: accountId });

    const [nameEnc, emailEnc, documentEnc, passwordHash, ipHash] = await Promise.all([
      this.pii.encrypt(dto.name, keyRef, aad('name_enc')),
      this.pii.encrypt(dto.email, keyRef, aad('email_enc')),
      this.pii.encrypt(document, keyRef, aad('document_enc')),
      this.passwordHasher.hash(dto.password),
      meta.ip ? this.pii.hashIp(meta.ip) : Promise.resolve(undefined),
    ]);
    const userAgent = meta.userAgent?.slice(0, USER_AGENT_MAX) ?? null;
    const consent = (purpose: string, documentVersion: string) => ({
      id: randomUUID(),
      accountId,
      purpose,
      documentVersion,
      ipHash: ipHash?.hash ?? null,
      userAgent,
    });

    for (let attempt = 1; ; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.account.create({
            data: {
              id: accountId,
              accountType: 'PF',
              pseudonym: this.generatePseudonym(),
              emailEnc,
              emailHash: emailBlind.hash,
              documentEnc,
              documentHash: docBlind.hash,
              nameEnc,
              passwordHash,
              piiDataKey: wrappedDek,
              piiKeyVersion: emailBlind.version,
              status: 'PENDING_VERIFICATION',
              role: 'USER',
            },
          });
          await tx.consent.createMany({
            data: [
              consent('TERMS_OF_USE', dto.accepted_terms_version),
              consent('PRIVACY_POLICY', dto.accepted_privacy_version),
              ...(dto.marketing_opt_in
                ? [consent('MARKETING_EMAIL', dto.accepted_privacy_version)]
                : []),
            ],
          });
        });
        return GENERIC_REGISTER_RESPONSE;
      } catch (error) {
        // Sufixo de 4 hex (Spec F1) colide com outra conta: sorteia de novo.
        if (isUniqueViolation(error, PSEUDONYM_UNIQUE) && attempt < PSEUDONYM_ATTEMPTS) continue;
        // Cadastro concorrente com o mesmo e-mail/CPF: mesma resposta (anti-enumeração).
        if (isUniqueViolation(error) && !isUniqueViolation(error, PSEUDONYM_UNIQUE)) {
          return GENERIC_REGISTER_RESPONSE;
        }
        throw error;
      }
    }
  }

  /** `Bolhista#XXXX` — 4 caracteres hexadecimais maiúsculos (Spec F1, contrato `Pseudonym`). */
  protected generatePseudonym(): string {
    return `Bolhista#${randomBytes(2).toString('hex').toUpperCase()}`;
  }
}
