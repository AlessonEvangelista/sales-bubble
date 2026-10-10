import {
  flagRulesSchema,
  parseFlagDefaults,
  type FlagKey,
  type FlagOverride,
  type FlagRules,
} from '@bolha/contracts';
import { Redis } from 'ioredis';
import { CachedFeatureFlags, DEFAULT_FLAGS_CACHE_TTL_MS } from './cached-feature-flags.js';
import { RedisFlagStore } from './redis-flag-store.js';
import type { FlagAuditEntry, FlagOverrideStore } from './store.js';

export interface RedisFeatureFlagsConfig {
  redisUrl: string;
  /** Conteúdo bruto de `FLAGS_DEFAULTS`. */
  flagsDefaults?: string | undefined;
  ttlMs?: number;
  prefix?: string;
  onStoreError?: (error: unknown) => void;
}

export interface RedisFeatureFlagsHandle {
  flags: CachedFeatureFlags;
  store: RedisFlagStore;
  /**
   * Aguarda a conexão ficar pronta (até `timeoutMs`). Resolve `false` se não ficar — a
   * avaliação segue no baseline/último valor até o Redis voltar. Chame antes da 1ª leitura.
   */
  ready(timeoutMs?: number): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Monta a pilha usada pela API e pelo worker: conexão Redis dedicada (falha rápida: com o
 * Redis fora, a avaliação cai no último valor conhecido em vez de esperar), store e cache.
 */
export function createRedisFeatureFlags(config: RedisFeatureFlagsConfig): RedisFeatureFlagsHandle {
  const client = new Redis(config.redisUrl, {
    lazyConnect: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    commandTimeout: 1_000,
  });
  client.on('error', () => undefined);
  const store = new RedisFlagStore(client, config.prefix ? { prefix: config.prefix } : {});
  const flags = new CachedFeatureFlags({
    store,
    envDefaults: parseFlagDefaults(config.flagsDefaults),
    ttlMs: config.ttlMs ?? DEFAULT_FLAGS_CACHE_TTL_MS,
    ...(config.onStoreError ? { onStoreError: config.onStoreError } : {}),
  });
  return {
    flags,
    store,
    ready(timeoutMs = 2_000) {
      if (client.status === 'ready') return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          client.off('ready', onReady);
          resolve(false);
        }, timeoutMs);
        const onReady = (): void => {
          clearTimeout(timer);
          resolve(true);
        };
        client.once('ready', onReady);
      });
    },
    async close() {
      await flags.close();
      client.disconnect();
    },
  };
}

export interface SetFlagInput {
  key: FlagKey;
  enabled: boolean;
  actor: string;
  reason?: string;
  rules?: FlagRules;
}

/** Liga/desliga uma flag em runtime (CLI de on-call; endpoint admin quando houver RBAC). */
export async function setFlag(
  store: FlagOverrideStore,
  input: SetFlagInput,
  now: () => Date = () => new Date(),
): Promise<FlagAuditEntry> {
  if (!input.actor.trim()) throw new Error('Informe quem está alterando a flag (--by).');
  const override: FlagOverride = {
    enabled: input.enabled,
    updatedBy: input.actor,
    updatedAt: now().toISOString(),
    ...(input.rules ? { rules: flagRulesSchema.parse(input.rules) } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  };
  return store.write(input.key, override, {
    actor: input.actor,
    ...(input.reason ? { reason: input.reason } : {}),
  });
}

/** Remove o override: a flag volta ao `FLAGS_DEFAULTS`/catálogo. */
export async function clearFlag(
  store: FlagOverrideStore,
  key: FlagKey,
  actor: string,
  reason?: string,
): Promise<FlagAuditEntry> {
  if (!actor.trim()) throw new Error('Informe quem está alterando a flag (--by).');
  return store.write(key, null, { actor, ...(reason ? { reason } : {}) });
}
