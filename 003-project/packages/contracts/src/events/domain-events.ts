/**
 * Eventos de domínio serializados no outbox (eventos-dominio.md §1 e §2; ADR-0010).
 *
 * - Envelope = colunas de `outbox_events` (`event_id`, `event_type`, `event_version`,
 *   `aggregate_type`, `aggregate_id`, `occurred_at`, `trace_parent`, `payload`).
 * - Eventos carregam **fatos** no passado, **sem PII** (ids, pseudônimos, valores, datas).
 * - Versionamento: `event_version` inteiro. Campo novo **opcional** não muda a versão;
 *   mudança incompatível publica `v2` em paralelo com `v1` até migrar os consumidores
 *   (consumidores aceitam N e N−1 durante um release — guia §7.8).
 * - Validados no produtor (teste) e no consumidor (runtime) — `parseDomainEvent`.
 * - Payloads são objetos abertos no consumidor (*tolerant reader*): campos desconhecidos
 *   são descartados, não rejeitados.
 */
import { z } from 'zod';
import {
  AccountType,
  BubbleStatus,
  BubbleType,
  ExplosionOutcome,
  ExplosionReason,
  IsoDateTime,
  PaymentMethod,
  ScoreBand,
  Uuid,
} from '../common.js';

const Cents = z.int().nonnegative();
const Count = z.int().nonnegative();
const Version = z.int().nonnegative();

const PriceTierPayload = z.object({ min_filled_quotas: Count, unit_price: Cents });
const NextTierPayload = z.object({ min_filled_quotas: Count, unit_price: Cents });

// ------------------------------------------------------------------ payloads v1 (§2.2)

export const BubblePublishedV1 = z.object({
  bubble_id: Uuid,
  type: BubbleType,
  creator_pseudonym: z.string(),
  category: z.string(),
  canvas: z.object({ x: z.number(), y: z.number() }),
  tile: z.string(),
  starts_at: IsoDateTime,
  expires_at: IsoDateTime,
  min_quotas: z.int().positive(),
  max_quotas: z.int().positive(),
  /** Percentual inteiro (10–100) — no evento; na REST é fração (0,10–1,00). */
  max_pj_share: z.int().min(10).max(100),
  /** Vazio em PURCHASE. */
  price_tiers: z.array(PriceTierPayload),
  target_price: Cents.nullable().optional(),
  version: Version,
});

export const BubbleCancelledV1 = z.object({
  bubble_id: Uuid,
  from_status: BubbleStatus,
  reason: z.enum([
    'CANCELLED_BY_CREATOR',
    'CANCELLED_BY_MODERATION',
    'GOAL_NOT_MET',
    'NO_VALID_BID',
    'TRIAGE_ALL_CANCELLED',
    'ACCOUNT_SUSPENDED',
  ]),
  cancelled_by: z.enum(['CREATOR', 'MODERATOR', 'SYSTEM']),
  refund_policy: z.enum(['FULL', 'NONE']),
  version: Version,
});

/** (proposto) Reserva Pix criada. */
export const QuotaReservedV1 = z.object({
  bubble_id: Uuid,
  quota_id: Uuid,
  payment_id: Uuid,
  quantity: z.int().positive(),
  account_type: AccountType,
  reserved_until: IsoDateTime,
  filled_quotas: Count,
  reserved_quotas: Count,
  version: Version,
});

export const QuotaAcquiredV1 = z.object({
  bubble_id: Uuid,
  quota_id: Uuid,
  payment_id: Uuid,
  participant_pseudonym: z.string(),
  account_type: AccountType,
  quantity: z.int().positive(),
  filled_quotas: Count,
  reserved_quotas: Count,
  max_quotas: z.int().positive(),
  current_unit_price: Cents.nullable(),
  tier_changed: z.boolean(),
  next_tier: NextTierPayload.nullable(),
  version: Version,
});

export const QuotaReleasedV1 = z.object({
  bubble_id: Uuid,
  quota_id: Uuid,
  payment_id: Uuid,
  quantity: z.int().positive(),
  reason: z.enum([
    'USER_LEFT',
    'RESERVATION_EXPIRED',
    'BUBBLE_EXPLODED_UNPAID',
    'ACCOUNT_SUSPENDED',
  ]),
  filled_quotas: Count,
  reserved_quotas: Count,
  current_unit_price: Cents.nullable(),
  tier_changed: z.boolean(),
  version: Version,
});

export const BubbleExplodedV1 = z.object({
  bubble_id: Uuid,
  type: BubbleType,
  outcome: ExplosionOutcome,
  reason: ExplosionReason,
  filled_quotas: Count,
  max_quotas: z.int().positive(),
  min_quotas: z.int().positive(),
  /** `null` em PURCHASE com sucesso (preço sai da seleção do lance). */
  final_unit_price: Cents.nullable(),
  exploded_at: IsoDateTime,
  bid_selection_deadline: IsoDateTime.nullable(),
  cancelled_reservations: Count,
  version: Version,
});

export const BidSubmittedV1 = z.object({
  bubble_id: Uuid,
  bid_id: Uuid,
  bidder_pseudonym: z.string(),
  bidder_score_band: ScoreBand,
  unit_price: Cents,
  delivery_days: z.int().positive(),
  replaces_bid_id: Uuid.nullable(),
  submitted_at: IsoDateTime,
});

export const BidWithdrawnV1 = z.object({
  bubble_id: Uuid,
  bid_id: Uuid,
  reason: z.enum(['WITHDRAWN_BY_BIDDER', 'REPLACED', 'BUBBLE_CANCELLED']),
  replaced_by_bid_id: Uuid.nullable(),
});

export const BidSelectedV1 = z.object({
  bubble_id: Uuid,
  bid_id: Uuid,
  mode: z.enum(['CREATOR', 'AUTO_TIMEOUT']),
  unit_price: Cents,
  seller_account_id: Uuid,
  selected_at: IsoDateTime,
});

export const PaymentAuthorizedV1 = z.object({
  payment_id: Uuid,
  bubble_id: Uuid,
  quota_id: Uuid,
  method: PaymentMethod,
  authorized_amount: Cents,
  gateway_charge_id: z.string(),
  authorized_at: IsoDateTime,
});

export const PaymentCapturedV1 = z.object({
  payment_id: Uuid,
  bubble_id: Uuid,
  quota_id: Uuid,
  method: PaymentMethod,
  authorized_amount: Cents,
  captured_amount: Cents,
  released_amount: Cents,
  captured_at: IsoDateTime,
});

export const PaymentRefundedV1 = z.object({
  payment_id: Uuid,
  refund_id: Uuid,
  kind: z.enum(['VOID', 'PARTIAL', 'FULL']),
  amount: Cents,
  reason: z.string(),
  completed_at: IsoDateTime,
});

export const PaymentFailedV1 = z.object({
  payment_id: Uuid,
  bubble_id: Uuid,
  quota_id: Uuid,
  stage: z.enum(['AUTHORIZE', 'CAPTURE']),
  cause: z.string(),
  gateway_code: z.string().nullable().optional(),
});

export const TriageOpenedV1 = z.object({
  bubble_id: Uuid,
  seller_account_id: Uuid,
  items_open: Count,
  items_cancelled: Count,
  opened_at: IsoDateTime,
});

export const ShipmentRegisteredV1 = z.object({
  triage_item_id: Uuid,
  bubble_id: Uuid,
  carrier: z.string(),
  on_time: z.boolean(),
  shipped_at: IsoDateTime,
  auto_confirm_at: IsoDateTime,
});

export const DeliveryConfirmedV1 = z.object({
  triage_item_id: Uuid,
  confirmation: z.enum(['BUYER', 'AUTO']),
  delivered_at: IsoDateTime,
  withdrawal_deadline: IsoDateTime,
});

export const WithdrawalRequestedV1 = z.object({
  triage_item_id: Uuid,
  requested_at: IsoDateTime,
  return_deadline: IsoDateTime,
});

export const TriageItemCompletedV1 = z.object({
  triage_item_id: Uuid,
  bubble_id: Uuid,
  buyer_id: Uuid,
  seller_id: Uuid,
  amount: Cents,
  completed_at: IsoDateTime,
});

export const TriageItemCancelledV1 = z.object({
  triage_item_id: Uuid,
  bubble_id: Uuid,
  reason: z.enum([
    'SHIPPING_TIMEOUT',
    'BUYER_CANCELLED_LATE',
    'CAPTURE_FAILED',
    'WITHDRAWAL_RETURNED',
    'CASE_FULL_REFUND',
    'MODERATION',
  ]),
  fault: z.enum(['SELLER', 'BUYER', 'NONE']),
  refund_amount: Cents,
  cancelled_at: IsoDateTime,
});

export const TriageClosedV1 = z.object({
  bubble_id: Uuid,
  outcome: z.enum(['COMPLETED', 'CANCELLED']),
  items_completed: Count,
  items_cancelled: Count,
});

export const PayoutReleasedV1 = z.object({
  payout_id: Uuid,
  triage_item_id: Uuid,
  seller_id: Uuid,
  gross_amount: Cents,
  platform_fee: Cents,
  gateway_fee: Cents,
  net_amount: Cents,
  released_at: IsoDateTime,
});

export const ScoreChangedV1 = z.object({
  account_id: Uuid,
  score_event_id: Uuid,
  kind: z.string(),
  points: z.int(),
  old_score: z.int().min(0).max(1000),
  new_score: z.int().min(0).max(1000),
  band: ScoreBand,
  model_version: z.string(),
});

export const ScoreDisputeOpenedV1 = z.object({
  dispute_id: Uuid,
  score_event_id: Uuid,
  account_id: Uuid,
  opened_at: IsoDateTime,
});

export const ScoreDisputeResolvedV1 = z.object({
  dispute_id: Uuid,
  score_event_id: Uuid,
  decision: z.enum(['UPHELD', 'REJECTED']),
  decided_at: IsoDateTime,
});

/** (proposto) */
export const TriageCaseOpenedV1 = z.object({
  case_id: Uuid,
  triage_item_id: Uuid,
  reason_code: z.enum(['NOT_RECEIVED', 'DIFFERENT_PRODUCT', 'DEFECTIVE']),
  item_status_at_open: z.enum(['SHIPPED', 'DELIVERED']),
  /** Duração ISO 8601 restante do prazo pausado (ex.: `P4DT6H`). */
  paused_remaining: z.string(),
  opened_at: IsoDateTime,
});

/** (proposto) */
export const TriageCaseDecidedV1 = z.object({
  case_id: Uuid,
  triage_item_id: Uuid,
  decision: z.enum(['FULL_REFUND', 'PARTIAL_REFUND', 'UNFOUNDED']),
  refund_amount: Cents,
  final_amount: Cents,
  against_seller: z.boolean(),
  decided_at: IsoDateTime,
});

/** (proposto) */
export const AccountSuspendedV1 = z.object({
  account_id: Uuid,
  suspension_id: Uuid,
  source_type: z.enum(['REPORT', 'TRIAGE_CASE', 'MANUAL']),
  suspended_at: IsoDateTime,
});

// ------------------------------------------------------------------ catálogo (§2.1)

export type AggregateType =
  | 'bubble'
  | 'bid'
  | 'payment'
  | 'triage_item'
  | 'triage_case'
  | 'account'
  | 'payout'
  | 'score_dispute';

/**
 * Catálogo versionado: `event_type` → `{ aggregate, versions: { [n]: payload } }`.
 * Para criar `v2`, adicione a chave `2` mantendo a `1` até migrar os consumidores.
 */
export const DOMAIN_EVENTS = {
  BubblePublished: { aggregate: 'bubble', versions: { 1: BubblePublishedV1 } },
  BubbleCancelled: { aggregate: 'bubble', versions: { 1: BubbleCancelledV1 } },
  QuotaReserved: { aggregate: 'bubble', versions: { 1: QuotaReservedV1 } },
  QuotaAcquired: { aggregate: 'bubble', versions: { 1: QuotaAcquiredV1 } },
  QuotaReleased: { aggregate: 'bubble', versions: { 1: QuotaReleasedV1 } },
  BubbleExploded: { aggregate: 'bubble', versions: { 1: BubbleExplodedV1 } },
  BidSubmitted: { aggregate: 'bubble', versions: { 1: BidSubmittedV1 } },
  BidWithdrawn: { aggregate: 'bubble', versions: { 1: BidWithdrawnV1 } },
  BidSelected: { aggregate: 'bubble', versions: { 1: BidSelectedV1 } },
  PaymentAuthorized: { aggregate: 'payment', versions: { 1: PaymentAuthorizedV1 } },
  PaymentCaptured: { aggregate: 'payment', versions: { 1: PaymentCapturedV1 } },
  PaymentRefunded: { aggregate: 'payment', versions: { 1: PaymentRefundedV1 } },
  PaymentFailed: { aggregate: 'payment', versions: { 1: PaymentFailedV1 } },
  TriageOpened: { aggregate: 'bubble', versions: { 1: TriageOpenedV1 } },
  ShipmentRegistered: { aggregate: 'triage_item', versions: { 1: ShipmentRegisteredV1 } },
  DeliveryConfirmed: { aggregate: 'triage_item', versions: { 1: DeliveryConfirmedV1 } },
  WithdrawalRequested: { aggregate: 'triage_item', versions: { 1: WithdrawalRequestedV1 } },
  TriageItemCompleted: { aggregate: 'triage_item', versions: { 1: TriageItemCompletedV1 } },
  TriageItemCancelled: { aggregate: 'triage_item', versions: { 1: TriageItemCancelledV1 } },
  TriageClosed: { aggregate: 'bubble', versions: { 1: TriageClosedV1 } },
  PayoutReleased: { aggregate: 'payout', versions: { 1: PayoutReleasedV1 } },
  ScoreChanged: { aggregate: 'account', versions: { 1: ScoreChangedV1 } },
  ScoreDisputeOpened: { aggregate: 'score_dispute', versions: { 1: ScoreDisputeOpenedV1 } },
  ScoreDisputeResolved: { aggregate: 'score_dispute', versions: { 1: ScoreDisputeResolvedV1 } },
  TriageCaseOpened: { aggregate: 'triage_case', versions: { 1: TriageCaseOpenedV1 } },
  TriageCaseDecided: { aggregate: 'triage_case', versions: { 1: TriageCaseDecidedV1 } },
  AccountSuspended: { aggregate: 'account', versions: { 1: AccountSuspendedV1 } },
} as const satisfies Record<
  string,
  { aggregate: AggregateType; versions: Record<number, z.ZodObject> }
>;

export type DomainEventType = keyof typeof DOMAIN_EVENTS;
export const DOMAIN_EVENT_TYPES = Object.keys(DOMAIN_EVENTS) as [
  DomainEventType,
  ...DomainEventType[],
];
export const DomainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);

type Versions<T extends DomainEventType> = (typeof DOMAIN_EVENTS)[T]['versions'];
export type DomainEventVersion<T extends DomainEventType> = keyof Versions<T> & number;
export type DomainEventPayload<
  T extends DomainEventType,
  V extends DomainEventVersion<T> = DomainEventVersion<T>,
> = z.infer<Versions<T>[V] & z.ZodType>;

/** `traceparent` W3C (`00-<trace>-<span>-<flags>`). */
export const TraceParent = z.string().regex(/^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/);

/** Envelope genérico (payload ainda não validado). */
export const DomainEventEnvelope = z.object({
  event_id: Uuid,
  event_type: z.string().min(1),
  event_version: z.int().positive(),
  aggregate_type: z.string().min(1),
  aggregate_id: Uuid,
  occurred_at: IsoDateTime,
  trace_parent: TraceParent.nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelope>;

/** Envelope tipado de um evento/versão. */
export interface DomainEvent<
  T extends DomainEventType = DomainEventType,
  V extends DomainEventVersion<T> = DomainEventVersion<T>,
> {
  event_id: string;
  event_type: T;
  event_version: V;
  aggregate_type: AggregateType;
  aggregate_id: string;
  occurred_at: string;
  trace_parent?: string | null;
  payload: DomainEventPayload<T, V>;
}

/** Schema do payload de um evento/versão, ou `undefined` se não existir. */
export function domainEventPayloadSchema(type: string, version: number): z.ZodObject | undefined {
  if (!Object.hasOwn(DOMAIN_EVENTS, type)) return undefined;
  const versions: Record<number, z.ZodObject> = DOMAIN_EVENTS[type as DomainEventType].versions;
  return Object.hasOwn(versions, version) ? versions[version] : undefined;
}

export type ParseDomainEventResult =
  | { ok: true; event: DomainEvent }
  | {
      ok: false;
      reason: 'INVALID_ENVELOPE' | 'UNKNOWN_EVENT' | 'INVALID_PAYLOAD';
      issues: string[];
    };

/**
 * Valida envelope + payload no consumidor. Evento/versão desconhecido → `UNKNOWN_EVENT`
 * (o consumidor decide se ignora ou manda para a DLQ).
 */
export function parseDomainEvent(raw: unknown): ParseDomainEventResult {
  const env = DomainEventEnvelope.safeParse(raw);
  if (!env.success) {
    return { ok: false, reason: 'INVALID_ENVELOPE', issues: env.error.issues.map(formatIssue) };
  }
  const schema = domainEventPayloadSchema(env.data.event_type, env.data.event_version);
  if (!schema) {
    return {
      ok: false,
      reason: 'UNKNOWN_EVENT',
      issues: [`${env.data.event_type} v${env.data.event_version}`],
    };
  }
  const payload = schema.safeParse(env.data.payload);
  if (!payload.success) {
    return { ok: false, reason: 'INVALID_PAYLOAD', issues: payload.error.issues.map(formatIssue) };
  }
  return { ok: true, event: { ...env.data, payload: payload.data } as DomainEvent };
}

/**
 * Monta (e valida) um evento para o outbox. Lança se o payload violar o schema — é bug do
 * produtor (o teste do caso de uso deve pegar).
 */
export function buildDomainEvent<
  T extends DomainEventType,
  V extends DomainEventVersion<T>,
>(input: {
  event_id: string;
  event_type: T;
  event_version: V;
  aggregate_id: string;
  occurred_at: string;
  trace_parent?: string | null;
  payload: DomainEventPayload<T, V>;
}): DomainEvent<T, V> {
  const schema = domainEventPayloadSchema(input.event_type, input.event_version);
  if (!schema) throw new Error(`Evento desconhecido: ${input.event_type} v${input.event_version}`);
  const payload = schema.parse(input.payload) as DomainEventPayload<T, V>;
  const event: DomainEvent<T, V> = {
    event_id: Uuid.parse(input.event_id),
    event_type: input.event_type,
    event_version: input.event_version,
    aggregate_type: DOMAIN_EVENTS[input.event_type].aggregate,
    aggregate_id: Uuid.parse(input.aggregate_id),
    occurred_at: IsoDateTime.parse(input.occurred_at),
    payload,
  };
  if (input.trace_parent !== undefined) event.trace_parent = input.trace_parent;
  return event;
}

function formatIssue(issue: z.core.$ZodIssue): string {
  return `${issue.path.join('.') || '(raiz)'}: ${issue.message}`;
}
