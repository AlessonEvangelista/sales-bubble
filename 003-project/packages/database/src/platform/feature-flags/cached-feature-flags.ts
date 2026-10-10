import {
  PUBLIC_FLAG_KEYS,
  type FeatureFlags,
  type FlagContext,
  type FlagKey,
  type PublicFlags,
} from '@bolha/contracts';
import { buildBaseline, evaluateFlag, type FlagBaseline, type FlagOverrides } from './evaluate.js';
import type { FlagOverrideStore } from './store.js';

export interface CachedFeatureFlagsOptions {
  store: FlagOverrideStore;
  /** Valores de `FLAGS_DEFAULTS` (já validados com `parseFlagDefaults`). */
  envDefaults?: Partial<Record<FlagKey, boolean>>;
  /** Validade do cache em memória. Plano de release §3: efeito em ≤ 10 s. */
  ttlMs?: number;
  /** Relógio injetável (testes). */
  now?: () => number;
  /** Chamado quando o store falha; o valor anterior (ou o baseline) continua valendo. */
  onStoreError?: (error: unknown) => void;
}

export const DEFAULT_FLAGS_CACHE_TTL_MS = 10_000;

/**
 * Implementação da porta `FeatureFlags` com cache em memória (proxy de cache sobre o store).
 *
 * - Cache de `ttlMs` (padrão 10 s): no pior caso uma alteração vale em ≤ 10 s mesmo sem pub/sub.
 * - Invalidação imediata pela assinatura do store (Redis pub/sub) — `start()`.
 * - Falha do store é erro operacional: mantém o último snapshot conhecido; se nunca houve um,
 *   usa o baseline (catálogo + `FLAGS_DEFAULTS`). Nunca derruba a requisição por causa da flag.
 * - Uma única leitura em voo por vez (sem "thundering herd" quando o cache expira).
 */
export class CachedFeatureFlags implements FeatureFlags {
  private readonly baseline: FlagBaseline;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private snapshot: FlagOverrides | undefined;
  private expiresAt = 0;
  private inflight: Promise<FlagOverrides> | undefined;
  private generation = 0;
  private unsubscribe: (() => Promise<void>) | undefined;

  constructor(private readonly options: CachedFeatureFlagsOptions) {
    this.baseline = buildBaseline(options.envDefaults);
    this.ttlMs = options.ttlMs ?? DEFAULT_FLAGS_CACHE_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  /** Assina a invalidação por pub/sub. Sem isso, o cache expira só pelo TTL. */
  async start(): Promise<void> {
    if (this.unsubscribe) return;
    this.unsubscribe = await this.options.store.subscribe(() => this.invalidate());
  }

  async close(): Promise<void> {
    const unsubscribe = this.unsubscribe;
    this.unsubscribe = undefined;
    await unsubscribe?.();
  }

  /** Descarta o cache; a próxima avaliação relê o store. */
  invalidate(): void {
    this.expiresAt = 0;
    this.generation += 1;
  }

  async isEnabled(key: FlagKey, ctx?: FlagContext): Promise<boolean> {
    return evaluateFlag(key, this.baseline, await this.overrides(), ctx);
  }

  async publicFlags(ctx?: FlagContext): Promise<PublicFlags> {
    const overrides = await this.overrides();
    return Object.fromEntries(
      PUBLIC_FLAG_KEYS.map((key) => [key, evaluateFlag(key, this.baseline, overrides, ctx)]),
    ) as PublicFlags;
  }

  private overrides(): Promise<FlagOverrides> {
    if (this.snapshot && this.now() < this.expiresAt) return Promise.resolve(this.snapshot);
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async refresh(): Promise<FlagOverrides> {
    const generation = this.generation;
    try {
      const fresh = await this.options.store.readAll();
      this.snapshot = fresh;
      // Se houve invalidação durante a leitura, não considera o resultado fresco.
      this.expiresAt = generation === this.generation ? this.now() + this.ttlMs : 0;
      return fresh;
    } catch (error) {
      this.options.onStoreError?.(error);
      // Tenta de novo no máximo a cada 1 s para não martelar um Redis fora do ar.
      this.expiresAt = this.now() + Math.min(1_000, this.ttlMs);
      this.snapshot ??= {};
      return this.snapshot;
    }
  }
}
