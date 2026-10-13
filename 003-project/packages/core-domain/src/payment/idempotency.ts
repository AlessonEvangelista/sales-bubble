import type { PaymentId, PayoutId } from '../shared/ids.js';

/** Motivos de estorno (espelha `refunds.reason` do modelo de dados). */
export type RefundReason =
  | 'PRICE_DIFFERENCE'
  | 'GOAL_NOT_MET'
  | 'BUBBLE_CANCELLED'
  | 'QUOTA_RELEASED'
  | 'SOLD_OUT'
  | 'WITHDRAWAL'
  | 'SHIPPING_TIMEOUT'
  | 'NO_VALID_BID'
  | 'MODERATION'
  | 'MODERATION_PARTIAL'
  | 'LATE_PAYMENT'
  | 'RESERVATION_EXPIRED'
  | 'CAPTURE_FAILED';

/**
 * Chaves de idempotência derivadas do domínio (ADR-0003 item 2). Determinísticas: o mesmo
 * pagamento/operação gera sempre a mesma chave, então retries nunca duplicam movimentação.
 */
export const paymentIdempotencyKeys = {
  /** Pré-autorização do cartão ou criação da cobrança Pix. */
  pay: (paymentId: PaymentId): string => `pay__${paymentId}`,
  /** Captura do cartão ou liquidação do Pix (estorno da diferença). */
  capture: (paymentId: PaymentId): string => `capture__${paymentId}`,
  void: (paymentId: PaymentId): string => `void__${paymentId}`,
  refund: (paymentId: PaymentId, reason: RefundReason): string => `refund__${paymentId}__${reason}`,
  payout: (payoutId: PayoutId): string => `payout__${payoutId}`,
} as const;
