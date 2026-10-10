import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRedisFeatureFlags, setFlag, clearFlag } from './factory.js';
import { RedisFlagStore } from './redis-flag-store.js';

/**
 * Integração com o Redis 7 do docker compose (local) ou do service do CI.
 * Usa um prefixo aleatório e apaga as próprias chaves ao final.
 */
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const prefix = `bv:test:${randomUUID()}`;

describe('RedisFlagStore (integração)', () => {
  let admin: Redis;

  beforeAll(() => {
    admin = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  });

  afterAll(async () => {
    const keys = await admin.keys(`${prefix}:*`);
    if (keys.length) await admin.del(...keys);
    admin.disconnect();
  });

  it('kill switch propaga para outra instância via pub/sub, bem antes do TTL', async () => {
    // Duas "instâncias" (ex.: API e worker) com TTL longo: só o pub/sub explica a mudança.
    const api = createRedisFeatureFlags({ redisUrl: REDIS_URL, prefix, ttlMs: 60_000 });
    const operator = createRedisFeatureFlags({ redisUrl: REDIS_URL, prefix, ttlMs: 60_000 });
    try {
      expect(await api.ready()).toBe(true);
      expect(await operator.ready()).toBe(true);
      await api.flags.start();
      await RedisFlagStore.waitSubscribed(admin, api.store.keys.channel);
      expect(await api.flags.isEnabled('payments_enabled')).toBe(true);

      await setFlag(operator.store, {
        key: 'payments_enabled',
        enabled: false,
        actor: 'on-call',
        reason: 'teste de integração',
      });

      const deadline = Date.now() + 2_000;
      let value = true;
      while (Date.now() < deadline && value) {
        value = await api.flags.isEnabled('payments_enabled');
        if (value) await new Promise((r) => setTimeout(r, 25));
      }
      expect(value).toBe(false);
    } finally {
      await api.close();
      await operator.close();
    }
  });

  it('grava override, auditoria (stream) e remove', async () => {
    const handle = createRedisFeatureFlags({ redisUrl: REDIS_URL, prefix });
    try {
      expect(await handle.ready()).toBe(true);
      await setFlag(handle.store, { key: 'pix_enabled', enabled: false, actor: 'alice' });
      const overrides = await handle.store.readAll();
      expect(overrides.pix_enabled).toMatchObject({ enabled: false, updatedBy: 'alice' });

      const cleared = await clearFlag(handle.store, 'pix_enabled', 'bob', 'normalizado');
      expect(cleared.before?.enabled).toBe(false);
      expect((await handle.store.readAll()).pix_enabled).toBeUndefined();

      const history = await handle.store.history(10);
      expect(history.slice(0, 2).map((e) => [e.key, e.actor])).toEqual([
        ['pix_enabled', 'bob'],
        ['pix_enabled', 'alice'],
      ]);
      expect(history[0]?.reason).toBe('normalizado');
    } finally {
      await handle.close();
    }
  });

  it('ignora entradas inválidas ou desconhecidas no hash', async () => {
    const handle = createRedisFeatureFlags({ redisUrl: REDIS_URL, prefix });
    try {
      expect(await handle.ready()).toBe(true);
      await admin.hset(handle.store.keys.overrides, 'flag_inexistente', '{"enabled":false}');
      await admin.hset(handle.store.keys.overrides, 'card_enabled', 'não é json');
      const overrides = await handle.store.readAll();
      expect(overrides).not.toHaveProperty('card_enabled');
      expect(await handle.flags.isEnabled('card_enabled')).toBe(true);
    } finally {
      await handle.close();
    }
  });

  it('Redis inacessível: avaliação cai no baseline sem lançar', async () => {
    const errors: unknown[] = [];
    const handle = createRedisFeatureFlags({
      redisUrl: 'redis://127.0.0.1:1',
      flagsDefaults: 'bubble_creation_enabled:false',
      onStoreError: (e) => errors.push(e),
    });
    try {
      expect(await handle.ready(300)).toBe(false);
      expect(await handle.flags.isEnabled('bubble_creation_enabled')).toBe(false);
      expect(await handle.flags.isEnabled('payments_enabled')).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      await handle.close();
    }
  });
});
