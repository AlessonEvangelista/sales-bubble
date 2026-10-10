/**
 * DTOs de identidade e LGPD (`identity` — F1; api-rest.md §2).
 *
 * Segurança (SEC-08 / SEC-22 — anti-enumeração):
 * - `POST /auth/register` responde **sempre** `202` com o corpo fixo `GENERIC_REGISTER_RESPONSE`,
 *   exista ou não conta com o e-mail/documento. Não há código de erro "já cadastrado".
 * - `POST /auth/password/forgot` e `POST /auth/email/resend` respondem **sempre** `202` com
 *   o corpo fixo `GENERIC_ACCEPTED_RESPONSE`.
 * - Os schemas dessas respostas são **literais**: qualquer campo/valor a mais quebra o contrato
 *   (teste em `identity.test.ts`), o que impede vazar a existência da conta pela resposta.
 * - `POST /auth/login` falha só com `INVALID_CREDENTIALS` (não revela qual campo errou).
 */
import { z } from 'zod';
import {
  AccountType,
  IsoDate,
  IsoDateTime,
  ScoreBand,
  Uuid,
  VerificationStatus,
} from '../common.js';

// ------------------------------------------------------------------ primitivos

/** E-mail normalizado (minúsculas, sem espaços nas pontas). */
export const Email = z.email().max(254);

/**
 * Senha: 15–128 caracteres (threat-model TM-10: mínimo de 15 sem MFA — NIST SP 800-63B).
 * O limite superior evita DoS no hash.
 */
export const Password = z.string().min(15).max(128);

/** CPF com ou sem máscara (o dígito verificador é validado no domínio → `CPF_INVALID`). */
export const CpfInput = z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/);

/** CNPJ com ou sem máscara (o dígito verificador é validado no domínio → `CNPJ_INVALID`). */
export const CnpjInput = z.string().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/);

/** Versão de documento legal (termos/política), no formato de data `AAAA-MM-DD`. */
export const LegalVersion = IsoDate;

/** Pseudônimo público `Apelido#XXXX` (o sufixo é fixo — api-rest §2.8). */
export const Pseudonym = z
  .string()
  .regex(/^.{1,32}#[0-9A-F]{4}$/)
  .meta({ id: 'Pseudonym' });

/** Status da conta. */
export const AccountStatus = z
  .enum(['PENDING_EMAIL_CONFIRMATION', 'INCOMPLETE', 'ACTIVE', 'SUSPENDED'])
  .meta({ id: 'AccountStatus' });
export type AccountStatus = z.infer<typeof AccountStatus>;

/** Papéis (api-rest §1.2). */
export const Role = z.enum(['user', 'moderator', 'admin']);

// ------------------------------------------------------------------ cadastro (§2.1)

const RegisterBase = {
  name: z.string().trim().min(2).max(120),
  email: Email,
  password: Password,
  cpf: CpfInput,
  accepted_terms_version: LegalVersion,
  accepted_privacy_version: LegalVersion,
  marketing_opt_in: z.boolean().default(false),
  captcha_token: z.string().min(1).max(4096),
};

/** `POST /auth/register` — PF. */
export const RegisterPfRequest = z.strictObject({
  account_type: z.literal('PF'),
  ...RegisterBase,
});

/** `POST /auth/register` — PJ: dados da PF responsável + `cnpj`. */
export const RegisterPjRequest = z.strictObject({
  account_type: z.literal('PJ'),
  ...RegisterBase,
  cnpj: CnpjInput,
});

export const RegisterRequest = z
  .discriminatedUnion('account_type', [RegisterPfRequest, RegisterPjRequest])
  .meta({ id: 'RegisterRequest' });
export type RegisterRequest = z.infer<typeof RegisterRequest>;

/** Mensagem genérica do cadastro (api-rest §2.1) — idêntica para conta nova ou existente. */
export const GENERIC_REGISTER_MESSAGE =
  'Se os dados forem válidos, enviaremos a confirmação por e-mail.' as const;

/**
 * Resposta `202` do cadastro — **sempre a mesma** (anti-enumeração, SEC-08/SEC-22).
 * Objeto estrito com valores literais: não pode carregar id, status real nem indício de
 * conta existente.
 */
export const RegisterAcceptedResponse = z
  .strictObject({
    status: z.literal('PENDING_EMAIL_CONFIRMATION'),
    message: z.literal(GENERIC_REGISTER_MESSAGE),
  })
  .meta({
    id: 'RegisterAcceptedResponse',
    description:
      'Resposta genérica e constante do cadastro: igual exista ou não conta com o e-mail/documento (anti-enumeração).',
  });
export type RegisterAcceptedResponse = z.infer<typeof RegisterAcceptedResponse>;

/** Corpo constante do cadastro (use este objeto no controller). */
export const GENERIC_REGISTER_RESPONSE: RegisterAcceptedResponse = Object.freeze({
  status: 'PENDING_EMAIL_CONFIRMATION',
  message: GENERIC_REGISTER_MESSAGE,
});

/** Mensagem genérica de recuperação de senha / reenvio de confirmação. */
export const GENERIC_ACCEPTED_MESSAGE =
  'Se houver uma conta com este e-mail, enviaremos as instruções.' as const;

/**
 * Resposta `202` constante de `POST /auth/password/forgot` e `POST /auth/email/resend`
 * (anti-enumeração, SEC-08/SEC-22).
 */
export const GenericAcceptedResponse = z
  .strictObject({
    status: z.literal('ACCEPTED'),
    message: z.literal(GENERIC_ACCEPTED_MESSAGE),
  })
  .meta({
    id: 'GenericAcceptedResponse',
    description:
      'Resposta genérica e constante: igual exista ou não conta com o e-mail (anti-enumeração).',
  });
export type GenericAcceptedResponse = z.infer<typeof GenericAcceptedResponse>;

export const GENERIC_ACCEPTED_RESPONSE: GenericAcceptedResponse = Object.freeze({
  status: 'ACCEPTED',
  message: GENERIC_ACCEPTED_MESSAGE,
});

// ------------------------------------------------------------------ e-mail, login, sessão

/** `POST /auth/email/confirm`. */
export const ConfirmEmailRequest = z.strictObject({ token: z.string().min(16).max(512) });

/** `POST /auth/email/resend` — resposta sempre `GENERIC_ACCEPTED_RESPONSE`. */
export const ResendEmailRequest = z.strictObject({ email: Email });

/** Dados da empresa (PJ) visíveis ao titular. */
export const CompanyInfo = z
  .object({
    verification_status: VerificationStatus,
    legal_name: z.string().nullable(),
    cnae: z.string().nullable(),
    verified_at: IsoDateTime.nullable(),
    next_revalidation_at: IsoDateTime.nullable(),
    /** Presente em `PENDING_VERIFICATION` (provedor de CNPJ indisponível — ADR-0008). */
    next_attempt_at: IsoDateTime.nullable().optional(),
  })
  .meta({ id: 'CompanyInfo' });

/** Conta resumida (respostas de autenticação). */
export const AccountSummary = z
  .object({
    id: Uuid,
    account_type: AccountType,
    pseudonym: Pseudonym,
    status: AccountStatus.optional(),
    company: CompanyInfo.nullable().optional(),
  })
  .meta({ id: 'AccountSummary' });

/** Resposta com access token (`/auth/email/confirm`, `/auth/login`, `/auth/refresh`). */
export const SessionResponse = z
  .object({
    access_token: z.string(),
    /** Segundos até expirar (15 min). */
    expires_in: z.int().positive(),
    account: AccountSummary.optional(),
  })
  .meta({ id: 'SessionResponse' });
export type SessionResponse = z.infer<typeof SessionResponse>;

/** `POST /auth/login`. `captcha_token` obrigatório após 3 falhas (`CAPTCHA_REQUIRED`). */
export const LoginRequest = z.strictObject({
  email: Email,
  password: z.string().min(1).max(128),
  captcha_token: z.string().max(4096).nullable().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** `POST /auth/password/forgot` — resposta sempre `GENERIC_ACCEPTED_RESPONSE`. */
export const ForgotPasswordRequest = z.strictObject({ email: Email });

/** `POST /auth/password/reset` → `204` (revoga todas as sessões). */
export const ResetPasswordRequest = z.strictObject({
  token: z.string().min(16).max(512),
  password: Password,
});

// ------------------------------------------------------------------ perfil (§2.7–§2.13)

export const ShippingAddress = z
  .strictObject({
    zip_code: z.string().regex(/^\d{5}-?\d{3}$/),
    street: z.string().min(1).max(200),
    number: z.string().min(1).max(20),
    complement: z.string().max(100).optional(),
    district: z.string().min(1).max(100),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
  })
  .meta({ id: 'ShippingAddress' });

/** `GET /me` — dados do titular, mascarados (ADR-0012). */
export const MeResponse = z
  .object({
    id: Uuid,
    account_type: AccountType,
    pseudonym: Pseudonym,
    name: z.string(),
    /** E-mail mascarado (`c•••••@example.com`). */
    email: z.string(),
    /** Documento mascarado (`***.456.789-**`). */
    document_masked: z.string(),
    status: AccountStatus,
    roles: z.array(Role),
    score: z.object({
      value: z.int().min(0).max(1000),
      band: ScoreBand,
      model_version: z.string(),
    }),
    company: CompanyInfo.nullable(),
    payout_recipient: z.object({
      status: z.enum(['NOT_REGISTERED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']),
    }),
    consents: z.object({ terms: LegalVersion, privacy: LegalVersion, marketing: z.boolean() }),
    preferences: z.object({ reduce_motion: z.boolean() }),
  })
  .meta({ id: 'MeResponse' });
export type MeResponse = z.infer<typeof MeResponse>;

/** `PATCH /me` (com `If-Match`). `cpf`/`cnpj` só para conta `INCOMPLETE`. */
export const UpdateMeRequest = z.strictObject({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .regex(/^\+?\d{10,14}$/)
    .optional(),
  shipping_address: ShippingAddress.optional(),
  nickname: z
    .string()
    .regex(/^[\p{L}\p{N}_.-]{3,24}$/u)
    .optional(),
  preferences: z.strictObject({ reduce_motion: z.boolean() }).optional(),
  cpf: CpfInput.optional(),
  cnpj: CnpjInput.optional(),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

/** `POST /me/company/verification` → `202`. */
export const CompanyVerificationResponse = z.object({
  verification_status: z.literal('PENDING_VERIFICATION'),
  check_id: Uuid,
});

/** `POST /me/payout-recipient`. */
export const PayoutRecipientRequest = z.strictObject({
  bank_account: z.strictObject({
    bank: z.string().regex(/^\d{3}$/),
    branch: z.string().regex(/^\d{1,5}(-?\d)?$/),
    account: z.string().regex(/^\d{1,13}-?[\dXx]?$/),
    type: z.enum(['CHECKING', 'SAVINGS']),
  }),
  holder_document: z.union([CpfInput, CnpjInput]),
});

export const PayoutRecipientResponse = z.object({
  status: z.enum(['NOT_REGISTERED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']),
});

/** Finalidade de consentimento (§2.11). */
export const ConsentPurpose = z.enum(['terms', 'privacy', 'marketing']);

export const ConsentRecord = z.object({
  purpose: ConsentPurpose,
  version: z.string().nullable(),
  granted: z.boolean(),
  at: IsoDateTime,
  channel: z.string(),
});

export const ConsentHistoryResponse = z.array(ConsentRecord);

/** `POST /me/consents` — só `marketing` (revogar termos/privacidade = encerrar conta). */
export const GrantConsentRequest = z.strictObject({
  purpose: z.literal('marketing'),
  granted: z.boolean(),
});

/** Exportação de dados (LGPD art. 18 — §2.12). */
export const DataExportResponse = z
  .object({
    id: Uuid,
    status: z.enum(['PROCESSING', 'READY', 'EXPIRED', 'FAILED']),
    due_by: IsoDateTime.optional(),
    download_url: z.url().optional(),
    expires_at: IsoDateTime.optional(),
  })
  .meta({ id: 'DataExportResponse' });

/** `POST /me/deletion-request` (§2.13). */
export const DeletionRequest = z.strictObject({
  reason: z.string().max(1000).optional(),
  password: z.string().min(1).max(128),
});

export const DeletionScheduledResponse = z.object({
  status: z.literal('SCHEDULED'),
  effective_at: IsoDateTime,
});
