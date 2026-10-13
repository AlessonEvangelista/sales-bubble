import { describe, expect, it } from 'vitest';
import { Cpf } from './cpf.js';

describe('Cpf (Value Object)', () => {
  it('valida CPF correto com ou sem pontuação', () => {
    // CPFs válidos conhecidos (algoritmo padrão)
    const validRaw = '52998224725';
    const parsed = Cpf.parse(validRaw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.value).toBe('52998224725');
      expect(parsed.value.toString()).toBe('Cpf(***)');
    }

    const withMask = Cpf.parse('529.982.247-25');
    expect(withMask.ok).toBe(true);
  });

  it('rejeita dígitos repetidos', () => {
    expect(Cpf.parse('11111111111').ok).toBe(false);
    expect(Cpf.parse('00000000000').ok).toBe(false);
  });

  it('rejeita formato ou tamanho inválido', () => {
    expect(Cpf.parse('123').ok).toBe(false);
    expect(Cpf.parse('123456789012').ok).toBe(false);
    expect(Cpf.parse('abc12345678').ok).toBe(false);
  });

  it('rejeita dígito verificador incorreto', () => {
    expect(Cpf.parse('52998224726').ok).toBe(false);
  });

  it('equals compara valores normalizados', () => {
    const cpf1 = Cpf.parse('529.982.247-25');
    const cpf2 = Cpf.parse('52998224725');
    if (cpf1.ok && cpf2.ok) {
      expect(cpf1.value.equals(cpf2.value)).toBe(true);
    }
  });
});
