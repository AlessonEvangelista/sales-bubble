import { Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  createLogger,
  flushSentry,
  initSentry,
  shutdownTelemetry,
  type DestinationStream,
  type Logger,
} from '@bolha/observability/node';
import type { WorkerEnv } from '../config/env.js';

type ObservabilityEnv = Pick<WorkerEnv, 'APP_ENV' | 'APP_VERSION' | 'LOG_LEVEL' | 'SENTRY_DSN'>;

/** Logger JSON do worker (slo-observabilidade.md §5), com redaction de PII. */
export function createWorkerLogger(env: ObservabilityEnv, destination?: DestinationStream): Logger {
  return createLogger(
    { service: 'bolha-worker', env: env.APP_ENV, version: env.APP_VERSION, level: env.LOG_LEVEL },
    destination,
  );
}

/** Sentry de erros do worker (só com `SENTRY_DSN`; ver `@bolha/observability/node`). */
export function initWorkerSentry(env: ObservabilityEnv): boolean {
  return initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: env.APP_VERSION,
    service: 'bolha-worker',
  });
}

/** Faz o flush de spans, métricas e eventos do Sentry no desligamento (SIGTERM). */
@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([flushSentry(), shutdownTelemetry()]);
  }
}
