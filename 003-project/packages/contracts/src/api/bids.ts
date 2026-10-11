/**
 * DTOs de lances (`bidding` — F8, ADR-0005; api-rest.md §5).
 *
 * Empresas aparecem **só por pseudônimo** até a seleção do lance.
 */
import { z } from 'zod';
import {
  BidStatus,
  BubbleStatus,
  Cents,
  CursorQuery,
  IsoDateTime,
  PageInfo,
  ScoreBand,
  Uuid,
} from '../common.js';

export const BID_CONDITIONS_MAX = 1000;

export const Bidder = z.object({
  pseudonym: z.string(),
  score_band: ScoreBand,
  score: z.int().min(0).max(1000).optional(),
});

export const BidView = z
  .object({
    id: Uuid,
    bidder: Bidder,
    unit_price: Cents,
    delivery_days: z.int().positive(),
    conditions: z.string().max(BID_CONDITIONS_MAX).optional(),
    status: BidStatus,
    submitted_at: IsoDateTime,
    valid_until: IsoDateTime.optional(),
    is_mine: z.boolean().optional(),
  })
  .meta({ id: 'BidView' });
export type BidView = z.infer<typeof BidView>;

/** `GET /bubbles/{id}/bids` — ordenado por `unit_price ASC, submitted_at ASC`. */
export const BidListResponse = z
  .object({
    data: z.array(BidView),
    summary: z.object({
      bids_count: z.int().nonnegative(),
      best_price: Cents.nullable(),
      target_price: Cents,
    }),
    page: PageInfo,
  })
  .meta({ id: 'BidListResponse' });

/** `POST /bubbles/{id}/bids` — **Idempotency-Key obrigatória**; substitui o lance ativo da empresa. */
export const SubmitBidRequest = z
  .strictObject({
    unit_price: Cents.min(1),
    delivery_days: z.int().min(1).max(365),
    conditions: z.string().max(BID_CONDITIONS_MAX).optional(),
  })
  .meta({ id: 'SubmitBidRequest' });
export type SubmitBidRequest = z.infer<typeof SubmitBidRequest>;

export const SubmitBidResponse = z.object({ bid: BidView, replaced_bid_id: Uuid.nullable() });

export const WithdrawBidResponse = z.object({ status: z.literal('WITHDRAWN') });

/** `POST /bubbles/{id}/bids/{bidId}/select` — **Idempotency-Key obrigatória**. */
export const SelectBidResponse = z.object({
  bubble: z.object({
    status: BubbleStatus,
    selected_bid_id: Uuid,
    final_price: Cents,
    winner: z.object({ pseudonym: z.string(), legal_name: z.string() }),
    version: z.int().nonnegative(),
  }),
});

export const BidParams = z.strictObject({ id: Uuid, bidId: Uuid });

export const MyBidsQuery = z.strictObject({
  status: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
      z.array(BidStatus).min(1),
    )
    .optional(),
  ...CursorQuery.shape,
});
