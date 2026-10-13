/**
 * Contrato de tempo real (Socket.io, namespace `/rt`) — api-websocket.md; ADR-0010.
 *
 * - O WebSocket é **somente leitura de estado**: toda escrita passa pela REST.
 * - Envelope servidor → cliente: `{ event, v, id, ts, data }` (§1).
 *   `v` = versão do schema do evento (aditivo mantém `v`); `id` = id do `outbox_event`
 *   (deduplicação no cliente); `ts` = instante do commit (mede RNF01).
 * - Eventos de bolha carregam `bubble_id` e `version` (monotônico por bolha): o cliente
 *   descarta `version ≤ lastVersion` (§6).
 * - Nomes canônicos com ponto (`bubble.updated`) — guia §5.2.
 */
import { z } from 'zod';
import {
  BubbleStatus,
  ExplosionOutcome,
  ExplosionReason,
  IsoDateTime,
  Lod,
  ScoreBand,
  Uuid,
} from '../common.js';
import { BubbleSummary, NextTier } from '../api/bubbles.js';

const Cents = z.int().nonnegative();
const Version = z.int().nonnegative();

/** Namespace e path do Socket.io (§1). */
export const WS_NAMESPACE = '/rt' as const;
export const WS_PATH = '/socket.io' as const;

/** Limites e parâmetros do gateway (§2, §4, §9). */
export const WS_LIMITS = {
  MAX_CONNECTIONS_PER_ACCOUNT: 3,
  MAX_CONNECTIONS_PER_ANON_IP: 20,
  MAX_TILES: 64,
  MAX_BUBBLE_ROOMS: 20,
  VIEWPORT_SET_PER_SECOND: 4,
  MAX_CLIENT_MESSAGE_BYTES: 4096,
  HEARTBEAT_MS: 25_000,
  COALESCE_WINDOW_MS: 100,
  DEDUPE_WINDOW_IDS: 500,
  RECOVERY_WINDOW_MS: 120_000,
} as const;

// ------------------------------------------------------------------ rooms e tiling (§3)

/** Tamanho do tile no nível `z` (`T(z) = 32768 / 2^z`) — provisório (§9, pendência 3). */
export const TILE_BASE_SIZE = 32_768;
export const TILE_MAX_LEVEL = 5;

/** Nível discreto de assinatura: `z = clamp(floor(log2(zoom / 0,1)), 0, 5)`. */
export function zoomToTileLevel(zoom: number): number {
  const z = Math.floor(Math.log2(zoom / 0.1) + 1e-9);
  return Math.min(TILE_MAX_LEVEL, Math.max(0, z));
}

/** Room do tile que contém o ponto `(x, y)` no nível `z`. */
export function tileRoom(level: number, x: number, y: number): string {
  const size = TILE_BASE_SIZE / 2 ** level;
  return `tile:${level}:${Math.floor(x / size)}:${Math.floor(y / size)}`;
}

export const bubbleRoom = (bubbleId: string): string => `bubble:${bubbleId}`;
export const userRoom = (accountId: string): string => `user:${accountId}`;

// ------------------------------------------------------------------ servidor → cliente (§5)

export const BubbleFlags = z.object({ is_near_full: z.boolean(), is_expiring: z.boolean() });

/** §5.1 — valores **absolutos**; `next_tier` omitido em LOW/MEDIUM e em PURCHASE. */
export const BubbleUpdatedData = z.object({
  bubble_id: Uuid,
  version: Version,
  filled_quotas: z.int().nonnegative(),
  reserved_quotas: z.int().nonnegative(),
  available_quotas: z.int().nonnegative().optional(),
  max_quotas: z.int().positive(),
  current_price: Cents.nullable().optional(),
  next_tier: NextTier.nullable().optional(),
  flags: BubbleFlags,
  cause: z.enum([
    'QUOTA_ACQUIRED',
    'QUOTA_RELEASED',
    'QUOTA_RESERVED',
    'RESERVATION_EXPIRED',
    'FLAG_CHANGED',
    'COALESCED',
  ]),
  /** Soma de `filled_quotas` no intervalo — só para a animação de pulso. */
  delta_quotas: z.int(),
});

/** §5.2 — toda transição da máquina de estados (nunca coalescido). */
export const BubbleStateChangedData = z.object({
  bubble_id: Uuid,
  version: Version,
  from: BubbleStatus,
  to: BubbleStatus,
  reason: z.enum([
    'PUBLISHED',
    'CANCELLED_BY_CREATOR',
    'CANCELLED_BY_MODERATION',
    'BID_SELECTED',
    'BID_AUTO_SELECTED',
    'NO_VALID_BID',
    'TRIAGE_COMPLETED',
    'TRIAGE_ALL_CANCELLED',
    'FAILED_REFUNDED',
  ]),
  /** Presente quando `to = ACTIVE`: é assim que a bolha nova aparece no canvas. */
  bubble: BubbleSummary.optional(),
  /** `EXPIRED_SUCCESS → IN_TRIAGE` em PURCHASE. */
  selected_bid_id: Uuid.optional(),
  final_price: Cents.optional(),
});

/** §5.3 — gatilho da animação de explosão. */
export const BubbleExplodedData = z.object({
  bubble_id: Uuid,
  version: Version,
  outcome: ExplosionOutcome,
  reason: ExplosionReason,
  status: z.enum(['EXPIRED_SUCCESS', 'EXPIRED_FAILED']),
  filled_quotas: z.int().nonnegative(),
  final_price: Cents.nullable(),
  exploded_at: IsoDateTime,
  bid_selection_deadline: IsoDateTime.nullable(),
});

const BidsSummary = z.object({ bids_count: z.int().nonnegative(), best_price: Cents.nullable() });

/** §5.4 — room `bubble:{id}`. */
export const BidSubmittedData = z.object({
  bubble_id: Uuid,
  version: Version,
  bid: z.object({
    id: Uuid,
    bidder: z.object({ pseudonym: z.string(), score_band: ScoreBand }),
    unit_price: Cents,
    delivery_days: z.int().positive(),
    submitted_at: IsoDateTime,
  }),
  summary: BidsSummary,
});

/** §5.5 — extensão proposta (retirada e substituição de lance). */
export const BidWithdrawnData = z.object({
  bubble_id: Uuid,
  version: Version,
  bid_id: Uuid,
  replaced_by_bid_id: Uuid.nullable(),
  summary: BidsSummary,
});

/** §5.6 — room `user:{id}`. */
export const NotificationCreatedData = z.object({
  notification: z.object({
    id: Uuid,
    type: z.string(),
    title: z.string(),
    body: z.string().optional(),
    link: z.string().nullable().optional(),
    created_at: IsoDateTime,
  }),
  unread_count: z.int().nonnegative(),
});

/** §2 — resposta ao conectar. */
export const SessionReadyData = z.object({
  connection_id: z.string(),
  anonymous: z.boolean(),
  server_time: IsoDateTime,
  heartbeat_ms: z.int().positive(),
  limits: z.object({ max_tiles: z.int().positive(), max_bubble_rooms: z.int().positive() }),
});

export const SessionExpiringData = z.object({ expires_at: IsoDateTime });
export const SessionRevokedData = z.object({
  reason: z.enum(['LOGOUT', 'PASSWORD_CHANGED', 'SUSPENDED']),
});
export const ResyncRequiredData = z.object({
  scope: z.enum(['VIEWPORT', 'BUBBLE', 'ALL']),
  bubble_ids: z.array(Uuid),
  reason: z.enum(['BACKPRESSURE', 'GAP', 'SERVER_RESTART']),
});
export const ServerDrainingData = z.object({ reconnect_after_ms: z.int().nonnegative() });

/**
 * Catálogo servidor → cliente: nome → `{ v, data }`. Para quebrar um payload, crie `v: 2`
 * em paralelo (o cliente ignora campos desconhecidos — mudança aditiva mantém `v`).
 */
export const WS_SERVER_EVENTS = {
  'bubble.updated': { v: 1, data: BubbleUpdatedData, coalescible: true },
  'bubble.state_changed': { v: 1, data: BubbleStateChangedData, coalescible: false },
  'bubble.exploded': { v: 1, data: BubbleExplodedData, coalescible: false },
  'bid.submitted': { v: 1, data: BidSubmittedData, coalescible: false },
  'bid.withdrawn': { v: 1, data: BidWithdrawnData, coalescible: false },
  'notification.created': { v: 1, data: NotificationCreatedData, coalescible: false },
  'session.ready': { v: 1, data: SessionReadyData, coalescible: false },
  'session.expiring': { v: 1, data: SessionExpiringData, coalescible: false },
  'session.revoked': { v: 1, data: SessionRevokedData, coalescible: false },
  'resync.required': { v: 1, data: ResyncRequiredData, coalescible: false },
  'server.draining': { v: 1, data: ServerDrainingData, coalescible: false },
} as const satisfies Record<string, { v: number; data: z.ZodObject; coalescible: boolean }>;

export type WsServerEventName = keyof typeof WS_SERVER_EVENTS;
export const WS_SERVER_EVENT_NAMES = Object.keys(WS_SERVER_EVENTS) as [
  WsServerEventName,
  ...WsServerEventName[],
];
export type WsServerEventData<E extends WsServerEventName> = z.infer<
  (typeof WS_SERVER_EVENTS)[E]['data']
>;

/** Envelope genérico (dados ainda não validados). */
export const WsEnvelope = z.object({
  event: z.string().min(1),
  v: z.int().positive(),
  /** Id do `outbox_event` (eventos de controle podem não ter). */
  id: Uuid.optional(),
  ts: IsoDateTime.optional(),
  data: z.record(z.string(), z.unknown()),
});

export interface WsServerMessage<E extends WsServerEventName = WsServerEventName> {
  event: E;
  v: number;
  id?: string;
  ts?: string;
  data: WsServerEventData<E>;
}

/** Envelope tipado de um evento (para o emissor). */
export function wsServerEventSchema<E extends WsServerEventName>(event: E) {
  const def = WS_SERVER_EVENTS[event];
  return z.object({
    event: z.literal(event),
    v: z.literal(def.v),
    id: Uuid.optional(),
    ts: IsoDateTime.optional(),
    data: def.data,
  });
}

export type ParseWsEventResult =
  | { ok: true; message: WsServerMessage }
  | { ok: false; reason: 'INVALID_ENVELOPE' | 'UNKNOWN_EVENT' | 'INVALID_DATA' };

/**
 * Valida uma mensagem recebida no cliente. Evento desconhecido ou `v` maior que o conhecido
 * → `UNKNOWN_EVENT` (o cliente ignora e, se preciso, ressincroniza por snapshot REST).
 */
export function parseWsServerEvent(raw: unknown): ParseWsEventResult {
  const env = WsEnvelope.safeParse(raw);
  if (!env.success) return { ok: false, reason: 'INVALID_ENVELOPE' };
  if (!Object.hasOwn(WS_SERVER_EVENTS, env.data.event))
    return { ok: false, reason: 'UNKNOWN_EVENT' };
  const name = env.data.event as WsServerEventName;
  const def = WS_SERVER_EVENTS[name];
  if (env.data.v !== def.v) return { ok: false, reason: 'UNKNOWN_EVENT' };
  const data = def.data.safeParse(env.data.data);
  if (!data.success) return { ok: false, reason: 'INVALID_DATA' };
  return { ok: true, message: { ...env.data, event: name, data: data.data } as WsServerMessage };
}

// ------------------------------------------------------------------ cliente → servidor (§4, §5.8)

export const BboxTuple = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const ViewportSetPayload = z.strictObject({
  bbox: BboxTuple,
  zoom: z.number().min(0.1).max(4),
  margin: z.number().min(0).max(0.5).default(0),
});

export const WsAckError = z.object({
  ok: z.literal(false),
  code: z.enum(['BBOX_TOO_LARGE', 'INVALID_ZOOM', 'RATE_LIMITED', 'ROOM_LIMIT', 'UNAUTHENTICATED']),
});

export const ViewportSetAck = z.union([
  z.object({
    ok: z.literal(true),
    z: z.int().min(0).max(TILE_MAX_LEVEL),
    lod: Lod,
    tiles: z.array(z.string()),
    joined: z.array(z.string()),
    left: z.array(z.string()),
    snapshot_bbox: BboxTuple,
    degraded: z.boolean().optional(),
  }),
  WsAckError,
]);

export const BubbleSubscribePayload = z.strictObject({ bubble_id: Uuid });
export const BubbleSubscribeAck = z.union([
  z.object({ ok: z.literal(true), version: Version }),
  WsAckError,
]);

export const AuthRefreshPayload = z.strictObject({ token: z.string().min(1) });
export const AuthRefreshAck = z.object({ ok: z.boolean(), anonymous: z.boolean() });

export const LatencyAckPayload = z.strictObject({ event_id: Uuid, received_at: IsoDateTime });

/** Catálogo cliente → servidor: nome → `{ payload, ack }` (`ack: null` = sem ack). */
export const WS_CLIENT_EVENTS = {
  'viewport.set': { payload: ViewportSetPayload, ack: ViewportSetAck },
  'bubble.subscribe': { payload: BubbleSubscribePayload, ack: BubbleSubscribeAck },
  'bubble.unsubscribe': { payload: BubbleSubscribePayload, ack: BubbleSubscribeAck },
  'auth.refresh': { payload: AuthRefreshPayload, ack: AuthRefreshAck },
  'latency.ack': { payload: LatencyAckPayload, ack: null },
} as const;

export type WsClientEventName = keyof typeof WS_CLIENT_EVENTS;

/** `connect_error` por excesso de conexões (§2). */
export const WS_CONNECT_ERROR_CODES = ['CONNECTION_LIMIT', 'ORIGIN_NOT_ALLOWED'] as const;
