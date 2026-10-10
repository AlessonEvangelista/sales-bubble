import { describe, expect, it } from 'vitest';
import {
  FEATURE_FLAGS,
  FLAG_KEYS,
  PUBLIC_FLAG_KEYS,
  catalogDefaults,
  isFlagKey,
  parseFlagDefaults,
  publicCatalogDefaults,
  publicFlagsResponseSchema,
} from './flags.js';

describe('catálogo de feature flags', () => {
  it('contém os kill switches do plano de release §3', () => {
    expect(FLAG_KEYS).toEqual(
      expect.arrayContaining([
        'bubble_creation_enabled',
        'quota_acquisition_enabled',
        'payments_enabled',
        'pix_enabled',
        'card_enabled',
        'captures_paused',
        'purchase_bubbles_enabled',
        'public_signup_enabled',
        'beta_allowlist',
        'realtime_degraded_mode',
        'notifications_email_enabled',
        'maintenance_mode',
      ]),
    );
  });

  it('toda flag tem dono; release/permission têm data de remoção; ops é permanente', () => {
    for (const key of FLAG_KEYS) {
      const def = FEATURE_FLAGS[key];
      expect(def.owner, key).not.toBe('');
      expect(def.togglers.length, key).toBeGreaterThan(0);
      if (def.kind === 'ops') expect(def.removeBy, key).toBeNull();
      else expect(def.removeBy, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('defaults seguros: freios desligados, funcionalidades ligadas, cadastro público fechado', () => {
    const defaults = catalogDefaults();
    expect(defaults.maintenance_mode).toBe(false);
    expect(defaults.captures_paused).toBe(false);
    expect(defaults.realtime_degraded_mode).toBe(false);
    expect(defaults.payments_enabled).toBe(true);
    expect(defaults.public_signup_enabled).toBe(false);
    expect(defaults.beta_allowlist).toBe(true);
  });

  it('flags internas não são públicas', () => {
    expect(PUBLIC_FLAG_KEYS).not.toContain('captures_paused');
    expect(PUBLIC_FLAG_KEYS).not.toContain('notifications_email_enabled');
    expect(Object.keys(publicCatalogDefaults()).sort()).toEqual([...PUBLIC_FLAG_KEYS].sort());
  });

  it('isFlagKey não aceita propriedades herdadas', () => {
    expect(isFlagKey('payments_enabled')).toBe(true);
    expect(isFlagKey('toString')).toBe(false);
    expect(isFlagKey('__proto__')).toBe(false);
  });
});

describe('parseFlagDefaults (FLAGS_DEFAULTS)', () => {
  it('lê o formato do .env.example', () => {
    expect(
      parseFlagDefaults(
        'bubble_creation_enabled:true,payments_enabled:false, purchase_bubbles_enabled : true',
      ),
    ).toEqual({
      bubble_creation_enabled: true,
      payments_enabled: false,
      purchase_bubbles_enabled: true,
    });
  });

  it('vazio ou ausente → sem overrides', () => {
    expect(parseFlagDefaults(undefined)).toEqual({});
    expect(parseFlagDefaults('  ')).toEqual({});
  });

  it('rejeita chave desconhecida ou valor inválido', () => {
    expect(() => parseFlagDefaults('nao_existe:true')).toThrow(/FLAGS_DEFAULTS/);
    expect(() => parseFlagDefaults('payments_enabled:sim')).toThrow(/FLAGS_DEFAULTS/);
    expect(() => parseFlagDefaults('payments_enabled')).toThrow(/FLAGS_DEFAULTS/);
  });
});

describe('GET /flags', () => {
  it('schema aceita os defaults públicos e rejeita flag interna faltando campo', () => {
    const body = { flags: publicCatalogDefaults(), evaluated_at: '2026-10-09T12:00:00.000Z' };
    expect(publicFlagsResponseSchema.parse(body)).toEqual(body);
    expect(publicFlagsResponseSchema.safeParse({ flags: {}, evaluated_at: 'x' }).success).toBe(
      false,
    );
  });
});
