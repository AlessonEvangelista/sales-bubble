import { describe, expect, it, vi } from 'vitest';
import type { FlagOverride } from '@bolha/contracts';
import { CachedFeatureFlags } from './cached-feature-flags.js';
import { buildBaseline, evaluateFlag } from './evaluate.js';
import { clearFlag, setFlag } from './factory.js';
import { InMemoryFlagStore, type FlagOverrideStore } from './store.js';

const AT = '2026-10-09T12:00:00.000Z';
const override = (enabled: boolean, extra: Partial<FlagOverride> = {}): FlagOverride => ({
  enabled,
  updatedBy: 'on-call',
  updatedAt: AT,
  ...extra,
});

describe('evaluateFlag', () => {
  const baseline = buildBaseline();

  it('sem override usa o default seguro do catálogo', () => {
    expect(evaluateFlag('payments_enabled', baseline, {})).toBe(true);
    expect(evaluateFlag('maintenance_mode', baseline, {})).toBe(false);
    expect(evaluateFlag('public_signup_enabled', baseline, {})).toBe(false);
  });

  it('FLAGS_DEFAULTS sobrepõe o catálogo e o override sobrepõe ambos', () => {
    const env = buildBaseline({ payments_enabled: false });
    expect(evaluateFlag('payments_enabled', env, {})).toBe(false);
    expect(evaluateFlag('payments_enabled', env, { payments_enabled: override(true) })).toBe(true);
    expect(evaluateFlag('payments_enabled', baseline, { payments_enabled: override(false) })).toBe(
      false,
    );
  });

  it('override ligado com regras só vale para quem casa com alguma', () => {
    const overrides = {
      purchase_bubbles_enabled: override(true, {
        rules: { accountTypes: ['PJ'], roles: ['beta'] },
      }),
    };
    expect(evaluateFlag('purchase_bubbles_enabled', baseline, overrides)).toBe(false);
    expect(
      evaluateFlag('purchase_bubbles_enabled', baseline, overrides, { accountType: 'PF' }),
    ).toBe(false);
    expect(
      evaluateFlag('purchase_bubbles_enabled', baseline, overrides, { accountType: 'PJ' }),
    ).toBe(true);
    expect(
      evaluateFlag('purchase_bubbles_enabled', baseline, overrides, {
        accountType: 'PF',
        roles: ['beta'],
      }),
    ).toBe(true);
  });

  it('override com regras vazias vale para todos', () => {
    const overrides = { pix_enabled: override(true, { rules: {} }) };
    expect(evaluateFlag('pix_enabled', buildBaseline({ pix_enabled: false }), overrides)).toBe(
      true,
    );
  });

  it('allowlist por conta', () => {
    const id = '0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44';
    const overrides = { card_enabled: override(true, { rules: { accountIds: [id] } }) };
    expect(evaluateFlag('card_enabled', baseline, overrides, { accountId: id })).toBe(true);
    expect(evaluateFlag('card_enabled', baseline, overrides, { accountId: 'outro' })).toBe(false);
  });
});

describe('CachedFeatureFlags', () => {
  function setup(store: FlagOverrideStore = new InMemoryFlagStore()) {
    let now = 0;
    const onStoreError = vi.fn();
    const flags = new CachedFeatureFlags({
      store,
      ttlMs: 10_000,
      now: () => now,
      onStoreError,
    });
    return { flags, store, onStoreError, advance: (ms: number) => (now += ms) };
  }

  it('cacheia por até 10 s e relê depois do TTL', async () => {
    const store = new InMemoryFlagStore();
    const readAll = vi.spyOn(store, 'readAll');
    const { flags, advance } = setup(store);

    expect(await flags.isEnabled('payments_enabled')).toBe(true);
    await store.write('payments_enabled', override(false), { actor: 'x' });
    expect(await flags.isEnabled('payments_enabled')).toBe(true); // ainda no cache
    advance(10_000);
    expect(await flags.isEnabled('payments_enabled')).toBe(false);
    expect(readAll).toHaveBeenCalledTimes(2);
  });

  it('invalida imediatamente quando o store notifica (pub/sub)', async () => {
    const { flags, store } = setup();
    await flags.start();
    expect(await flags.isEnabled('bubble_creation_enabled')).toBe(true);
    await setFlag(store, { key: 'bubble_creation_enabled', enabled: false, actor: 'on-call' });
    expect(await flags.isEnabled('bubble_creation_enabled')).toBe(false);
    await flags.close();
  });

  it('faz uma única leitura em voo para chamadas concorrentes', async () => {
    const store = new InMemoryFlagStore();
    const readAll = vi.spyOn(store, 'readAll');
    const { flags } = setup(store);
    await Promise.all([
      flags.isEnabled('pix_enabled'),
      flags.isEnabled('card_enabled'),
      flags.publicFlags(),
    ]);
    expect(readAll).toHaveBeenCalledTimes(1);
  });

  it('store fora do ar: mantém o último valor conhecido', async () => {
    const store = new InMemoryFlagStore({ payments_enabled: override(false) });
    const { flags, advance, onStoreError } = setup(store);
    expect(await flags.isEnabled('payments_enabled')).toBe(false);

    vi.spyOn(store, 'readAll').mockRejectedValue(new Error('ECONNREFUSED'));
    advance(10_000);
    expect(await flags.isEnabled('payments_enabled')).toBe(false);
    expect(onStoreError).toHaveBeenCalledOnce();
  });

  it('store fora do ar desde a subida: usa o baseline (catálogo + FLAGS_DEFAULTS)', async () => {
    const store = new InMemoryFlagStore();
    vi.spyOn(store, 'readAll').mockRejectedValue(new Error('ECONNREFUSED'));
    const flags = new CachedFeatureFlags({
      store,
      envDefaults: { bubble_creation_enabled: false },
    });
    expect(await flags.isEnabled('bubble_creation_enabled')).toBe(false);
    expect(await flags.isEnabled('payments_enabled')).toBe(true);
  });

  it('publicFlags expõe só as flags públicas', async () => {
    const { flags } = setup();
    const result = await flags.publicFlags();
    expect(result).toHaveProperty('maintenance_mode', false);
    expect(result).not.toHaveProperty('captures_paused');
    expect(result).not.toHaveProperty('notifications_email_enabled');
  });
});

describe('setFlag / clearFlag', () => {
  it('grava override com ator e motivo e registra auditoria', async () => {
    const store = new InMemoryFlagStore({}, () => new Date(AT));
    const entry = await setFlag(
      store,
      { key: 'payments_enabled', enabled: false, actor: 'alice', reason: 'gateway instável' },
      () => new Date(AT),
    );
    expect(entry).toMatchObject({ key: 'payments_enabled', before: null, actor: 'alice' });
    expect(entry.after).toEqual({
      enabled: false,
      updatedBy: 'alice',
      updatedAt: AT,
      reason: 'gateway instável',
    });

    const cleared = await clearFlag(store, 'payments_enabled', 'bob');
    expect(cleared.before?.enabled).toBe(false);
    expect(cleared.after).toBeNull();
    expect(await store.readAll()).toEqual({});
    expect((await store.history()).map((e) => e.actor)).toEqual(['bob', 'alice']);
  });

  it('exige ator', async () => {
    const store = new InMemoryFlagStore();
    await expect(
      setFlag(store, { key: 'pix_enabled', enabled: false, actor: ' ' }),
    ).rejects.toThrow(/--by/);
    await expect(clearFlag(store, 'pix_enabled', '')).rejects.toThrow(/--by/);
  });

  it('valida as regras', async () => {
    const store = new InMemoryFlagStore();
    await expect(
      setFlag(store, {
        key: 'pix_enabled',
        enabled: true,
        actor: 'a',
        rules: { accountIds: ['não-é-uuid'] },
      }),
    ).rejects.toThrow();
  });
});
