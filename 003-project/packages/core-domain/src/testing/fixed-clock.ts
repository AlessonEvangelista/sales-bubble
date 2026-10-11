import type { Clock } from '../shared/clock.js';

export interface Duration {
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
  readonly ms?: number;
}

/** Instante padrão dos testes (UTC). */
export const DEFAULT_TEST_NOW = '2026-10-01T12:00:00.000Z';

export const durationToMs = (d: Duration): number =>
  (d.days ?? 0) * 86_400_000 +
  (d.hours ?? 0) * 3_600_000 +
  (d.minutes ?? 0) * 60_000 +
  (d.seconds ?? 0) * 1_000 +
  (d.ms ?? 0);

/**
 * `Clock` determinístico: o tempo só anda quando o teste manda (`advance`/`set`).
 * Cada `now()` devolve uma cópia, então mutar o `Date` retornado não altera o relógio.
 */
export class FixedClock implements Clock {
  private current: number;

  constructor(initial: Date | string = DEFAULT_TEST_NOW) {
    this.current = toEpoch(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date | string): void {
    this.current = toEpoch(instant);
  }

  advance(duration: Duration): Date {
    this.current += durationToMs(duration);
    return this.now();
  }
}

function toEpoch(instant: Date | string): number {
  const epoch = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  if (Number.isNaN(epoch)) throw new RangeError(`Instante inválido: ${String(instant)}`);
  return epoch;
}
