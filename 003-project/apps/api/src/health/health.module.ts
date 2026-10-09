import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { createPostgresProbe } from '@bolha/database';
import { Redis } from 'ioredis';
import type { ApiEnv } from '../config/env.js';
import { HealthController } from './health.controller.js';
import { READINESS_PROBES, type ReadinessProbes } from './readiness.js';

interface ManagedProbes extends ReadinessProbes {
  close(): Promise<void>;
}

/** Cria as sondas com conexões longas (uma por dependente), reaproveitadas a cada checagem. */
function createProbes(env: Pick<ApiEnv, 'DATABASE_URL' | 'REDIS_URL'>): ManagedProbes {
  const postgres = createPostgresProbe(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
  });
  // Sem listener o ioredis loga "Unhandled error event"; o status vai no /health/ready.
  redis.on('error', () => undefined);

  return {
    db: () => postgres.ping(),
    redis: async () => {
      if (redis.status === 'wait' || redis.status === 'end') await redis.connect();
      await redis.ping();
    },
    close: async () => {
      redis.disconnect();
      await postgres.close();
    },
  };
}

@Module({})
export class HealthModule implements OnApplicationShutdown {
  constructor(@Inject(READINESS_PROBES) private readonly probes: ManagedProbes) {}

  static register(env: ApiEnv): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [{ provide: READINESS_PROBES, useFactory: () => createProbes(env) }],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.probes.close();
  }
}
