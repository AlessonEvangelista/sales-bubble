import { err, ok, type Result } from '../shared/result.js';

const FIRST_DV_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SECOND_DV_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** 12 posições alfanuméricas (CNPJ alfanumérico da Receita, a partir de 07/2026) + 2 DVs numéricos. */
const CNPJ_SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;

/**
 * Objeto de valor CNPJ (ADR-0008 item 2): validação local do dígito verificador **antes** de
 * qualquer chamada externa. Aceita o formato numérico e o alfanumérico (valor de cada caractere =
 * código ASCII − 48, regra da Receita). Guarda só o valor normalizado (sem máscara, maiúsculo).
 *
 * É PII: nunca logar; em repouso fica cifrado (`accounts.document_enc`, ADR-0012).
 */
export class Cnpj {
  private constructor(readonly value: string) {}

  static parse(raw: string): Result<Cnpj, { code: 'CNPJ_INVALID' }> {
    const normalized = raw.replace(/[.\-/\s]/g, '').toUpperCase();
    if (!CNPJ_SHAPE.test(normalized) || /^(.)\1{13}$/.test(normalized)) {
      return err({ code: 'CNPJ_INVALID' });
    }
    const base = normalized.slice(0, 12);
    const first = checkDigit(base, FIRST_DV_WEIGHTS);
    const second = checkDigit(base + String(first), SECOND_DV_WEIGHTS);
    if (normalized.slice(12) !== `${first}${second}`) return err({ code: 'CNPJ_INVALID' });
    return ok(new Cnpj(normalized));
  }

  equals(other: Cnpj): boolean {
    return this.value === other.value;
  }

  /** Evita vazar o CNPJ em logs/interpolação acidental. */
  toString(): string {
    return 'Cnpj(***)';
  }
}

function checkDigit(chars: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < chars.length; i++) {
    sum += (chars.charCodeAt(i) - 48) * (weights[i] ?? 0);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
