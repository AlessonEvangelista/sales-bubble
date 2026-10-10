/**
 * Janela de deploy em produção (BV-106; pipeline-ci-cd.md §4): seg–qui, 10h–16h BRT, sem
 * feriado nem véspera; override de hotfix exige justificativa.
 */
import { describe, expect, it } from 'vitest';
import { checkDeployWindow, decide, easterSunday, nationalHolidays } from './check-window.mjs';

const at = (iso: string) => checkDeployWindow(new Date(iso));

describe('easterSunday / nationalHolidays', () => {
  it('calcula a Páscoa', () => {
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
  });

  it('inclui feriados fixos e móveis (Carnaval, Sexta-feira Santa, Corpus Christi)', () => {
    const h2027 = nationalHolidays(2027);
    for (const d of ['2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-05-27']) {
      expect(h2027.has(d)).toBe(true);
    }
    expect(nationalHolidays(2026).has('2026-11-20')).toBe(true);
  });
});

describe('checkDeployWindow', () => {
  it('permite quarta 13h BRT', () => {
    expect(at('2026-10-14T16:00:00Z').allowed).toBe(true);
  });

  it('permite o go-live de quinta 25/02/2027 às 10h BRT', () => {
    expect(at('2027-02-25T13:00:00Z').allowed).toBe(true);
  });

  it('bloqueia sexta, sábado e domingo', () => {
    expect(at('2026-10-16T15:00:00Z').allowed).toBe(false);
    expect(at('2026-10-17T15:00:00Z').allowed).toBe(false);
    expect(at('2026-10-18T15:00:00Z').allowed).toBe(false);
  });

  it('respeita os limites 10h (inclusive) e 16h (exclusive) em BRT', () => {
    expect(at('2026-10-14T12:59:00Z').allowed).toBe(false); // 09:59 BRT
    expect(at('2026-10-14T13:00:00Z').allowed).toBe(true); // 10:00 BRT
    expect(at('2026-10-14T18:59:00Z').allowed).toBe(true); // 15:59 BRT
    expect(at('2026-10-14T19:00:00Z').allowed).toBe(false); // 16:00 BRT
  });

  it('usa a data em BRT, não em UTC', () => {
    // Quinta 15/10 23:30 BRT = sexta 16/10 02:30 UTC: bloqueado pelo horário, não por ser sexta.
    expect(at('2026-10-16T02:30:00Z').reason).toContain('2026-10-15');
  });

  it('bloqueia feriado e véspera de feriado', () => {
    expect(at('2026-10-12T15:00:00Z').reason).toContain('feriado nacional'); // segunda, 12/10
    const eve = at('2026-11-19T15:00:00Z'); // quinta, véspera do 20/11
    expect(eve.allowed).toBe(false);
    expect(eve.reason).toContain('véspera');
  });
});

describe('decide (override de hotfix)', () => {
  const blocked = { allowed: false, reason: 'fora' };

  it('mantém o bloqueio sem override', () => {
    expect(decide(blocked, { override: false, justification: '' }).allowed).toBe(false);
  });

  it('exige justificativa no override', () => {
    expect(decide(blocked, { override: true, justification: 'urgente' }).allowed).toBe(false);
  });

  it('libera com override e justificativa', () => {
    const result = decide(blocked, {
      override: true,
      justification: 'Hotfix S1: pagamentos falhando (INC-42)',
    });
    expect(result).toMatchObject({ allowed: true, overridden: true });
  });

  it('não marca override quando já está dentro da janela', () => {
    const result = decide({ allowed: true, reason: 'ok' }, { override: true, justification: '' });
    expect(result).toMatchObject({ allowed: true, overridden: false });
  });
});
