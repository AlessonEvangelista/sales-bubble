import { Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  createLogger,
  shutdownTelemetry,
  type DestinationStream,
  type Logger,
} from '@bolha/observability/node';
import type { WorkerEnv } from '../config/env.js';

type ObservabilityEnv = Pick<WorkerEnv, 'APP_ENV' | 'APP_VERSION' | 'LOG_LEVEL'>;

/** Logger JSON do worker (slo-observabilidade.md §5), com redaction de PII. */
export function createWorkerLogger(env: ObservabilityEnv, destination?: DestinationStream): Logger {
  return createLogger(
    { service: 'bolha-worker', env: env.APP_ENV, version: env.APP_VERSION, level: env.LOG_LEVEL },
    destination,
  );
}

/** Faz o flush de spans e métricas no desligamento (SIGTERM). */
@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}
