import type { AccountId } from '../shared/ids.js';
import type { Money } from '../shared/money.js';
import type { Result } from '../shared/result.js';

/**
 * Portas de saída do contexto **payment** para o gateway (ADR-0003). O modelo do provedor
 * (status, charges, recipients do Pagar.me) não vaza para o domínio: os adapters
 * (`PagarmeV5Adapter` — BV-120, `FakePaymentPort` — testes/dev) traduzem para estes tipos.
 *
 * Portas granulares (ISP): cada caso de uso depende só do pedaço que usa (ex.: `AcquireQuota`
 * usa `CardPaymentPort`/`PixPaymentPort` + `PaymentCancellationPort`). `PaymentPort` é a união
 * que um adapter completo implementa.
 *
 * Regras transversais (ADR-0003):
 * - toda chamada leva `idempotencyKey` derivada do domínio (`paymentIdempotencyKeys`);
 *   repetir a chave devolve o mesmo resultado e nunca duplica movimentação;
 * - nenhuma chamada dentro de transação de banco (`UnitOfWork`);
 * - recusa/falha de negócio do gateway é **valor** (`Result<_, PaymentFailure>`); indisponibilidade
 *   (timeout, 5xx, rede) é **exceção** (`PaymentGatewayUnavailableError`), tratada por retry/reconciliação.
 */

export type PaymentMethod = 'CARD' | 'PIX';

/** Estados de uma cobrança como o domínio os enxerga (espelha `payments.status`). */
export type ChargeStatus =
  | 'PENDING' // Pix aguardando pagamento
  | 'AUTHORIZED' // cartão pré-autorizado / Pix pago (valor retido)
  | 'CAPTURED' // cartão capturado / Pix liquidado (diferença estornada)
  | 'VOIDED' // pré-autorização cancelada / QR Pix cancelado antes do pagamento
  | 'REFUNDED' // estorno integral
  | 'FAILED'
  | 'EXPIRED'; // pré-autorização ou QR Pix vencidos

/** Causa da falha (espelha `payments.failure_cause`). */
export type PaymentFailureCause = 'PAYER' | 'GATEWAY' | 'AUTH_EXPIRED' | 'PIX_NOT_PAID';

export type PaymentFailureCode =
  | 'DECLINED'
  | 'INSUFFICIENT_FUNDS'
  | 'AUTHORIZATION_EXPIRED'
  | 'PIX_NOT_PAID'
  | 'PIX_EXPIRED'
  | 'AMOUNT_EXCEEDS_AVAILABLE'
  | 'INVALID_CHARGE_STATE'
  | 'CHARGE_NOT_FOUND'
  | 'RECIPIENT_NOT_FOUND';

export interface PaymentFailure {
  readonly code: PaymentFailureCode;
  readonly cause: PaymentFailureCause;
  /** Texto curto, sem PII nem dados de cartão; vai para `payments.failure_code`/logs. */
  readonly reason: string;
}

/** Falha de infraestrutura do gateway (timeout, 5xx, rede). Não é regra de negócio. */
export class PaymentGatewayUnavailableError extends Error {
  override readonly name = 'PaymentGatewayUnavailableError';
}

// ------------------------------------------------------------------ cartão

export interface AuthorizeCardInput {
  /** `valor_reserva × quantidade` (Spec F5). */
  readonly amount: Money;
  /** Token do cartão gerado no front pelo gateway. A plataforma nunca vê PAN/CVV (ERS C-03). */
  readonly cardToken: string;
  readonly idempotencyKey: string;
  readonly customerRef: AccountId;
}

export interface CardAuthorization {
  readonly chargeId: string;
  readonly status: 'AUTHORIZED';
  readonly authorizedAmount: Money;
  /** Validade da pré-autorização (risco R5 do plano; `payments.authorization_expires_at`). */
  readonly expiresAt: Date;
}

export interface CaptureInput {
  readonly chargeId: string;
  /** Preço final × quantidade; pode ser menor que o autorizado (captura parcial). */
  readonly amount: Money;
  readonly idempotencyKey: string;
}

export interface CaptureReceipt {
  readonly chargeId: string;
  readonly status: 'CAPTURED';
  readonly capturedAmount: Money;
  /** Diferença liberada ao comprador (`autorizado − capturado`). */
  readonly releasedAmount: Money;
}

/** Pré-autorização na adesão e captura (parcial) na explosão — ADR-0003 / Spec F5–F6. */
export interface CardPaymentPort {
  authorizeCard(input: AuthorizeCardInput): Promise<Result<CardAuthorization, PaymentFailure>>;
  capture(input: CaptureInput): Promise<Result<CaptureReceipt, PaymentFailure>>;
}

// ------------------------------------------------------------------ Pix

export interface CreatePixChargeInput {
  readonly amount: Money;
  /** `PIX_EXPIRATION_SECONDS` (15 min, Spec §5). */
  readonly expiresInSec: number;
  readonly idempotencyKey: string;
  readonly customerRef: AccountId;
}

export interface PixCharge {
  readonly chargeId: string;
  readonly status: 'PENDING';
  readonly amount: Money;
  /** Copia-e-cola (EMV) para o QR Code. */
  readonly qrCode: string;
  readonly expiresAt: Date;
}

export interface SettlePixInput {
  readonly chargeId: string;
  /** Preço final × quantidade; a diferença para o valor pago é estornada. */
  readonly finalAmount: Money;
  readonly idempotencyKey: string;
}

/** Pix: cobra o `valor_reserva` e, na explosão, estorna a diferença — ADR-0003 / Spec F5. */
export interface PixPaymentPort {
  createPixCharge(input: CreatePixChargeInput): Promise<Result<PixCharge, PaymentFailure>>;
  settlePix(input: SettlePixInput): Promise<Result<CaptureReceipt, PaymentFailure>>;
}

// ------------------------------------------------------------------ cancelamento e estorno

export interface VoidInput {
  readonly chargeId: string;
  readonly idempotencyKey: string;
}

export interface VoidReceipt {
  readonly chargeId: string;
  /** Cartão/Pix não pago: `VOIDED`; Pix já pago: `REFUNDED` (estorno integral). */
  readonly status: 'VOIDED' | 'REFUNDED';
  readonly releasedAmount: Money;
}

export interface RefundInput {
  readonly chargeId: string;
  readonly amount: Money;
  readonly idempotencyKey: string;
}

export interface RefundReceipt {
  readonly refundId: string;
  readonly chargeId: string;
  readonly status: 'SUCCEEDED';
  readonly amount: Money;
}

/**
 * Compensações: anular a pré-autorização / estornar o Pix inteiro (`void`) e estornar valor
 * já capturado (`refund` — arrependimento, triagem, moderação). ADR-0003.
 */
export interface PaymentCancellationPort {
  void(input: VoidInput): Promise<Result<VoidReceipt, PaymentFailure>>;
  refund(input: RefundInput): Promise<Result<RefundReceipt, PaymentFailure>>;
}

// ------------------------------------------------------------------ repasse (split / recebedor)

export interface ReleasePayoutInput {
  /** `gateway_recipient_id` do vendedor (PJ ou PF C2C com recebedor aprovado — Spec §2). */
  readonly recipientId: string;
  /** Valor líquido: `final_amount − 6% − taxa do gateway` (ADR-0003 item 5). */
  readonly amount: Money;
  readonly idempotencyKey: string;
}

export interface PayoutReceipt {
  readonly transferId: string;
  readonly recipientId: string;
  readonly status: 'RELEASED';
  readonly amount: Money;
}

/** Repasse ao vendedor após a janela de arrependimento (ADR-0003 item 5). */
export interface PayoutPort {
  releasePayout(input: ReleasePayoutInput): Promise<Result<PayoutReceipt, PaymentFailure>>;
}

// ------------------------------------------------------------------ consulta (fetch-back)

export interface ChargeSnapshot {
  readonly chargeId: string;
  readonly method: PaymentMethod;
  readonly status: ChargeStatus;
  readonly authorizedAmount: Money;
  readonly capturedAmount: Money;
  readonly refundedAmount: Money;
  readonly expiresAt: Date;
}

/** Fetch-back do webhook e conciliação (ADR-0003 itens 4 e 6). `null` = cobrança inexistente. */
export interface ChargeQueryPort {
  getCharge(chargeId: string): Promise<ChargeSnapshot | null>;
}

// ------------------------------------------------------------------ porta completa

/**
 * Porta completa do gateway (`PaymentGatewayPort` no ADR-0003). Adapters implementam esta;
 * casos de uso dependem das portas granulares acima.
 */
export interface PaymentPort
  extends CardPaymentPort, PixPaymentPort, PaymentCancellationPort, PayoutPort, ChargeQueryPort {}

/** Nome usado no ADR-0003. */
export type PaymentGatewayPort = PaymentPort;
