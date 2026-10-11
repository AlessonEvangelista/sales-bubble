/**
 * DTOs de cotas e pagamento (`bubble` + `payment` — F5, F6; api-rest.md §4).
 *
 * Dados de cartão nunca passam pela API: só o `card_token` gerado no navegador pelo SDK do
 * gateway (PCI SAQ-A — ADR-0003).
 */
import { z } from 'zod';
import {
  BubbleStatus,
  BubbleType,
  Cents,
  Currency,
  CursorQuery,
  IsoDateTime,
  PaymentMethod,
  PaymentStatus,
  QuotaStatus,
  Uuid,
  paginated,
} from '../common.js';
import { NextTier } from './bubbles.js';

// ------------------------------------------------------------------ entrar na bolha (§4.1)

export const QuotaCardPayment = z.strictObject({
  method: z.literal('CARD'),
  card_token: z.string().min(1).max(512),
  installments: z.int().min(1).max(12).default(1),
});

export const QuotaPixPayment = z.strictObject({ method: z.literal('PIX') });

/**
 * `POST /bubbles/{id}/quotas` — **Idempotency-Key obrigatória**.
 * PF: `quantity` = 1 (regra de domínio → `PF_QUOTA_LIMIT`); PJ verificada: 1 até o teto.
 */
export const AcquireQuotaRequest = z
  .strictObject({
    quantity: z.int().min(1).max(10_000).default(1),
    payment: z.discriminatedUnion('method', [QuotaCardPayment, QuotaPixPayment]),
  })
  .meta({ id: 'AcquireQuotaRequest' });
export type AcquireQuotaRequest = z.infer<typeof AcquireQuotaRequest>;

export const QuotaView = z
  .object({
    id: Uuid,
    bubble_id: Uuid,
    quantity: z.int().positive(),
    status: QuotaStatus,
    acquired_at: IsoDateTime.nullable().optional(),
    reserved_until: IsoDateTime.nullable().optional(),
  })
  .meta({ id: 'QuotaView' });

export const PaymentSummary = z
  .object({
    id: Uuid.optional(),
    method: PaymentMethod,
    status: PaymentStatus,
    authorized_amount: Cents.nullable().optional(),
    currency: Currency.optional(),
  })
  .meta({ id: 'PaymentSummary' });

/** Estado da bolha devolvido pelas escritas (dispensa esperar o WebSocket). */
export const BubbleStatePatch = z
  .object({
    filled_quotas: z.int().nonnegative(),
    reserved_quotas: z.int().nonnegative().optional(),
    available_quotas: z.int().nonnegative().optional(),
    current_price: Cents.nullable().optional(),
    next_tier: NextTier.nullable().optional(),
    is_near_full: z.boolean().optional(),
    status: BubbleStatus.optional(),
    version: z.int().nonnegative(),
  })
  .meta({ id: 'BubbleStatePatch' });

/** Dados do Pix (reserva por `min(15 min, tempo restante)`). */
export const PixCharge = z.object({
  qr_code: z.string(),
  qr_code_image_url: z.url(),
  expires_at: IsoDateTime,
});

/** `201` de `POST /bubbles/{id}/quotas` — cartão (`ACTIVE`/`AUTHORIZED`) ou Pix (`RESERVED`/`PENDING` + `pix`). */
export const AcquireQuotaResponse = z
  .object({
    quota: QuotaView,
    payment: PaymentSummary,
    bubble: BubbleStatePatch,
    pix: PixCharge.optional(),
  })
  .meta({ id: 'AcquireQuotaResponse' });
export type AcquireQuotaResponse = z.infer<typeof AcquireQuotaResponse>;

// ------------------------------------------------------------------ sair da bolha (§4.2)

/** `DELETE /bubbles/{id}/quotas/me?quantity=3` (PJ). */
export const LeaveQuotaQuery = z.strictObject({
  quantity: z.coerce.number().int().min(1).optional(),
});

export const LeaveQuotaResponse = z
  .object({
    released_quantity: z.int().positive(),
    refund: z.object({
      status: z.enum(['PROCESSING', 'COMPLETED', 'NOT_APPLICABLE']),
      amount: Cents,
    }),
    bubble: BubbleStatePatch,
  })
  .meta({ id: 'LeaveQuotaResponse' });

// ------------------------------------------------------------------ minhas cotas (§4.3)

export const MyQuotasQuery = z.strictObject({
  status: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
      z.array(QuotaStatus).min(1),
    )
    .optional(),
  ...CursorQuery.shape,
});

export const MyQuotaItem = z.object({
  quota_id: Uuid,
  quantity: z.int().positive(),
  status: QuotaStatus,
  bubble: z.object({
    id: Uuid,
    type: BubbleType,
    title: z.string(),
    status: BubbleStatus,
    current_price: Cents.nullable(),
    expires_at: IsoDateTime.nullable(),
    is_expiring: z.boolean(),
  }),
  payment: PaymentSummary,
  triage_item_id: Uuid.nullable(),
});

export const MyQuotasResponse = paginated(MyQuotaItem).meta({ id: 'MyQuotasResponse' });

// ------------------------------------------------------------------ pagamentos (§4.4, §4.5)

export const PaymentEvent = z.object({
  type: z.string(),
  at: IsoDateTime,
  amount: Cents.nullable().optional(),
});

/** `GET /payments/{id}` — cartão só com bandeira + 4 últimos dígitos. */
export const PaymentDetail = z
  .object({
    id: Uuid,
    bubble_id: Uuid,
    quota_id: Uuid.nullable(),
    method: PaymentMethod,
    status: PaymentStatus,
    currency: Currency,
    authorized_amount: Cents.nullable(),
    captured_amount: Cents.nullable(),
    released_amount: Cents.nullable(),
    card: z
      .object({ brand: z.string(), last4: z.string().regex(/^\d{4}$/) })
      .nullable()
      .optional(),
    events: z.array(PaymentEvent),
  })
  .meta({ id: 'PaymentDetail' });

export const MyPaymentsResponse = paginated(PaymentDetail);

export const Payout = z.object({
  id: Uuid,
  status: z.enum(['SCHEDULED', 'ON_HOLD', 'RELEASED', 'FAILED']),
  gross_amount: Cents,
  platform_fee: Cents,
  gateway_fee: Cents,
  net_amount: Cents,
  release_at: IsoDateTime.nullable(),
});

export const MyPayoutsResponse = paginated(Payout);
