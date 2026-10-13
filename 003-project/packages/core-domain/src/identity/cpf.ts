import { err, ok, type Result } from '../shared/result.js';

const CPF_SHAPE = /^\d{11}$/;

/**
 * Objeto de valor CPF: validação determinística do dígito verificador.
 * Guarda apenas o valor numérico normalizado de 11 dígitos.
 * PII: toString mascarado para evitar vazamento acidental em logs.
 */
export class Cpf {
  private constructor(readonly value: string) {}

  static parse(raw: string): Result<Cpf, { code: 'CPF_INVALID' }> {
    const normalized = raw.replace(/\D/g, '');
    if (!CPF_SHAPE.test(normalized) || /^(.)\1{10}$/.test(normalized)) {
      return err({ code: 'CPF_INVALID' });
    }

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += Number(normalized[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== Number(normalized[9])) {
      return err({ code: 'CPF_INVALID' });
    }

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(normalized[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== Number(normalized[10])) {
      return err({ code: 'CPF_INVALID' });
    }

    return ok(new Cpf(normalized));
  }

  equals(other: Cpf): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return 'Cpf(***)';
  }
}
