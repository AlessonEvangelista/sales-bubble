import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  RegisterPfRequest,
  GENERIC_REGISTER_RESPONSE,
  type RegisterAcceptedResponse,
} from '@bolha/contracts';
import { Cpf } from '@bolha/core-domain';
import { PrismaService } from '../database/prisma.service.js';
import { PiiService } from '../database/pii.service.js';
import { PasswordHasher } from './password-hasher.js';

type RegisterPfPayload = typeof RegisterPfRequest._output;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: PiiService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  /**
   * Registro de PF (BV-11, SEC-08, SEC-22).
   * Responde SEMPRE GENERIC_REGISTER_RESPONSE para evitar enumeração.
   */
  async registerPf(dto: RegisterPfPayload): Promise<RegisterAcceptedResponse> {
    // 1. Validação de Domínio (CPF)
    const cpfResult = Cpf.parse(dto.cpf);
    if (!cpfResult.ok) {
      throw new BadRequestException({
        code: 'CPF_INVALID',
        message: 'CPF inválido',
      });
    }
    const cleanCpf = cpfResult.value.value;

    // 2. Hashes de busca / unicidade
    const emailBlind = await this.pii.hashEmail(dto.email);
    const docBlind = await this.pii.hashDocument(cleanCpf);

    // 3. Verificação anti-enumeração (se já existir conta com email ou doc, sai sem criar e sem erro explícito)
    const existing = await this.prisma.account.findFirst({
      where: {
        OR: [
          { emailHash: emailBlind.hash },
          { documentHash: docBlind.hash },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      // Simula carga computacional similar ao hash para timing consistente
      await this.passwordHasher.dummyVerify(dto.password);
      return GENERIC_REGISTER_RESPONSE;
    }

    // 4. Criação de nova conta
    const accountId = randomUUID();
    const wrappedDek = await this.pii.createDataKey(accountId);
    const keyRef = { subjectId: accountId, wrappedDek };

    // Criptografia dos campos PII em coluna
    const [nameEnc, emailEnc, docEnc, passwordHash] = await Promise.all([
      this.pii.encrypt(dto.name, keyRef, {
        table: 'accounts',
        column: 'name_enc',
        rowId: accountId,
      }),
      this.pii.encrypt(dto.email, keyRef, {
        table: 'accounts',
        column: 'email_enc',
        rowId: accountId,
      }),
      this.pii.encrypt(cleanCpf, keyRef, {
        table: 'accounts',
        column: 'document_enc',
        rowId: accountId,
      }),
      this.passwordHasher.hash(dto.password),
    ]);

    // Pseudônimo padrão com 4 caracteres hex (api-rest §2.8)
    const randomHex = randomBytes(2).toString('hex').toUpperCase();
    const pseudonym = `Bolhista#${randomHex}`;

    // Persistência com aceite de termos
    await this.prisma.$transaction(async (tx: any) => {
      await tx.account.create({
        data: {
          id: accountId,
          accountType: 'PF',
          pseudonym,
          emailEnc,
          emailHash: emailBlind.hash,
          documentEnc: docEnc,
          documentHash: docBlind.hash,
          nameEnc,
          passwordHash,
          piiDataKey: wrappedDek,
          piiKeyVersion: emailBlind.version,
          status: 'PENDING_VERIFICATION',
          role: 'USER',
        },
      });

      // Consentimentos obrigatórios LGPD (F1)
      await tx.consent.createMany({
        data: [
          {
            id: randomUUID(),
            accountId,
            purpose: 'TERMS_OF_USE',
            documentVersion: dto.accepted_terms_version,
          },
          {
            id: randomUUID(),
            accountId,
            purpose: 'PRIVACY_POLICY',
            documentVersion: dto.accepted_privacy_version,
          },
          ...(dto.marketing_opt_in
            ? [
                {
                  id: randomUUID(),
                  accountId,
                  purpose: 'MARKETING_EMAIL',
                  documentVersion: dto.accepted_privacy_version,
                },
              ]
            : []),
        ],
      });
    });

    return GENERIC_REGISTER_RESPONSE;
  }
}
