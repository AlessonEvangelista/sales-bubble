import {
  Global,
  Inject,
  Logger,
  Module,
  type DynamicModule,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { createRedisFeatureFlags, type CachedFeatureFlags } from '@bolha/database';
import type { ApiEnv } from '../../../config/env.js';
import { FeatureDisabledFilter } from './feature-disabled.exception.js';
import { FeatureFlagsGuard } from './feature-flags.guard.js';
import { FlagsController } from './flags.controller.js';
import { FEATURE_FLAGS } from './tokens.js';

const FLAGS_LIFECYCLE = Symbol('FLAGS_LIFECYCLE');

interface FlagsLifecycle {
  flags: CachedFeatureFlags;
  /** Espera a conexão com o store (limitada); `false` = segue no padrão seguro. */
  ready?(timeoutMs?: number): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Feature flags e kill switches na API (BV-113 / EN-033; guia §9; plano de release §3).
 * Global: qualquer módulo injeta `@Inject(FEATURE_FLAGS) flags: FeatureFlags`.
 * Registra o guard global (`@FeatureGate` + `maintenance_mode`), o filtro problem+json e
 * `GET /api/v1/flags`.
 */
@Global()
@Module({})
export class FeatureFlagsModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('FeatureFlags');

  constructor(@Inject(FLAGS_LIFECYCLE) private readonly lifecycle: FlagsLifecycle) {}

  /** Produção/dev: overrides no Redis + `FLAGS_DEFAULTS` + cache de `FLAGS_CACHE_TTL_MS`. */
  static register(
    env: Pick<ApiEnv, 'REDIS_URL' | 'FLAGS_DEFAULTS' | 'FLAGS_CACHE_TTL_MS'>,
  ): DynamicModule {
    const logger = new Logger('FeatureFlags');
    let lastWarn = 0;
    return FeatureFlagsModule.forLifecycle(() =>
      createRedisFeatureFlags({
        redisUrl: env.REDIS_URL,
        flagsDefaults: env.FLAGS_DEFAULTS,
        ttlMs: env.FLAGS_CACHE_TTL_MS,
        onStoreError: (error) => {
          // No máximo um aviso por minuto; a avaliação segue com o último valor conhecido.
          if (Date.now() - lastWarn < 60_000) return;
          lastWarn = Date.now();
          logger.warn(
            `Store de flags indisponível; usando último valor conhecido/padrão seguro: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      }),
    );
  }

  /** Testes: injeta uma instância pronta (ex.: `CachedFeatureFlags` sobre `InMemoryFlagStore`). */
  static forFlags(flags: CachedFeatureFlags): DynamicModule {
    return FeatureFlagsModule.forLifecycle(() => ({ flags, close: () => flags.close() }));
  }

  private static forLifecycle(factory: () => FlagsLifecycle): DynamicModule {
    return {
      module: FeatureFlagsModule,
      controllers: [FlagsController],
      providers: [
        { provide: FLAGS_LIFECYCLE, useFactory: factory },
        {
          provide: FEATURE_FLAGS,
          useFactory: (lifecycle: FlagsLifecycle) => lifecycle.flags,
          inject: [FLAGS_LIFECYCLE],
        },
        { provide: APP_GUARD, useClass: FeatureFlagsGuard },
        { provide: APP_FILTER, useClass: FeatureDisabledFilter },
      ],
      exports: [FEATURE_FLAGS],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.lifecycle.ready && !(await this.lifecycle.ready())) {
      this.logger.warn('Redis de flags indisponível na subida; usando padrão seguro até conectar.');
    }
    try {
      await this.lifecycle.flags.start();
    } catch (error) {
      this.logger.warn(
        `Invalidação por pub/sub indisponível; vale o TTL do cache: ${String(error)}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.lifecycle.close();
  }
}
