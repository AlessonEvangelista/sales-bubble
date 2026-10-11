/**
 * DTOs de notificações (F11; api-rest.md §8.1).
 */
import { z } from 'zod';
import { CursorQuery, IsoDateTime, PageInfo, Uuid } from '../common.js';

export const NotificationType = z
  .enum([
    'QUOTA_CONFIRMED',
    'QUOTA_RELEASED',
    'PRICE_TIER_REACHED',
    'BUBBLE_EXPIRING',
    'BUBBLE_EXPLODED_SUCCESS',
    'BUBBLE_EXPLODED_FAILED',
    'BID_RECEIVED',
    'BID_SELECTION_DEADLINE',
    'BID_SELECTED',
    'BID_NOT_SELECTED',
    'TRIAGE_DEADLINE',
    'TRIAGE_ITEM_LATE',
    'TRIAGE_CASE_DECIDED',
    'REFUND_ISSUED',
    'SCORE_CHANGED',
    'DISPUTE_DECIDED',
    'CNPJ_VERIFICATION_RESULT',
  ])
  .meta({ id: 'NotificationType' });
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationView = z
  .object({
    id: Uuid,
    /** Tipo conhecido ou novo (aditivo) — o cliente exibe `title`/`body` mesmo sem conhecê-lo. */
    type: z.string(),
    title: z.string(),
    body: z.string().optional(),
    link: z.string().nullable().optional(),
    read_at: IsoDateTime.nullable().optional(),
    created_at: IsoDateTime,
  })
  .meta({ id: 'NotificationView' });
export type NotificationView = z.infer<typeof NotificationView>;

export const NotificationsQuery = z.strictObject({
  unread: z
    .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean())
    .optional(),
  ...CursorQuery.shape,
});

export const NotificationsResponse = z.object({ data: z.array(NotificationView), page: PageInfo });
