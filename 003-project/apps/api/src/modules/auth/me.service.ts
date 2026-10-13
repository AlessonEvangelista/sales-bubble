import { Inject, Injectable } from '@nestjs/common';
import type { MeResponse, ScoreBand } from '@bolha/contracts';
import { PrismaClient } from '@bolha/database';
import { PiiService } from '../database/index.js';
import { ProblemException } from '../../http/problem.js';
import { toApiAccountStatus } from './account-status.js';
import type { Role } from './guards/roles.guard.js';

type PayoutStatus = MeResponse['payout_recipient']['status'];

const PAYOUT_STATUS: Record<string, PayoutStatus> = {
  PENDING: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

/** `GET /me` — dados do titular, mascarados (ADR-0012; api-rest §2.7). */
@Injectable()
export class MeService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(PiiService) private readonly pii: PiiService,
  ) {}

  async getMe(accountId: string): Promise<MeResponse> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { consents: { where: { revokedAt: null }, orderBy: { grantedAt: 'desc' } } },
    });
    if (!account || account.status === 'DELETED') throw new ProblemException('UNAUTHENTICATED');

    const keyRef = { subjectId: account.id, wrappedDek: account.piiDataKey };
    const decrypt = (ciphertext: Uint8Array, column: string) =>
      this.pii.decrypt(ciphertext, keyRef, { table: 'accounts', column, rowId: account.id });
    const [name, email, document] = await Promise.all([
      decrypt(account.nameEnc, 'name_enc'),
      decrypt(account.emailEnc, 'email_enc'),
      decrypt(account.documentEnc, 'document_enc'),
    ]);
    const latest = (purpose: string) =>
      account.consents.find((c) => c.purpose === purpose)?.documentVersion ?? '';

    return {
      id: account.id,
      account_type: account.accountType as MeResponse['account_type'],
      pseudonym: account.pseudonym,
      name,
      email: maskEmail(email),
      document_masked: maskDocument(document),
      status: toApiAccountStatus(account.status),
      roles: [account.role.toLowerCase() as Role],
      score: {
        value: account.score,
        band: scoreBand(account.score),
        model_version: account.scoreModelVersion,
      },
      // PJ (CNPJ verificado, ADR-0008) entra com o cadastro PJ.
      company: null,
      payout_recipient: {
        status: PAYOUT_STATUS[account.gatewayRecipientStatus ?? ''] ?? 'NOT_REGISTERED',
      },
      consents: {
        terms: latest('TERMS_OF_USE'),
        privacy: latest('PRIVACY_POLICY'),
        marketing: account.consents.some((c) => c.purpose === 'MARKETING_EMAIL'),
      },
      preferences: { reduce_motion: false },
    };
  }
}

/** Faixas da Spec §7: 0–299 Risco · 300–599 Regular · 600–799 Bom · 800–1000 Excelente. */
export function scoreBand(score: number): ScoreBand {
  if (score < 300) return 'RISCO';
  if (score < 600) return 'REGULAR';
  if (score < 800) return 'BOM';
  return 'EXCELENTE';
}

/** `carlos@example.com` → `c•••••@example.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••••';
  return `${email[0]}•••••${email.slice(at)}`;
}

/** CPF `52998224725` → `***.982.247-**`; CNPJ mostra só os 4 da filial e os 2 DV mascarados. */
export function maskDocument(document: string): string {
  if (document.length === 11) return `***.${document.slice(3, 6)}.${document.slice(6, 9)}-**`;
  return `**.***.***/${document.slice(8, 12)}-**`;
}
