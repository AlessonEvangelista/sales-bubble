/**
 * DTOs de bolhas (`bubble` — F2 canvas, F3/F4 criação; api-rest.md §1.7 e §3).
 *
 * Regras de forma (Spec F3) ficam aqui; regras de negócio que dependem de estado (degraus
 * crescentes, teto PJ etc.) são revalidadas no core-domain e viram os códigos
 * `INVALID_*` do catálogo.
 */
import { z } from 'zod';
import {
  AccountType,
  BubbleStatus,
  BubbleType,
  Cents,
  Currency,
  CursorQuery,
  ExplosionOutcome,
  ExplosionReason,
  IsoDateTime,
  Lod,
  PaymentStatus,
  QuotaStatus,
  ScoreBand,
  Uuid,
  paginated,
} from '../common.js';

// ------------------------------------------------------------------ limites (Spec F3, F2)

export const BUBBLE_LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 80,
  DESCRIPTION_MAX: 2000,
  IMAGES_MAX: 5,
  MAX_QUOTAS_MIN: 2,
  MAX_QUOTAS_MAX: 10_000,
  PJ_SHARE_MIN: 0.1,
  PJ_SHARE_MAX: 1,
  PJ_SHARE_DEFAULT: 0.5,
  PRICE_TIERS_MIN: 1,
  PRICE_TIERS_MAX: 10,
  UNIT_PRICE_MIN: 100,
  DURATION_MIN_MINUTES: 60,
  DURATION_MAX_MINUTES: 7200,
  SHIPPING_DAYS_MIN: 1,
  SHIPPING_DAYS_MAX: 30,
  SHIPPING_DAYS_DEFAULT: 7,
  SUGGESTED_SUPPLIERS_MAX: 5,
  REPORT_DETAILS_MAX: 1000,
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 4,
  VIEWPORT_MAX_BUBBLES: 500,
} as const;

// ------------------------------------------------------------------ representações (§1.7)

/** Degrau de preço (ADR-0004). */
export const PriceTier = z
  .strictObject({
    min_filled_quotas: z.int().nonnegative(),
    unit_price: Cents.min(BUBBLE_LIMITS.UNIT_PRICE_MIN),
  })
  .meta({ id: 'PriceTier' });
export type PriceTier = z.infer<typeof PriceTier>;

/** Próximo degrau a atingir (SALE). */
export const NextTier = z
  .object({
    min_filled_quotas: z.int().nonnegative(),
    unit_price: Cents,
    quotas_to_go: z.int().nonnegative(),
  })
  .meta({ id: 'NextTier' });
export type NextTier = z.infer<typeof NextTier>;

export const CategoryRef = z
  .object({ id: z.string(), name: z.string() })
  .meta({ id: 'CategoryRef' });

/** Criador exibido publicamente (só pseudônimo — nunca nome/documento). */
export const PublicCreator = z
  .object({
    pseudonym: z.string(),
    account_type: AccountType,
    score_band: ScoreBand,
    score: z.int().min(0).max(1000).optional(),
  })
  .meta({ id: 'PublicCreator' });

/**
 * `BubbleSummary` (canvas, listas). No LOD `LOW`/`MEDIUM` parte dos campos é omitida
 * (api-rest §3.7) — por isso os campos de exibição são opcionais.
 * Em `PURCHASE`, `initial_price`/`next_tier` são `null` e `current_price` é o menor lance.
 */
export const BubbleSummary = z
  .object({
    id: Uuid,
    type: BubbleType,
    status: BubbleStatus,
    title: z.string().optional(),
    category: CategoryRef.optional(),
    image_url: z.url().nullable().optional(),
    creator: PublicCreator.optional(),
    currency: Currency.optional(),
    initial_price: Cents.nullable().optional(),
    target_price: Cents.nullable().optional(),
    current_price: Cents.nullable().optional(),
    next_tier: NextTier.nullable().optional(),
    min_quotas: z.int().positive().optional(),
    max_quotas: z.int().positive(),
    filled_quotas: z.int().nonnegative(),
    reserved_quotas: z.int().nonnegative(),
    available_quotas: z.int().nonnegative().optional(),
    is_near_full: z.boolean(),
    is_expiring: z.boolean(),
    starts_at: IsoDateTime.nullable().optional(),
    expires_at: IsoDateTime.nullable().optional(),
    exploded_at: IsoDateTime.nullable().optional(),
    canvas_x: z.number(),
    canvas_y: z.number(),
    radius: z.number().positive(),
    /** Monotônico por bolha; o mesmo dos eventos WebSocket. */
    version: z.int().nonnegative(),
  })
  .meta({ id: 'BubbleSummary' });
export type BubbleSummary = z.infer<typeof BubbleSummary>;

/** Ações que o front habilita sem recalcular regra (api-rest §1.7). */
export const BubbleAction = z
  .enum([
    'JOIN_QUOTA',
    'LEAVE_QUOTA',
    'SUBMIT_BID',
    'WITHDRAW_BID',
    'SELECT_BID',
    'PUBLISH',
    'EDIT',
    'EDIT_CONTENT',
    'CANCEL',
    'REPORT',
  ])
  .meta({ id: 'BubbleAction' });
export type BubbleAction = z.infer<typeof BubbleAction>;

export const BlockedAction = z.object({ action: BubbleAction, code: z.string() });

export const MyParticipation = z
  .object({
    quota_count: z.int().positive(),
    quota_id: Uuid,
    quota_status: QuotaStatus,
    reserved_amount: Cents,
    payment_status: PaymentStatus,
  })
  .meta({ id: 'MyParticipation' });

export const BubbleImage = z.object({ url: z.url(), alt: z.string().nullable().optional() });

export const PriceTierView = z.object({
  min_filled_quotas: z.int().nonnegative(),
  unit_price: Cents,
  reached: z.boolean(),
});

/** `BubbleDetail` = `BubbleSummary` + campos de detalhe (api-rest §1.7, §3.8). */
export const BubbleDetail = BubbleSummary.extend({
  description: z.string().nullable().optional(),
  images: z.array(BubbleImage).max(BUBBLE_LIMITS.IMAGES_MAX).optional(),
  price_tiers: z.array(PriceTierView).optional(),
  max_pj_share: z
    .number()
    .min(BUBBLE_LIMITS.PJ_SHARE_MIN)
    .max(BUBBLE_LIMITS.PJ_SHARE_MAX)
    .optional(),
  shipping_days: z.int().optional(),
  outcome: ExplosionOutcome.nullable().optional(),
  explosion_reason: ExplosionReason.nullable().optional(),
  final_price: Cents.nullable().optional(),
  selected_bid_id: Uuid.nullable().optional(),
  /** Razão social revelada aos participantes **após** a seleção do lance. */
  winner: z
    .object({ pseudonym: z.string(), legal_name: z.string().optional() })
    .nullable()
    .optional(),
  bids_count: z.int().nonnegative().optional(),
  bid_selection_deadline: IsoDateTime.nullable().optional(),
  participants_preview: z.array(z.string()).optional(),
  my_participation: MyParticipation.nullable().optional(),
  allowed_actions: z.array(BubbleAction).optional(),
  blocked_actions: z.array(BlockedAction).optional(),
  server_time: IsoDateTime.optional(),
}).meta({ id: 'BubbleDetail' });
export type BubbleDetail = z.infer<typeof BubbleDetail>;

// ------------------------------------------------------------------ categorias (§3.1)

export const Category = z
  .object({ id: z.string(), name: z.string(), prohibited: z.boolean() })
  .meta({ id: 'Category' });
export const CategoryListResponse = z.array(Category);

// ------------------------------------------------------------------ criar/editar (§3.2–§3.6)

const BubbleCommonInput = {
  title: z.string().trim().min(BUBBLE_LIMITS.TITLE_MIN).max(BUBBLE_LIMITS.TITLE_MAX),
  description: z.string().max(BUBBLE_LIMITS.DESCRIPTION_MAX).optional(),
  category_id: z.string().min(1).max(64),
  image_upload_ids: z.array(Uuid).max(BUBBLE_LIMITS.IMAGES_MAX).default([]),
  max_quotas: z.int().min(BUBBLE_LIMITS.MAX_QUOTAS_MIN).max(BUBBLE_LIMITS.MAX_QUOTAS_MAX),
  /** Padrão no servidor: 50% de `max_quotas`, arredondado para cima. */
  min_quotas: z.int().min(1).max(BUBBLE_LIMITS.MAX_QUOTAS_MAX).optional(),
  max_pj_share: z
    .number()
    .min(BUBBLE_LIMITS.PJ_SHARE_MIN)
    .max(BUBBLE_LIMITS.PJ_SHARE_MAX)
    .default(BUBBLE_LIMITS.PJ_SHARE_DEFAULT),
  duration_minutes: z
    .int()
    .min(BUBBLE_LIMITS.DURATION_MIN_MINUTES)
    .max(BUBBLE_LIMITS.DURATION_MAX_MINUTES),
};

/** Fornecedor sugerido (PURCHASE): CNPJ **ou** e-mail; convidado na publicação. */
export const SuggestedSupplier = z.union([
  z.strictObject({ cnpj: z.string().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/) }),
  z.strictObject({ email: z.email() }),
]);

/** `POST /bubbles` — venda com degraus (F3). */
export const CreateSaleBubbleRequest = z.strictObject({
  type: z.literal('SALE'),
  ...BubbleCommonInput,
  price_tiers: z
    .array(PriceTier)
    .min(BUBBLE_LIMITS.PRICE_TIERS_MIN)
    .max(BUBBLE_LIMITS.PRICE_TIERS_MAX),
  shipping_days: z
    .int()
    .min(BUBBLE_LIMITS.SHIPPING_DAYS_MIN)
    .max(BUBBLE_LIMITS.SHIPPING_DAYS_MAX)
    .default(BUBBLE_LIMITS.SHIPPING_DAYS_DEFAULT),
});

/** `POST /bubbles` — compra com preço-alvo (F4). `price_tiers` é proibido aqui. */
export const CreatePurchaseBubbleRequest = z.strictObject({
  type: z.literal('PURCHASE'),
  ...BubbleCommonInput,
  target_price: Cents.min(BUBBLE_LIMITS.UNIT_PRICE_MIN),
  suggested_suppliers: z
    .array(SuggestedSupplier)
    .max(BUBBLE_LIMITS.SUGGESTED_SUPPLIERS_MAX)
    .default([]),
});

export const CreateBubbleRequest = z
  .discriminatedUnion('type', [CreateSaleBubbleRequest, CreatePurchaseBubbleRequest])
  .meta({ id: 'CreateBubbleRequest' });
export type CreateBubbleRequest = z.infer<typeof CreateBubbleRequest>;

/**
 * `PATCH /bubbles/{id}` (com `If-Match`). Em `DRAFT` aceita todos os campos; em `ACTIVE`
 * só `description` e `image_upload_ids` (demais → `FIELD_LOCKED_AFTER_PUBLISH`, checado no
 * servidor porque depende do estado).
 */
export const UpdateBubbleRequest = z
  .strictObject({
    title: BubbleCommonInput.title.optional(),
    description: BubbleCommonInput.description,
    category_id: BubbleCommonInput.category_id.optional(),
    image_upload_ids: z.array(Uuid).max(BUBBLE_LIMITS.IMAGES_MAX).optional(),
    max_quotas: BubbleCommonInput.max_quotas.optional(),
    min_quotas: BubbleCommonInput.min_quotas,
    max_pj_share: z
      .number()
      .min(BUBBLE_LIMITS.PJ_SHARE_MIN)
      .max(BUBBLE_LIMITS.PJ_SHARE_MAX)
      .optional(),
    duration_minutes: BubbleCommonInput.duration_minutes.optional(),
    price_tiers: z
      .array(PriceTier)
      .min(BUBBLE_LIMITS.PRICE_TIERS_MIN)
      .max(BUBBLE_LIMITS.PRICE_TIERS_MAX)
      .optional(),
    shipping_days: z
      .int()
      .min(BUBBLE_LIMITS.SHIPPING_DAYS_MIN)
      .max(BUBBLE_LIMITS.SHIPPING_DAYS_MAX)
      .optional(),
    target_price: Cents.min(BUBBLE_LIMITS.UNIT_PRICE_MIN).optional(),
    suggested_suppliers: z
      .array(SuggestedSupplier)
      .max(BUBBLE_LIMITS.SUGGESTED_SUPPLIERS_MAX)
      .optional(),
  })
  .meta({ id: 'UpdateBubbleRequest' });
export type UpdateBubbleRequest = z.infer<typeof UpdateBubbleRequest>;

/** Campos editáveis após publicar (oferta vinculante — CDC art. 30). */
export const EDITABLE_AFTER_PUBLISH = ['description', 'image_upload_ids'] as const;

/** Pagamento da cota automática do criador (PURCHASE): **só cartão**. */
export const CardPaymentInput = z.strictObject({
  method: z.literal('CARD'),
  /** Gerado no navegador pelo SDK do gateway (PCI SAQ-A). */
  card_token: z.string().min(1).max(512),
  installments: z.int().min(1).max(12).default(1),
});

/** `POST /bubbles/{id}/publish`. Corpo vazio em SALE; `payment` obrigatório em PURCHASE. */
export const PublishBubbleRequest = z.strictObject({
  payment: CardPaymentInput.optional(),
});

/** `POST /bubbles/{id}/cancel`. */
export const CancelBubbleRequest = z.strictObject({ reason: z.string().trim().min(1).max(500) });

/** `POST /uploads/images` (§3.4). */
export const CreateImageUploadRequest = z.strictObject({
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  size_bytes: z
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  purpose: z.enum(['BUBBLE', 'EVIDENCE']),
});

export const CreateImageUploadResponse = z.object({
  upload_id: Uuid,
  upload_url: z.url(),
  expires_at: IsoDateTime,
});

/** `POST /bubbles/{id}/reports` (F12). */
export const ReportBubbleRequest = z.strictObject({
  category: z.enum(['PROHIBITED', 'MISLEADING', 'FRAUD', 'OTHER']),
  details: z.string().max(BUBBLE_LIMITS.REPORT_DETAILS_MAX).optional(),
});

export const ReportCreatedResponse = z.object({ id: Uuid, status: z.literal('RECEIVED') });

// ------------------------------------------------------------------ consulta (§3.7–§3.9)

/** Lista separada por vírgula → array (`type=SALE,PURCHASE`). */
const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(item).min(1),
  );

/** `bbox=minX,minY,maxX,maxY`. */
export const BboxParam = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map(Number) : v),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
);

const booleanParam = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean(),
);

/** Filtros comuns de `GET /bubbles`. */
const BubbleFilters = {
  type: csv(BubbleType).optional(),
  category: z.string().max(64).optional(),
  price_min: z.coerce.number().int().nonnegative().optional(),
  price_max: z.coerce.number().int().nonnegative().optional(),
  participating: booleanParam.optional(),
  status: csv(BubbleStatus).optional(),
  recently_exploded: booleanParam.optional(),
};

/** `GET /bubbles` — modo viewport (canvas, sem paginação, máx. 500). */
export const BubbleViewportQuery = z.strictObject({
  bbox: BboxParam,
  zoom: z.coerce.number().min(BUBBLE_LIMITS.ZOOM_MIN).max(BUBBLE_LIMITS.ZOOM_MAX),
  ...BubbleFilters,
});
export type BubbleViewportQuery = z.infer<typeof BubbleViewportQuery>;

/** `GET /bubbles?view=list` — lista acessível paginada (sem `bbox` vira busca global `q`). */
export const BubbleListQuery = z.strictObject({
  view: z.literal('list'),
  bbox: BboxParam.optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(['expires_at', 'current_price', '-progress']).optional(),
  ...BubbleFilters,
  ...CursorQuery.shape,
});
export type BubbleListQuery = z.infer<typeof BubbleListQuery>;

/** Query aceita por `GET /bubbles` (viewport ou lista). */
export const BubbleSearchQuery = z.union([BubbleListQuery, BubbleViewportQuery]);

/** Resposta do modo viewport. */
export const BubbleViewportResponse = z
  .object({
    data: z.array(BubbleSummary).max(BUBBLE_LIMITS.VIEWPORT_MAX_BUBBLES),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    zoom: z.number(),
    lod: Lod,
    truncated: z.boolean(),
    server_time: IsoDateTime,
    /** Rooms correspondentes (mesma função de tiling do WebSocket). */
    tiles: z.array(z.string()),
  })
  .meta({ id: 'BubbleViewportResponse' });
export type BubbleViewportResponse = z.infer<typeof BubbleViewportResponse>;

export const BubblePage = paginated(BubbleSummary).meta({ id: 'BubblePage' });

/** `GET /bubbles` responde viewport ou página, conforme a query. */
export const BubbleSearchResponse = z.union([BubbleViewportResponse, BubblePage]);

/** `GET /me/bubbles`. */
export const MyBubblesQuery = z.strictObject({
  status: csv(BubbleStatus).optional(),
  type: csv(BubbleType).optional(),
  ...CursorQuery.shape,
});

export const MyBubblesResponse = paginated(BubbleSummary).extend({
  /** Pendências do criador (ex.: `{ "SELECT_BID": "<prazo>" }`, `{ "REGISTER_SHIPMENTS": 12 }`). */
  pending_actions: z.record(z.string(), z.union([z.string(), z.int()])).optional(),
});
