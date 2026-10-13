/**
 * Modelo de erro RFC 9457 (`application/problem+json`) e catálogo de códigos
 * (api-rest.md §1.4 e §1.4.1; guia de desenvolvimento §5.3).
 *
 * - `code` é o contrato estável que o front usa para escolher a microcopy; `detail` é
 *   informativo e o front não depende dele.
 * - Mensagens com `normative: true` vêm da Spec F1/F4/F5/F8 e devem ser usadas **exatamente**
 *   com este texto.
 * - Nenhum erro carrega PII (CPF, CNPJ, e-mail) nem stack trace (ADR-0012).
 * - **Anti-enumeração (SEC-08/SEC-22):** não existe código de "e-mail/documento já cadastrado"
 *   no cadastro nem na recuperação de senha — ver `api/identity.ts`.
 *   `DOCUMENT_ALREADY_REGISTERED` só ocorre em `PATCH /me` de conta autenticada `INCOMPLETE`.
 * - Novos códigos são mudança **aditiva** (api-rest §1.1): no schema de resposta `code` é
 *   `string` (o cliente trata código desconhecido pelo `status`); o produtor usa o tipo
 *   fechado `ErrorCode`.
 */
import { z } from 'zod';

/** Media type de erro (RFC 9457 §3). */
export const PROBLEM_JSON_MEDIA_TYPE = 'application/problem+json' as const;

/** Base dos URIs de `type`. Cada código vira `<base><código em kebab-case>`. */
export const PROBLEM_TYPE_BASE_URL = 'https://api.bolhavenda.com.br/problems/' as const;

/** Grupo do catálogo (seções de api-rest §1.4.1). */
export type ErrorGroup =
  'platform' | 'identity' | 'bubble' | 'quota-payment' | 'bidding' | 'triage-reputation';

export interface ErrorDefinition {
  /** Status HTTP. */
  readonly status: number;
  /** `title` do problem+json (curto, pt-BR, estável por código). */
  readonly title: string;
  /** Mensagem ao usuário, quando o contrato a define (`{campo}` = valor do corpo do erro). */
  readonly message?: string;
  /** `true` quando a mensagem é normativa (Spec) — usar exatamente este texto. */
  readonly normative?: boolean;
  readonly group: ErrorGroup;
}

/**
 * Catálogo completo (api-rest §1.4.1), na ordem do documento. Em conflito com o guia de
 * desenvolvimento §5.3, prevalece api-rest (divergência registrada no log da sessão BV-111 em 002-llm/001 log/).
 */
export const ERROR_CATALOG = {
  // ------------------------------------------------------------ genéricos e de plataforma
  VALIDATION_FAILED: { status: 422, title: 'Dados inválidos', group: 'platform' },
  UNAUTHENTICATED: { status: 401, title: 'Autenticação necessária', group: 'platform' },
  TOKEN_EXPIRED: { status: 401, title: 'Token expirado', group: 'platform' },
  REFRESH_TOKEN_REUSED: { status: 401, title: 'Sessão revogada', group: 'platform' },
  FORBIDDEN: { status: 403, title: 'Acesso negado', group: 'platform' },
  ACCOUNT_SUSPENDED: { status: 403, title: 'Conta suspensa', group: 'platform' },
  ACCOUNT_INCOMPLETE: { status: 403, title: 'Cadastro incompleto', group: 'platform' },
  NOT_FOUND: { status: 404, title: 'Recurso não encontrado', group: 'platform' },
  VERSION_CONFLICT: { status: 412, title: 'Versão desatualizada', group: 'platform' },
  IDEMPOTENCY_KEY_MISSING: {
    status: 400,
    title: 'Idempotency-Key obrigatória',
    group: 'platform',
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    title: 'Idempotency-Key reutilizada com outro corpo',
    group: 'platform',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    status: 409,
    title: 'Requisição original em processamento',
    group: 'platform',
  },
  RATE_LIMITED: { status: 429, title: 'Muitas requisições', group: 'platform' },
  CAPTCHA_REQUIRED: { status: 428, title: 'Verificação anti-bot necessária', group: 'platform' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Serviço indisponível', group: 'platform' },
  INTERNAL_ERROR: { status: 500, title: 'Erro interno', group: 'platform' },

  // ------------------------------------------------------------ identidade e LGPD (F1)
  INVALID_CREDENTIALS: {
    status: 401,
    title: 'Credenciais inválidas',
    // Não revela se o e-mail existe (anti-enumeração).
    message: 'E-mail ou senha incorretos.',
    group: 'identity',
  },
  DOCUMENT_ALREADY_REGISTERED: { status: 409, title: 'Documento já cadastrado', group: 'identity' },
  CPF_INVALID: { status: 422, title: 'CPF inválido', group: 'identity' },
  CNPJ_INVALID: { status: 422, title: 'CNPJ inválido', group: 'identity' },
  CNPJ_NOT_ACTIVE: {
    status: 422,
    title: 'CNPJ irregular',
    message: 'CNPJ com situação cadastral irregular',
    normative: true,
    group: 'identity',
  },
  ACCOUNT_NOT_VERIFIED: {
    status: 403,
    title: 'CNPJ não verificado',
    message: 'Conclua a verificação do CNPJ para participar.',
    normative: true,
    group: 'identity',
  },
  RECIPIENT_NOT_REGISTERED: { status: 403, title: 'Recebedor não cadastrado', group: 'identity' },
  CONSENT_REQUIRED: { status: 422, title: 'Aceite dos termos necessário', group: 'identity' },
  NICKNAME_UNAVAILABLE: { status: 409, title: 'Apelido indisponível', group: 'identity' },
  EXPORT_ALREADY_IN_PROGRESS: {
    status: 409,
    title: 'Exportação já em andamento',
    group: 'identity',
  },
  DELETION_BLOCKED_OBLIGATIONS: {
    status: 409,
    title: 'Exclusão bloqueada por obrigações pendentes',
    group: 'identity',
  },

  // ------------------------------------------------------------ bolha (F3, F4)
  BUBBLE_NOT_FOUND: { status: 404, title: 'Bolha não encontrada', group: 'bubble' },
  BUBBLE_NOT_DRAFT: { status: 409, title: 'Bolha não está em rascunho', group: 'bubble' },
  FIELD_LOCKED_AFTER_PUBLISH: {
    status: 409,
    title: 'Campo bloqueado após a publicação',
    group: 'bubble',
  },
  BUBBLE_NOT_ACTIVE: {
    status: 409,
    title: 'Bolha encerrada',
    message: 'Esta bolha já foi encerrada.',
    normative: true,
    group: 'bubble',
  },
  BUBBLE_EXIT_LOCKED: {
    status: 409,
    title: 'Saída bloqueada na última hora',
    message: 'Saídas são bloqueadas na última hora para proteger o grupo',
    normative: true,
    group: 'bubble',
  },
  BUBBLE_HAS_QUOTAS: { status: 409, title: 'Bolha já tem cotas', group: 'bubble' },
  INVALID_PRICE_TIERS: { status: 422, title: 'Degraus de preço inválidos', group: 'bubble' },
  INVALID_DURATION: { status: 422, title: 'Duração inválida', group: 'bubble' },
  INVALID_QUOTA_RANGE: { status: 422, title: 'Quantidade de cotas inválida', group: 'bubble' },
  INVALID_PJ_SHARE: { status: 422, title: 'Teto PJ inválido', group: 'bubble' },
  INVALID_SHIPPING_DAYS: { status: 422, title: 'Prazo de envio inválido', group: 'bubble' },
  WRONG_BUBBLE_TYPE: { status: 409, title: 'Operação incompatível com o tipo', group: 'bubble' },

  // ------------------------------------------------------------ cota e pagamento (F5)
  QUOTA_SOLD_OUT: {
    status: 409,
    title: 'Cotas esgotadas',
    // Variante com `pending_reservations > 0`: QUOTA_SOLD_OUT_PENDING_MESSAGE.
    message: 'As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.',
    normative: true,
    group: 'quota-payment',
  },
  PIX_UNAVAILABLE_LATE: {
    status: 422,
    title: 'Pix indisponível no fim da bolha',
    message: 'Faltam menos de 5 minutos: use cartão para entrar.',
    group: 'quota-payment',
  },
  PIX_TEMPORARILY_BLOCKED: {
    status: 429,
    title: 'Pix temporariamente indisponível',
    message: 'Pix temporariamente indisponível para sua conta. Use cartão ou tente mais tarde.',
    group: 'quota-payment',
  },
  CREATOR_QUOTA_NOT_AUTHORIZED: {
    status: 402,
    title: 'Cota do criador não autorizada',
    message: 'Não foi possível autorizar sua cota. A bolha não foi publicada.',
    normative: true,
    group: 'quota-payment',
  },
  PF_QUOTA_LIMIT: {
    status: 409,
    title: 'Limite de 1 cota por pessoa',
    message: 'Você já participa desta bolha (limite de 1 cota por pessoa).',
    normative: true,
    group: 'quota-payment',
  },
  PJ_SHARE_EXCEEDED: {
    status: 409,
    title: 'Teto de cotas da empresa excedido',
    message: 'Sua empresa pode ocupar no máximo {max_allowed} cotas nesta bolha.',
    normative: true,
    group: 'quota-payment',
  },
  CREATOR_CANNOT_JOIN: {
    status: 409,
    title: 'Criador não participa da própria bolha',
    message: 'Você não pode participar da própria bolha.',
    normative: true,
    group: 'quota-payment',
  },
  PAYMENT_DECLINED: {
    status: 402,
    title: 'Pagamento não autorizado',
    message: 'O pagamento não foi autorizado. Tente outra forma de pagamento.',
    normative: true,
    group: 'quota-payment',
  },
  QUOTA_EXCEEDS_AVAILABLE: {
    status: 409,
    title: 'Quantidade acima das cotas disponíveis',
    group: 'quota-payment',
  },
  QUOTA_NOT_FOUND: { status: 404, title: 'Cota não encontrada', group: 'quota-payment' },
  PAYMENT_METHOD_UNSUPPORTED: {
    status: 422,
    title: 'Método de pagamento não aceito',
    group: 'quota-payment',
  },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    status: 503,
    title: 'Gateway de pagamento indisponível',
    group: 'quota-payment',
  },
  PIX_RESERVATION_EXPIRED: { status: 409, title: 'Reserva Pix expirada', group: 'quota-payment' },
  WEBHOOK_SIGNATURE_INVALID: {
    status: 401,
    title: 'Assinatura do webhook inválida',
    group: 'quota-payment',
  },

  // ------------------------------------------------------------ lances (F8 — ADR-0005)
  BID_ABOVE_TARGET: {
    status: 422,
    title: 'Lance acima do preço-alvo',
    // `{target_price}` é formatado em reais (R$ X) pelo front a partir do corpo do erro.
    message: 'O lance precisa ser igual ou menor que o preço-alvo de {target_price}',
    normative: true,
    group: 'bidding',
  },
  BID_NOT_FOUND: { status: 404, title: 'Lance não encontrado', group: 'bidding' },
  BID_WITHDRAW_NOT_ALLOWED: {
    status: 409,
    title: 'Retirada de lance não permitida',
    group: 'bidding',
  },
  BID_SELECTION_NOT_OPEN: { status: 409, title: 'Seleção de lance fechada', group: 'bidding' },
  BID_SELECTION_WINDOW_CLOSED: {
    status: 409,
    title: 'Prazo de seleção encerrado',
    group: 'bidding',
  },

  // ------------------------------------------------------------ triagem, score e moderação
  TRIAGE_INVALID_TRANSITION: {
    status: 409,
    title: 'Ação incompatível com o status do item',
    group: 'triage-reputation',
  },
  SHIPPING_DEADLINE_PASSED: {
    status: 409,
    title: 'Prazo de envio encerrado',
    group: 'triage-reputation',
  },
  WITHDRAWAL_WINDOW_CLOSED: {
    status: 409,
    title: 'Prazo de arrependimento encerrado',
    group: 'triage-reputation',
  },
  TRIAGE_CASE_ALREADY_OPEN: {
    status: 409,
    title: 'Caso já aberto para o item',
    group: 'triage-reputation',
  },
  TRIAGE_CASE_WINDOW_CLOSED: {
    status: 409,
    title: 'Prazo para abrir caso encerrado',
    group: 'triage-reputation',
  },
  TRIAGE_NOT_LATE: { status: 409, title: 'Item não está atrasado', group: 'triage-reputation' },
  DISPUTE_WINDOW_CLOSED: {
    status: 409,
    title: 'Prazo de contestação encerrado',
    group: 'triage-reputation',
  },
  DISPUTE_ALREADY_OPEN: { status: 409, title: 'Contestação já aberta', group: 'triage-reputation' },
  SCORE_EVENT_NOT_DISPUTABLE: {
    status: 409,
    title: 'Evento de score não contestável',
    group: 'triage-reputation',
  },
  REPORT_ALREADY_SUBMITTED: {
    status: 409,
    title: 'Denúncia já registrada',
    group: 'triage-reputation',
  },
} as const satisfies Record<string, ErrorDefinition>;

/** Mensagem normativa de `QUOTA_SOLD_OUT` quando há reservas Pix pendentes (Spec F5). */
export const QUOTA_SOLD_OUT_PENDING_MESSAGE =
  'Cotas esgotadas — {pending_reservations} reservas aguardando pagamento' as const;

type CatalogCode = keyof typeof ERROR_CATALOG;

/** Todos os códigos do catálogo, na ordem do documento. */
export const ERROR_CODES = Object.keys(ERROR_CATALOG) as [CatalogCode, ...CatalogCode[]];

/** Código de erro do catálogo (tipo fechado — para o produtor). */
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Indica se uma string é um código conhecido do catálogo. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CATALOG, value);
}

/** Definição de um código do catálogo. */
export function getErrorDefinition(code: ErrorCode): ErrorDefinition {
  return ERROR_CATALOG[code];
}

/** URI de `type` do código (ex.: `QUOTA_SOLD_OUT` → `…/problems/quota-sold-out`). */
export function problemTypeUri(code: ErrorCode): string {
  return `${PROBLEM_TYPE_BASE_URL}${code.toLowerCase().replaceAll('_', '-')}`;
}

// ------------------------------------------------------------------ schemas

/** Item de `errors[]` em `VALIDATION_FAILED` (api-rest §1.4). */
export const FieldError = z
  .object({
    /** Caminho do campo (ex.: `price_tiers[2].unit_price`). */
    field: z.string(),
    /** Código específico do campo (ex.: `NOT_NON_INCREASING`). */
    code: z.string(),
    message: z.string(),
  })
  .meta({ id: 'FieldError' });
export type FieldError = z.infer<typeof FieldError>;

/**
 * Corpo `application/problem+json`. Objeto **aberto**: membros de extensão por código
 * (ex.: `available_quotas`, `pending_reservations`, `max_allowed`) são preservados.
 */
export const ProblemDetails = z
  .looseObject({
    type: z.url(),
    title: z.string(),
    status: z.int().min(400).max(599),
    detail: z.string().optional(),
    instance: z.string().optional(),
    /** Código estável do catálogo (`ErrorCode`). Novos códigos são aditivos. */
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    trace_id: z.string().optional(),
    errors: z.array(FieldError).optional(),
  })
  .meta({
    id: 'ProblemDetails',
    description:
      'Erro RFC 9457 (application/problem+json). `code` segue o catálogo de api-rest.md §1.4.1; membros de extensão variam por código.',
  });
export type ProblemDetails = z.infer<typeof ProblemDetails>;

// ---- membros de extensão tipados (api-rest §1.4.1, §4.1)

/** `QUOTA_SOLD_OUT` / `QUOTA_EXCEEDS_AVAILABLE`. */
export const QuotaAvailabilityExtension = z.object({
  bubble_id: z.uuid().optional(),
  available_quotas: z.int().nonnegative(),
  /** > 0 quando as vagas restantes estão só reservadas (Pix pendente). */
  pending_reservations: z.int().nonnegative().optional(),
});

/** `PJ_SHARE_EXCEEDED`. */
export const PjShareExtension = z.object({
  max_allowed: z.int().nonnegative(),
  already_held: z.int().nonnegative(),
});

/** `PIX_TEMPORARILY_BLOCKED` — segundos até poder tentar de novo. */
export const PixBlockedExtension = z.object({ retry_after: z.int().nonnegative() });

/** `BID_ABOVE_TARGET` — preço-alvo em centavos. */
export const BidAboveTargetExtension = z.object({ target_price: z.int().nonnegative() });

/** `DELETION_BLOCKED_OBLIGATIONS`. */
export const DeletionBlockedExtension = z.object({
  blocking_items: z.array(
    z.object({
      kind: z.enum(['ACTIVE_QUOTA', 'OPEN_TRIAGE']),
      id: z.uuid(),
      bubble_id: z.uuid().optional(),
    }),
  ),
});

/** Membros de extensão conhecidos por código (os demais códigos não têm extensão tipada). */
export const PROBLEM_EXTENSIONS = {
  QUOTA_SOLD_OUT: QuotaAvailabilityExtension,
  QUOTA_EXCEEDS_AVAILABLE: QuotaAvailabilityExtension,
  PJ_SHARE_EXCEEDED: PjShareExtension,
  PIX_TEMPORARILY_BLOCKED: PixBlockedExtension,
  BID_ABOVE_TARGET: BidAboveTargetExtension,
  DELETION_BLOCKED_OBLIGATIONS: DeletionBlockedExtension,
} as const satisfies Partial<Record<ErrorCode, z.ZodType>>;

export type ProblemExtensionOf<C extends ErrorCode> = C extends keyof typeof PROBLEM_EXTENSIONS
  ? z.infer<(typeof PROBLEM_EXTENSIONS)[C]>
  : Record<string, string | number | boolean | null>;

export interface ProblemInit<C extends ErrorCode> {
  detail?: string;
  instance?: string;
  trace_id?: string;
  errors?: FieldError[];
  extensions?: ProblemExtensionOf<C>;
}

/**
 * Monta um problem+json do catálogo. `detail` padrão = mensagem do catálogo, quando ela não
 * tem placeholders. Não inclua PII em `detail` nem em `extensions` (ADR-0012).
 */
export function createProblem<C extends ErrorCode>(
  code: C,
  init: ProblemInit<C> = {},
): ProblemDetails {
  const def: ErrorDefinition = ERROR_CATALOG[code];
  const fallback = def.message?.includes('{') ? undefined : def.message;
  const detail = init.detail ?? fallback;
  return {
    ...(init.extensions ?? {}),
    type: problemTypeUri(code),
    title: def.title,
    status: def.status,
    code,
    ...(detail === undefined ? {} : { detail }),
    ...(init.instance === undefined ? {} : { instance: init.instance }),
    ...(init.trace_id === undefined ? {} : { trace_id: init.trace_id }),
    ...(init.errors === undefined ? {} : { errors: init.errors }),
  };
}
