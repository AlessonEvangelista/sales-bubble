import { beforeEach, describe, expect, it } from 'vitest';
import {
  PaymentGatewayUnavailableError,
  paymentIdempotencyKeys as keys,
  type PaymentFailure,
} from '../payment/index.js';
import { DomainInvariantViolation } from '../shared/errors.js';
import { Money } from '../shared/money.js';
import { FAKE_CARD_TOKENS, FakePaymentPort } from './fake-payment-port.js';
import { FixedClock } from './fixed-clock.js';

const brl = (cents: number) => Money.ofCents(cents);
const ACCOUNT = '00000000-0000-7000-8000-0000000000aa';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: PaymentFailure }): T {
  if (!r.ok) throw new Error(`esperava ok, veio ${r.error.code}`);
  return r.value;
}

describe('FakePaymentPort', () => {
  let clock: FixedClock;
  let gateway: FakePaymentPort;

  beforeEach(() => {
    clock = new FixedClock();
    gateway = new FakePaymentPort({ clock });
  });

  const authorize = (amount = 30000, paymentId = 'p1', cardToken = 'tok_any') =>
    gateway.authorizeCard({
      amount: brl(amount),
      cardToken,
      idempotencyKey: keys.pay(paymentId),
      customerRef: ACCOUNT,
    });

  const pix = (amount = 10000, paymentId = 'x1') =>
    gateway.createPixCharge({
      amount: brl(amount),
      expiresInSec: 900,
      idempotencyKey: keys.pay(paymentId),
      customerRef: ACCOUNT,
    });

  describe('cartão: pré-autorização e captura', () => {
    it('pré-autoriza com validade de 5 dias e captura parcialmente, liberando a diferença', async () => {
      const auth = unwrap(await authorize(30000));
      expect(auth.status).toBe('AUTHORIZED');
      expect(auth.expiresAt.toISOString()).toBe('2026-10-06T12:00:00.000Z');

      const cap = unwrap(
        await gateway.capture({
          chargeId: auth.chargeId,
          amount: brl(24000),
          idempotencyKey: keys.capture('p1'),
        }),
      );
      expect(cap.capturedAmount.cents).toBe(24000n);
      expect(cap.releasedAmount.cents).toBe(6000n);
      expect(gateway.getSnapshot(auth.chargeId)?.status).toBe('CAPTURED');
      expect(gateway.orphanAuthorizations()).toHaveLength(0);
    });

    it('respeita a validade configurável e falha a captura com AUTH_EXPIRED', async () => {
      gateway = new FakePaymentPort({ clock, authorizationTtlMs: 1000 });
      const auth = unwrap(await authorize());
      clock.advance({ seconds: 1 });
      const cap = await gateway.capture({
        chargeId: auth.chargeId,
        amount: brl(1),
        idempotencyKey: keys.capture('p1'),
      });
      expect(cap).toMatchObject({
        ok: false,
        error: { code: 'AUTHORIZATION_EXPIRED', cause: 'AUTH_EXPIRED' },
      });
      expect(gateway.orphanAuthorizations()).toHaveLength(0);
    });

    it('rejeita captura acima do autorizado, em estado inválido, de Pix ou inexistente', async () => {
      const auth = unwrap(await authorize(1000));
      const over = await gateway.capture({
        chargeId: auth.chargeId,
        amount: brl(1001),
        idempotencyKey: 'c-over',
      });
      expect(over).toMatchObject({ ok: false, error: { code: 'AMOUNT_EXCEEDS_AVAILABLE' } });

      unwrap(
        await gateway.capture({ chargeId: auth.chargeId, amount: brl(1000), idempotencyKey: 'c1' }),
      );
      const again = await gateway.capture({
        chargeId: auth.chargeId,
        amount: brl(1),
        idempotencyKey: 'c2',
      });
      expect(again).toMatchObject({ ok: false, error: { code: 'INVALID_CHARGE_STATE' } });

      const charge = unwrap(await pix());
      const wrongMethod = await gateway.capture({
        chargeId: charge.chargeId,
        amount: brl(1),
        idempotencyKey: 'c3',
      });
      expect(wrongMethod).toMatchObject({ ok: false, error: { code: 'INVALID_CHARGE_STATE' } });

      const missing = await gateway.capture({
        chargeId: 'nope',
        amount: brl(1),
        idempotencyKey: 'c4',
      });
      expect(missing).toMatchObject({
        ok: false,
        error: { code: 'CHARGE_NOT_FOUND', cause: 'GATEWAY' },
      });
    });

    it('recusa pelos tokens de teste e trata indisponibilidade como exceção', async () => {
      expect(await authorize(100, 'd1', FAKE_CARD_TOKENS.declined)).toMatchObject({
        ok: false,
        error: { code: 'DECLINED', cause: 'PAYER' },
      });
      expect(await authorize(100, 'd2', FAKE_CARD_TOKENS.insufficientFunds)).toMatchObject({
        ok: false,
        error: { code: 'INSUFFICIENT_FUNDS' },
      });
      await expect(authorize(100, 'd3', FAKE_CARD_TOKENS.unavailable)).rejects.toBeInstanceOf(
        PaymentGatewayUnavailableError,
      );
      expect(unwrap(await authorize(100, 'd4', FAKE_CARD_TOKENS.approved)).status).toBe(
        'AUTHORIZED',
      );
    });

    it('rejeita valor zero como invariante violada', async () => {
      await expect(authorize(0)).rejects.toBeInstanceOf(DomainInvariantViolation);
    });
  });

  describe('idempotência (ADR-0003 item 2)', () => {
    it('mesma chave devolve o mesmo resultado sem nova movimentação', async () => {
      const first = unwrap(await authorize(500, 'same'));
      const second = unwrap(await authorize(500, 'same'));
      expect(second.chargeId).toBe(first.chargeId);
      expect(gateway.orphanAuthorizations()).toHaveLength(1);
      expect(gateway.calls.filter((c) => c.operation === 'authorizeCard')).toHaveLength(2);
    });

    it('memoriza recusas, mas não indisponibilidade (retry com a mesma chave passa)', async () => {
      gateway.declineNext('authorizeCard', {
        code: 'DECLINED',
        cause: 'PAYER',
        reason: 'roteiro',
      });
      expect((await authorize(500, 'k1')).ok).toBe(false);
      expect((await authorize(500, 'k1')).ok).toBe(false);

      gateway.failNextWithOutage('authorizeCard');
      await expect(authorize(500, 'k2')).rejects.toBeInstanceOf(PaymentGatewayUnavailableError);
      expect((await authorize(500, 'k2')).ok).toBe(true);
    });

    it('reusar a chave em outra operação é bug', async () => {
      const auth = unwrap(await authorize(500, 'k'));
      await expect(
        gateway.capture({ chargeId: auth.chargeId, amount: brl(1), idempotencyKey: keys.pay('k') }),
      ).rejects.toBeInstanceOf(DomainInvariantViolation);
    });
  });

  describe('Pix: cobrança, pagamento e liquidação com estorno da diferença', () => {
    it('liquida o preço final e estorna a diferença', async () => {
      const charge = unwrap(await pix(10000));
      expect(charge.status).toBe('PENDING');
      expect(charge.qrCode).toContain(charge.chargeId);
      expect(charge.expiresAt.toISOString()).toBe('2026-10-01T12:15:00.000Z');

      const notPaid = await gateway.settlePix({
        chargeId: charge.chargeId,
        finalAmount: brl(8000),
        idempotencyKey: 's0',
      });
      expect(notPaid).toMatchObject({
        ok: false,
        error: { code: 'PIX_NOT_PAID', cause: 'PIX_NOT_PAID' },
      });

      gateway.markPixPaid(charge.chargeId);
      expect(gateway.orphanAuthorizations()).toHaveLength(1);

      const over = await gateway.settlePix({
        chargeId: charge.chargeId,
        finalAmount: brl(10001),
        idempotencyKey: 's1',
      });
      expect(over).toMatchObject({ ok: false, error: { code: 'AMOUNT_EXCEEDS_AVAILABLE' } });

      const settled = unwrap(
        await gateway.settlePix({
          chargeId: charge.chargeId,
          finalAmount: brl(8000),
          idempotencyKey: keys.capture('x1'),
        }),
      );
      expect(settled.capturedAmount.cents).toBe(8000n);
      expect(settled.releasedAmount.cents).toBe(2000n);
      expect(gateway.getSnapshot(charge.chargeId)).toMatchObject({
        status: 'CAPTURED',
        refundedAmount: brl(2000),
      });

      const twice = await gateway.settlePix({
        chargeId: charge.chargeId,
        finalAmount: brl(8000),
        idempotencyKey: 's2',
      });
      expect(twice).toMatchObject({ ok: false, error: { code: 'INVALID_CHARGE_STATE' } });
      expect(gateway.orphanAuthorizations()).toHaveLength(0);
    });

    it('QR vencido não pode ser pago nem liquidado; Pix pago não vence', async () => {
      const expired = unwrap(await pix(100, 'e1'));
      const paid = unwrap(await pix(100, 'e2'));
      gateway.markPixPaid(paid.chargeId);
      clock.advance({ minutes: 15 });

      expect(() => gateway.markPixPaid(expired.chargeId)).toThrow(DomainInvariantViolation);
      expect(() => gateway.markPixPaid('nope')).toThrow(DomainInvariantViolation);
      const settle = await gateway.settlePix({
        chargeId: expired.chargeId,
        finalAmount: brl(100),
        idempotencyKey: 's-exp',
      });
      expect(settle).toMatchObject({ ok: false, error: { code: 'PIX_EXPIRED' } });
      expect(gateway.getSnapshot(paid.chargeId)?.status).toBe('AUTHORIZED');
    });

    it('liquidar cobrança de cartão como Pix é estado inválido', async () => {
      const auth = unwrap(await authorize());
      const r = await gateway.settlePix({
        chargeId: auth.chargeId,
        finalAmount: brl(1),
        idempotencyKey: 's-card',
      });
      expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_CHARGE_STATE' } });
      const missing = await gateway.settlePix({
        chargeId: 'x',
        finalAmount: brl(1),
        idempotencyKey: 's-x',
      });
      expect(missing).toMatchObject({ ok: false, error: { code: 'CHARGE_NOT_FOUND' } });
    });
  });

  describe('void (compensação)', () => {
    it('anula pré-autorização de cartão liberando o valor inteiro', async () => {
      const auth = unwrap(await authorize(700));
      const v = unwrap(
        await gateway.void({ chargeId: auth.chargeId, idempotencyKey: keys.void('p1') }),
      );
      expect(v).toMatchObject({ status: 'VOIDED', releasedAmount: brl(700) });
      expect(gateway.orphanAuthorizations()).toHaveLength(0);
    });

    it('Pix pago vira estorno integral; Pix pendente ou vencido é só cancelado', async () => {
      const paid = unwrap(await pix(900, 'v1'));
      gateway.markPixPaid(paid.chargeId);
      expect(
        unwrap(await gateway.void({ chargeId: paid.chargeId, idempotencyKey: 'v1' })),
      ).toMatchObject({
        status: 'REFUNDED',
        releasedAmount: brl(900),
      });

      const pending = unwrap(await pix(900, 'v2'));
      expect(
        unwrap(await gateway.void({ chargeId: pending.chargeId, idempotencyKey: 'v2' })),
      ).toMatchObject({
        status: 'VOIDED',
        releasedAmount: Money.zero(),
      });

      const auth = unwrap(await authorize(100, 'v3'));
      clock.advance({ days: 6 });
      expect(
        unwrap(await gateway.void({ chargeId: auth.chargeId, idempotencyKey: 'v3' })).status,
      ).toBe('VOIDED');
    });

    it('não anula o que já foi capturado nem o que não existe', async () => {
      const auth = unwrap(await authorize(100));
      unwrap(
        await gateway.capture({ chargeId: auth.chargeId, amount: brl(100), idempotencyKey: 'c' }),
      );
      expect(await gateway.void({ chargeId: auth.chargeId, idempotencyKey: 'v' })).toMatchObject({
        ok: false,
        error: { code: 'INVALID_CHARGE_STATE' },
      });
      expect(await gateway.void({ chargeId: 'nope', idempotencyKey: 'v-x' })).toMatchObject({
        ok: false,
        error: { code: 'CHARGE_NOT_FOUND' },
      });
    });
  });

  describe('refund', () => {
    it('estorna parcialmente até o capturado e marca REFUNDED quando zera', async () => {
      const auth = unwrap(await authorize(1000));
      unwrap(
        await gateway.capture({ chargeId: auth.chargeId, amount: brl(800), idempotencyKey: 'c' }),
      );

      const r1 = unwrap(
        await gateway.refund({
          chargeId: auth.chargeId,
          amount: brl(300),
          idempotencyKey: keys.refund('p1', 'WITHDRAWAL'),
        }),
      );
      expect(r1).toMatchObject({ status: 'SUCCEEDED', amount: brl(300) });
      expect(r1.refundId).toMatch(/^re_fake_/);

      expect(
        await gateway.refund({
          chargeId: auth.chargeId,
          amount: brl(501),
          idempotencyKey: 'r-over',
        }),
      ).toMatchObject({ ok: false, error: { code: 'AMOUNT_EXCEEDS_AVAILABLE' } });

      unwrap(
        await gateway.refund({ chargeId: auth.chargeId, amount: brl(500), idempotencyKey: 'r2' }),
      );
      expect(gateway.getSnapshot(auth.chargeId)).toMatchObject({
        status: 'REFUNDED',
        refundedAmount: brl(800),
      });
    });

    it('não estorna cobrança não capturada nem inexistente', async () => {
      const auth = unwrap(await authorize(1000));
      expect(
        await gateway.refund({ chargeId: auth.chargeId, amount: brl(1), idempotencyKey: 'r' }),
      ).toMatchObject({ ok: false, error: { code: 'INVALID_CHARGE_STATE' } });
      expect(
        await gateway.refund({ chargeId: 'nope', amount: brl(1), idempotencyKey: 'r-x' }),
      ).toMatchObject({ ok: false, error: { code: 'CHARGE_NOT_FOUND' } });
    });
  });

  describe('repasse e consulta', () => {
    it('libera repasse ao recebedor e registra', async () => {
      const r = unwrap(
        await gateway.releasePayout({
          recipientId: 're_seller',
          amount: brl(9000),
          idempotencyKey: keys.payout('po1'),
        }),
      );
      expect(r).toMatchObject({ status: 'RELEASED', recipientId: 're_seller', amount: brl(9000) });
      expect(r.transferId).toMatch(/^tr_fake_/);
      expect(gateway.payouts).toHaveLength(1);

      gateway.declineNext('releasePayout', {
        code: 'RECIPIENT_NOT_FOUND',
        cause: 'GATEWAY',
        reason: 'recebedor não aprovado',
      });
      expect(
        await gateway.releasePayout({ recipientId: 'x', amount: brl(1), idempotencyKey: 'po2' }),
      ).toMatchObject({ ok: false, error: { code: 'RECIPIENT_NOT_FOUND' } });
      expect(gateway.payouts).toHaveLength(1);
    });

    it('getCharge faz fetch-back e pode simular indisponibilidade', async () => {
      const auth = unwrap(await authorize(100));
      expect(await gateway.getCharge(auth.chargeId)).toMatchObject({
        chargeId: auth.chargeId,
        method: 'CARD',
        status: 'AUTHORIZED',
        capturedAmount: Money.zero(),
      });
      expect(await gateway.getCharge('nope')).toBeNull();
      gateway.failNextWithOutage('getCharge');
      await expect(gateway.getCharge(auth.chargeId)).rejects.toBeInstanceOf(
        PaymentGatewayUnavailableError,
      );
      expect(gateway.calls.at(-1)).toEqual({ operation: 'getCharge', chargeId: auth.chargeId });
    });
  });
});

describe('paymentIdempotencyKeys', () => {
  it('deriva chaves determinísticas do domínio (ADR-0003 item 2)', () => {
    expect(keys.pay('p')).toBe('pay__p');
    expect(keys.capture('p')).toBe('capture__p');
    expect(keys.void('p')).toBe('void__p');
    expect(keys.refund('p', 'GOAL_NOT_MET')).toBe('refund__p__GOAL_NOT_MET');
    expect(keys.payout('o')).toBe('payout__o');
  });
});
