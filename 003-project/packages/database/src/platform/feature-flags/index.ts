/**
 * Feature flags e kill switches (BV-113 / EN-033) — módulo `platform`.
 * Catálogo e porta `FeatureFlags` em `@bolha/contracts` (flags.ts); aqui ficam avaliação,
 * cache e adapters de armazenamento. Ver guia de desenvolvimento §9 e plano de release §3.
 */
export { buildBaseline, evaluateFlag, type FlagBaseline, type FlagOverrides } from './evaluate.js';
export {
  CachedFeatureFlags,
  DEFAULT_FLAGS_CACHE_TTL_MS,
  type CachedFeatureFlagsOptions,
} from './cached-feature-flags.js';
export { InMemoryFlagStore, type FlagAuditEntry, type FlagOverrideStore } from './store.js';
export { RedisFlagStore, type RedisFlagStoreOptions } from './redis-flag-store.js';
export {
  clearFlag,
  createRedisFeatureFlags,
  setFlag,
  type RedisFeatureFlagsConfig,
  type RedisFeatureFlagsHandle,
  type SetFlagInput,
} from './factory.js';
