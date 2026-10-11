import { DomainInvariantViolation } from './errors.js';

export type Currency = 'BRL';

/** Modo de arredondamento explícito — o único ponto de arredondamento é `Money.multiply`. */
export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'FLOOR' | 'CEIL';

/** Fração racional para multiplicações não inteiras (ex.: 6% = `{ numerator: 6n, denominator: 100n }`). */
export interface Ratio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/**
 * Objeto de valor `Money` (guia §5.4): centavos em `bigint`, moeda BRL, nunca negativo
 * (espelha os `CHECK (... >= 0)` do modelo de dados). Na API JSON serializa como string.
 */
export class Money {
  private constructor(
    readonly cents: bigint,
    readonly currency: Currency,
  ) {}

  static ofCents(cents: bigint | number, currency: Currency = 'BRL'): Money {
    if (typeof cents === 'number' && !Number.isSafeInteger(cents)) {
      throw new DomainInvariantViolation(`Money exige centavos inteiros, recebeu ${cents}`);
    }
    const value = BigInt(cents);
    if (value < 0n) throw new DomainInvariantViolation('Money não pode ser negativo');
    return new Money(value, currency);
  }

  static zero(currency: Currency = 'BRL'): Money {
    return new Money(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (other.cents > this.cents) {
      throw new DomainInvariantViolation('Subtração resultaria em Money negativo');
    }
    return new Money(this.cents - other.cents, this.currency);
  }

  /**
   * Multiplica por uma quantidade inteira (sem arredondamento) ou por uma fração, com modo de
   * arredondamento obrigatório. É o único lugar do domínio que arredonda dinheiro.
   */
  multiply(quantity: bigint | number): Money;
  multiply(ratio: Ratio, rounding: RoundingMode): Money;
  multiply(factor: bigint | number | Ratio, rounding?: RoundingMode): Money {
    if (typeof factor === 'object') {
      if (rounding === undefined) {
        throw new DomainInvariantViolation('Multiplicação por fração exige modo de arredondamento');
      }
      const cents = divide(this.cents * factor.numerator, factor.denominator, rounding);
      return Money.ofCents(cents, this.currency);
    }
    if (typeof factor === 'number' && !Number.isSafeInteger(factor)) {
      throw new DomainInvariantViolation(`Quantidade deve ser inteira, recebeu ${factor}`);
    }
    return Money.ofCents(this.cents * BigInt(factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.cents === other.cents) return 0;
    return this.cents < other.cents ? -1 : 1;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  /** Serialização para JSON/API: centavos como string (`"12990"`), sem perder precisão. */
  toString(): string {
    return this.cents.toString();
  }

  toJSON(): string {
    return this.toString();
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new DomainInvariantViolation(`Moedas diferentes: ${this.currency} × ${other.currency}`);
    }
  }
}

function divide(numerator: bigint, denominator: bigint, rounding: RoundingMode): bigint {
  if (denominator <= 0n) throw new DomainInvariantViolation('Denominador deve ser positivo');
  if (numerator < 0n) throw new DomainInvariantViolation('Fração negativa não é permitida');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;
  const twice = remainder * 2n;
  switch (rounding) {
    case 'FLOOR':
      return quotient;
    case 'CEIL':
      return quotient + 1n;
    case 'HALF_UP':
      return twice >= denominator ? quotient + 1n : quotient;
    case 'HALF_EVEN':
      if (twice !== denominator) return twice > denominator ? quotient + 1n : quotient;
      return quotient % 2n === 0n ? quotient : quotient + 1n;
  }
}
