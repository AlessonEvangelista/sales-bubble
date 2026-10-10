import { describe, expect, it } from 'vitest';
import { DomainInvariantViolation } from './errors.js';
import { Money } from './money.js';
import { err, ok } from './result.js';

const brl = (cents: number | bigint) => Money.ofCents(cents);

describe('Money', () => {
  it('guarda centavos em bigint e moeda BRL; serializa como string', () => {
    const m = brl(12990);
    expect(m.cents).toBe(12990n);
    expect(m.currency).toBe('BRL');
    expect(m.toString()).toBe('12990');
    expect(JSON.stringify({ unitPriceCents: m })).toBe('{"unitPriceCents":"12990"}');
  });

  it('rejeita valores negativos e centavos não inteiros', () => {
    expect(() => brl(-1)).toThrow(DomainInvariantViolation);
    expect(() => brl(10.5)).toThrow(DomainInvariantViolation);
    expect(() => brl(Number.MAX_SAFE_INTEGER + 1)).toThrow(DomainInvariantViolation);
  });

  it('soma, subtrai e compara', () => {
    expect(brl(100).add(brl(50)).cents).toBe(150n);
    expect(brl(100).subtract(brl(40)).cents).toBe(60n);
    expect(() => brl(10).subtract(brl(11))).toThrow(DomainInvariantViolation);
    expect(brl(1).compare(brl(2))).toBe(-1);
    expect(brl(2).compare(brl(1))).toBe(1);
    expect(brl(2).compare(brl(2))).toBe(0);
    expect(brl(2).equals(brl(2))).toBe(true);
    expect(brl(2).equals(brl(3))).toBe(false);
    expect(Money.zero().isZero()).toBe(true);
    expect(brl(1).isZero()).toBe(false);
  });

  it('multiplica por quantidade inteira sem arredondar', () => {
    expect(brl(12990).multiply(3).cents).toBe(38970n);
    expect(brl(12990).multiply(2n).cents).toBe(25980n);
    expect(() => brl(100).multiply(1.5)).toThrow(DomainInvariantViolation);
  });

  it('multiplica por fração com arredondamento explícito', () => {
    const sixPercent = { numerator: 6n, denominator: 100n };
    const base = brl(1025); // 6% = 61,5 centavos
    expect(base.multiply(sixPercent, 'FLOOR').cents).toBe(61n);
    expect(base.multiply(sixPercent, 'CEIL').cents).toBe(62n);
    expect(base.multiply(sixPercent, 'HALF_UP').cents).toBe(62n);
    expect(base.multiply(sixPercent, 'HALF_EVEN').cents).toBe(62n); // 61,5 → par = 62
    expect(brl(1075).multiply(sixPercent, 'HALF_EVEN').cents).toBe(64n); // 64,5 → par = 64
    expect(brl(1030).multiply(sixPercent, 'HALF_EVEN').cents).toBe(62n); // 61,8 → 62
    expect(brl(1020).multiply(sixPercent, 'HALF_EVEN').cents).toBe(61n); // 61,2 → 61
    expect(brl(1020).multiply(sixPercent, 'HALF_UP').cents).toBe(61n);
    expect(brl(1000).multiply(sixPercent, 'CEIL').cents).toBe(60n); // exato
  });

  it('exige modo de arredondamento e fração válida', () => {
    const m = brl(100);
    const untyped = m.multiply.bind(m) as (factor: unknown, rounding?: unknown) => Money;
    expect(() => untyped({ numerator: 1n, denominator: 3n })).toThrow(DomainInvariantViolation);
    expect(() => m.multiply({ numerator: 1n, denominator: 0n }, 'FLOOR')).toThrow(
      DomainInvariantViolation,
    );
    expect(() => m.multiply({ numerator: -1n, denominator: 3n }, 'FLOOR')).toThrow(
      DomainInvariantViolation,
    );
  });

  it('não mistura moedas', () => {
    const other = Money.ofCents(1, 'USD' as 'BRL');
    expect(() => brl(1).add(other)).toThrow(DomainInvariantViolation);
    expect(brl(1).equals(other)).toBe(false);
  });
});

describe('Result', () => {
  it('ok/err formam a união discriminada', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err({ code: 'PF_QUOTA_LIMIT' })).toEqual({
      ok: false,
      error: { code: 'PF_QUOTA_LIMIT' },
    });
  });
});
