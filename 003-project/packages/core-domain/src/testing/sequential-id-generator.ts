import type { IdGenerator, Uuid } from '../shared/ids.js';

/**
 * `IdGenerator` determinístico: UUIDs no formato v7 (versão 7, variante RFC 9562) com sufixo
 * sequencial — `00000000-0000-7000-8000-000000000001`, `...002`, ... Ordenáveis como os reais.
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter: number;

  constructor(start = 1) {
    this.counter = start;
  }

  next(): Uuid {
    const suffix = (this.counter++).toString(16).padStart(12, '0');
    return `00000000-0000-7000-8000-${suffix}`;
  }
}
