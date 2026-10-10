import {
  PaymentGatewayUnavailableError,
  type AuthorizeCardInput,
  type CaptureInput,
  type CaptureReceipt,
  type CardAuthorization,
  type ChargeSnapshot,
  type ChargeStatus,
  type CreatePixChargeInput,
  type PaymentFailure,
  type PaymentMethod,
  type PaymentPort,
  type PayoutReceipt,
  type PixCharge,
  type RefundInput,
  type RefundReceipt,
  type ReleasePayoutInput,
  type SettlePixInput,
  type VoidInput,
  type VoidReceipt,
} from '../payment/index.js';
import type { Clock } from '../shared/clock.js';
import { DomainInvariantViolation } from '../shared/errors.js';
import { Money } from '../shared/money.js';
import { err, ok, type Result } from '../shared/result.js';
import { durationToMs } from './fixed-clock.js';

/** Operações do gateway que aceitam cenário de falha. */
export type PaymentOperation =
  | 'authorizeCard'
  | 'capture'
  | 'createPixCharge'
  | 'settlePix'
  | 'void'
  | 'refund'
  | 'releasePayout';

/**
 * Tokens de cartão "mágicos" do fake (como os cartões de teste dos gateways). Qualquer outro
 * token é aprovado. Úteis em E2E/carga, onde o teste não tem acesso ao objeto do fake.
 */
export const FAKE_CARD_TOKENS = {
  approved: 'tok_fake_approved',
  declined: 'tok_fake_declined',
  insufficientFunds: 'tok_fake_insufficient_funds',
  unavailable: 'tok_fake_gateway_unavailable',
} as const;

/** Validade padrão da pré-autorização no fake: 5 dias (duração máxima da bolha, ADR-0003 / R5). */
export const DEFAULT_AUTHORIZATION_TTL_MS = durationToMs({ days: 5 });

export interface FakePaymentPortOptions {
  readonly clock: Clock;
  readonly authorizationTtlMs?: number;
}

export interface RecordedPaymentCall {
  readonly operation: PaymentOperation | 'getCharge';
  readonly idempotencyKey?: string;
  readonly chargeId?: string;
}

interface ChargeState {
  readonly chargeId: string;
  readonly method: PaymentMethod;
  status: ChargeStatus;
  readonly authorizedAmount: Money;
  capturedAmount: Money;
  refundedAmount: Money;
  /** Estornado depois da captura (refund); limita novos estornos ao valor capturado. */
  refundedAfterCapture: Money;
  readonly expiresAt: Date;
}

type Scripted = { kind: 'decline'; failure: PaymentFailure } | { kind: 'unavailable' };

const failure = (
  code: PaymentFailure['code'],
  cause: PaymentFailure['cause'],
  reason: string,
): PaymentFailure => ({ code, cause, reason });

/**
 * `PaymentPort` fake, determinístico e em memória (`PAYMENT_PROVIDER=fake`; ADR-0003 prevê o
 * `FakePaymentGatewayAdapter` para dev/testes). Modela o ciclo do ADR-0003:
 * cartão `authorize → capture (parcial) | void → refund`; Pix `create → (pago) → settle | void`.
 *
 * - **Idempotência:** a mesma `idempotencyKey` devolve o mesmo resultado (inclusive recusas) e
 *   não repete o efeito; reusar a chave em outra operação é bug (lança).
 * - **Cenários de falha:** `declineNext` (recusa como valor) e `failNextWithOutage`
 *   (`PaymentGatewayUnavailableError`; não é memorizada, então o retry com a mesma chave passa),
 *   além dos `FAKE_CARD_TOKENS`.
 * - **Tempo:** validade da pré-autorização e do QR Pix pelo `Clock` injetado.
 * - **Inspeção:** `calls`, `payouts`, `getSnapshot` e `orphanAuthorizations()` (estratégia de
 *   testes §3.2: autorizações órfãs devem ser zero após compensação).
 */
export class FakePaymentPort implements PaymentPort {
  readonly calls: RecordedPaymentCall[] = [];
  readonly payouts: PayoutReceipt[] = [];

  private readonly clock: Clock;
  private readonly authorizationTtlMs: number;
  private readonly charges = new Map<string, ChargeState>();
  private readonly idempotency = new Map<
    string,
    { operation: PaymentOperation; result: unknown }
  >();
  private readonly scripted = new Map<PaymentOperation | 'getCharge', Scripted[]>();
  private sequence = 0;

  constructor(options: FakePaymentPortOptions) {
    this.clock = options.clock;
    this.authorizationTtlMs = options.authorizationTtlMs ?? DEFAULT_AUTHORIZATION_TTL_MS;
  }

  // ---------------------------------------------------------------- cenários

  /** A próxima chamada (com chave nova) de `operation` é recusada com `failure`. */
  declineNext(operation: PaymentOperation, declined: PaymentFailure): void {
    this.enqueue(operation, { kind: 'decline', failure: declined });
  }

  /** A próxima chamada de `operation` lança `PaymentGatewayUnavailableError` (timeout/5xx). */
  failNextWithOutage(operation: PaymentOperation | 'getCharge'): void {
    this.enqueue(operation, { kind: 'unavailable' });
  }

  /** Simula o webhook `charge.paid` do Pix: `PENDING → AUTHORIZED` (valor retido). */
  markPixPaid(chargeId: string): void {
    const charge = this.charges.get(chargeId);
    if (!charge || charge.method !== 'PIX') {
      throw new DomainInvariantViolation(`Cobrança Pix inexistente: ${chargeId}`);
    }
    this.refreshExpiry(charge);
    if (charge.status !== 'PENDING') {
      throw new DomainInvariantViolation(`Pix ${chargeId} não está PENDING (${charge.status})`);
    }
    charge.status = 'AUTHORIZED';
  }

  /** Cobranças com dinheiro retido e não resolvido (nem capturado, nem anulado). */
  orphanAuthorizations(): ChargeSnapshot[] {
    return [...this.charges.values()]
      .map((c) => this.refreshExpiry(c))
      .filter((c) => c.status === 'AUTHORIZED')
      .map(snapshot);
  }

  getSnapshot(chargeId: string): ChargeSnapshot | null {
    const charge = this.charges.get(chargeId);
    return charge ? snapshot(this.refreshExpiry(charge)) : null;
  }

  // ---------------------------------------------------------------- cartão

  authorizeCard(input: AuthorizeCardInput): Promise<Result<CardAuthorization, PaymentFailure>> {
    return this.execute('authorizeCard', input.idempotencyKey, undefined, () => {
      assertPositive(input.amount);
      switch (input.cardToken) {
        case FAKE_CARD_TOKENS.declined:
          return err(failure('DECLINED', 'PAYER', 'Cartão recusado pelo emissor'));
        case FAKE_CARD_TOKENS.insufficientFunds:
          return err(failure('INSUFFICIENT_FUNDS', 'PAYER', 'Saldo/limite insuficiente'));
        case FAKE_CARD_TOKENS.unavailable:
          throw new PaymentGatewayUnavailableError('Gateway indisponível (token de teste)');
      }
      const charge = this.createCharge('CARD', 'AUTHORIZED', input.amount, this.authorizationTtlMs);
      return ok({
        chargeId: charge.chargeId,
        status: 'AUTHORIZED' as const,
        authorizedAmount: charge.authorizedAmount,
        expiresAt: new Date(charge.expiresAt.getTime()),
      });
    });
  }

  capture(input: CaptureInput): Promise<Result<CaptureReceipt, PaymentFailure>> {
    return this.execute('capture', input.idempotencyKey, input.chargeId, () => {
      const found = this.findCharge(input.chargeId, 'CARD');
      if (!found.ok) return found;
      const charge = found.value;
      if (charge.status === 'EXPIRED') {
        return err(failure('AUTHORIZATION_EXPIRED', 'AUTH_EXPIRED', 'Pré-autorização expirada'));
      }
      if (charge.status !== 'AUTHORIZED') return err(invalidState(charge));
      if (input.amount.compare(charge.authorizedAmount) > 0) return err(exceeds());
      charge.status = 'CAPTURED';
      charge.capturedAmount = input.amount;
      return ok({
        chargeId: charge.chargeId,
        status: 'CAPTURED' as const,
        capturedAmount: input.amount,
        releasedAmount: charge.authorizedAmount.subtract(input.amount),
      });
    });
  }

  // ---------------------------------------------------------------- Pix

  createPixCharge(input: CreatePixChargeInput): Promise<Result<PixCharge, PaymentFailure>> {
    return this.execute('createPixCharge', input.idempotencyKey, undefined, () => {
      assertPositive(input.amount);
      const ttl = durationToMs({ seconds: input.expiresInSec });
      const charge = this.createCharge('PIX', 'PENDING', input.amount, ttl);
      return ok({
        chargeId: charge.chargeId,
        status: 'PENDING' as const,
        amount: charge.authorizedAmount,
        qrCode: `00020101FAKEPIX${charge.chargeId}`,
        expiresAt: new Date(charge.expiresAt.getTime()),
      });
    });
  }

  settlePix(input: SettlePixInput): Promise<Result<CaptureReceipt, PaymentFailure>> {
    return this.execute('settlePix', input.idempotencyKey, input.chargeId, () => {
      const found = this.findCharge(input.chargeId, 'PIX');
      if (!found.ok) return found;
      const charge = found.value;
      if (charge.status === 'PENDING') {
        return err(failure('PIX_NOT_PAID', 'PIX_NOT_PAID', 'Pix ainda não foi pago'));
      }
      if (charge.status === 'EXPIRED') {
        return err(failure('PIX_EXPIRED', 'PIX_NOT_PAID', 'QR Pix expirou sem pagamento'));
      }
      if (charge.status !== 'AUTHORIZED') return err(invalidState(charge));
      if (input.finalAmount.compare(charge.authorizedAmount) > 0) return err(exceeds());
      const difference = charge.authorizedAmount.subtract(input.finalAmount);
      charge.status = 'CAPTURED';
      charge.capturedAmount = input.finalAmount;
      charge.refundedAmount = difference;
      return ok({
        chargeId: charge.chargeId,
        status: 'CAPTURED' as const,
        capturedAmount: input.finalAmount,
        releasedAmount: difference,
      });
    });
  }

  // ---------------------------------------------------------------- cancelamento e estorno

  void(input: VoidInput): Promise<Result<VoidReceipt, PaymentFailure>> {
    return this.execute('void', input.idempotencyKey, input.chargeId, () => {
      const found = this.findCharge(input.chargeId);
      if (!found.ok) return found;
      const charge = found.value;
      if (charge.status === 'PENDING' || charge.status === 'EXPIRED') {
        charge.status = 'VOIDED'; // nada foi retido
        return ok(voidReceipt(charge, 'VOIDED', Money.zero()));
      }
      if (charge.status !== 'AUTHORIZED') return err(invalidState(charge));
      if (charge.method === 'PIX') {
        charge.status = 'REFUNDED'; // Pix pago: estorno integral
        charge.refundedAmount = charge.authorizedAmount;
        return ok(voidReceipt(charge, 'REFUNDED', charge.authorizedAmount));
      }
      charge.status = 'VOIDED';
      return ok(voidReceipt(charge, 'VOIDED', charge.authorizedAmount));
    });
  }

  refund(input: RefundInput): Promise<Result<RefundReceipt, PaymentFailure>> {
    return this.execute('refund', input.idempotencyKey, input.chargeId, () => {
      assertPositive(input.amount);
      const found = this.findCharge(input.chargeId);
      if (!found.ok) return found;
      const charge = found.value;
      if (charge.status !== 'CAPTURED') return err(invalidState(charge));
      const available = charge.capturedAmount.subtract(charge.refundedAfterCapture);
      if (input.amount.compare(available) > 0) return err(exceeds());
      charge.refundedAfterCapture = charge.refundedAfterCapture.add(input.amount);
      charge.refundedAmount = charge.refundedAmount.add(input.amount);
      if (charge.refundedAfterCapture.equals(charge.capturedAmount)) charge.status = 'REFUNDED';
      return ok({
        refundId: this.nextId('re'),
        chargeId: charge.chargeId,
        status: 'SUCCEEDED' as const,
        amount: input.amount,
      });
    });
  }

  // ---------------------------------------------------------------- repasse

  releasePayout(input: ReleasePayoutInput): Promise<Result<PayoutReceipt, PaymentFailure>> {
    return this.execute('releasePayout', input.idempotencyKey, undefined, () => {
      assertPositive(input.amount);
      const receipt: PayoutReceipt = {
        transferId: this.nextId('tr'),
        recipientId: input.recipientId,
        status: 'RELEASED',
        amount: input.amount,
      };
      this.payouts.push(receipt);
      return ok(receipt);
    });
  }

  // ---------------------------------------------------------------- consulta

  getCharge(chargeId: string): Promise<ChargeSnapshot | null> {
    this.calls.push({ operation: 'getCharge', chargeId });
    if (this.scripted.get('getCharge')?.shift()) {
      return Promise.reject(new PaymentGatewayUnavailableError('Gateway indisponível (simulado)'));
    }
    return Promise.resolve(this.getSnapshot(chargeId));
  }

  // ---------------------------------------------------------------- internos

  private async execute<T>(
    operation: PaymentOperation,
    idempotencyKey: string,
    chargeId: string | undefined,
    effect: () => Result<T, PaymentFailure>,
  ): Promise<Result<T, PaymentFailure>> {
    this.calls.push({ operation, idempotencyKey, ...(chargeId === undefined ? {} : { chargeId }) });
    const previous = this.idempotency.get(idempotencyKey);
    if (previous) {
      if (previous.operation !== operation) {
        throw new DomainInvariantViolation(
          `Chave de idempotência ${idempotencyKey} reusada em ${operation} (era ${previous.operation})`,
        );
      }
      return previous.result as Result<T, PaymentFailure>;
    }
    const scripted = this.scripted.get(operation)?.shift();
    if (scripted?.kind === 'unavailable') {
      throw new PaymentGatewayUnavailableError(`Gateway indisponível em ${operation} (simulado)`);
    }
    const result = scripted ? err(scripted.failure) : effect();
    this.idempotency.set(idempotencyKey, { operation, result });
    return result;
  }

  private enqueue(operation: PaymentOperation | 'getCharge', scripted: Scripted): void {
    const queue = this.scripted.get(operation) ?? [];
    queue.push(scripted);
    this.scripted.set(operation, queue);
  }

  private createCharge(
    method: PaymentMethod,
    status: ChargeStatus,
    amount: Money,
    ttlMs: number,
  ): ChargeState {
    const charge: ChargeState = {
      chargeId: this.nextId('ch'),
      method,
      status,
      authorizedAmount: amount,
      capturedAmount: Money.zero(),
      refundedAmount: Money.zero(),
      refundedAfterCapture: Money.zero(),
      expiresAt: new Date(this.clock.now().getTime() + ttlMs),
    };
    this.charges.set(charge.chargeId, charge);
    return charge;
  }

  private findCharge(
    chargeId: string,
    method?: PaymentMethod,
  ): Result<ChargeState, PaymentFailure> {
    const charge = this.charges.get(chargeId);
    if (!charge) return err(failure('CHARGE_NOT_FOUND', 'GATEWAY', 'Cobrança inexistente'));
    if (method && charge.method !== method) return err(invalidState(charge));
    return ok(this.refreshExpiry(charge));
  }

  /** Cartão autorizado e Pix pendente vencem pelo relógio; Pix já pago não vence. */
  private refreshExpiry(charge: ChargeState): ChargeState {
    const expirable =
      (charge.method === 'CARD' && charge.status === 'AUTHORIZED') ||
      (charge.method === 'PIX' && charge.status === 'PENDING');
    if (expirable && this.clock.now().getTime() >= charge.expiresAt.getTime()) {
      charge.status = 'EXPIRED';
    }
    return charge;
  }

  private nextId(prefix: 'ch' | 're' | 'tr'): string {
    this.sequence++;
    return `${prefix}_fake_${String(this.sequence).padStart(6, '0')}`;
  }
}

function assertPositive(amount: Money): void {
  if (amount.isZero()) throw new DomainInvariantViolation('Valor da operação deve ser positivo');
}

function invalidState(charge: ChargeState): PaymentFailure {
  return failure(
    'INVALID_CHARGE_STATE',
    'GATEWAY',
    `Operação inválida para cobrança ${charge.method} em ${charge.status}`,
  );
}

function exceeds(): PaymentFailure {
  return failure('AMOUNT_EXCEEDS_AVAILABLE', 'GATEWAY', 'Valor maior que o disponível na cobrança');
}

function voidReceipt(
  charge: ChargeState,
  status: VoidReceipt['status'],
  released: Money,
): VoidReceipt {
  return { chargeId: charge.chargeId, status, releasedAmount: released };
}

function snapshot(charge: ChargeState): ChargeSnapshot {
  return {
    chargeId: charge.chargeId,
    method: charge.method,
    status: charge.status,
    authorizedAmount: charge.authorizedAmount,
    capturedAmount: charge.capturedAmount,
    refundedAmount: charge.refundedAmount,
    expiresAt: new Date(charge.expiresAt.getTime()),
  };
}
