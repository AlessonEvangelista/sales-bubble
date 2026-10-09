import { describe, expect, it } from 'vitest';
import { buildSeedPlan, parseSeedOptions, SEED_ACCOUNTS } from './seed.js';

describe('seed', () => {
  it('cria 500 bolhas por padrão e 20 com --small', () => {
    expect(buildSeedPlan(parseSeedOptions([])).bubbles).toBe(500);
    expect(buildSeedPlan(parseSeedOptions(['--small'])).bubbles).toBe(20);
  });

  it('inclui as quatro contas do guia §3.4', () => {
    expect(buildSeedPlan({ small: false }).accounts).toBe(4);
    expect(SEED_ACCOUNTS.map((a) => a.email)).toContain('admin@seed.local');
  });
});
