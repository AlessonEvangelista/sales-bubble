import { describe, expect, it } from 'vitest';
import { Cnpj } from './cnpj.js';

describe('Cnpj (ADR-0008 item 2 — DV local antes de chamar provedor)', () => {
  it.each([
    ['11.222.333/0001-81', '11222333000181'],
    ['11222333000181', '11222333000181'],
    ['12.ABC.345/01DE-35', '12ABC34501DE35'], // exemplo oficial do CNPJ alfanumérico
    ['12abc34501de35', '12ABC34501DE35'],
  ])('aceita %s', (raw, normalized) => {
    const parsed = Cnpj.parse(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.value).toBe(normalized);
  });

  it.each([
    '11.222.333/0001-82', // segundo DV errado
    '11222333000191', // primeiro DV errado
    '00000000000000', // repetido
    '1122233300018', // curto
    '12ABC34501DE3X', // DV não numérico
    '',
  ])('rejeita "%s" com CNPJ_INVALID', (raw) => {
    expect(Cnpj.parse(raw)).toEqual({ ok: false, error: { code: 'CNPJ_INVALID' } });
  });

  it('compara por valor e não vaza o número em toString', () => {
    const a = Cnpj.parse('11.222.333/0001-81');
    const b = Cnpj.parse('11222333000181');
    if (!a.ok || !b.ok) throw new Error('fixture inválida');
    expect(a.value.equals(b.value)).toBe(true);
    expect(`${a.value}`).toBe('Cnpj(***)');
  });
});
