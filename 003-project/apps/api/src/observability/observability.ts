import { Module, type INestApplication, type OnApplicationShutdown } from '@nestjs/common';
import {
  createLogger,
  ErrorReportingInterceptor,
  PinoNestLogger,
  requestContextMiddleware,
  shutdownTelemetry,
  type DestinationStream,
  type Logger,
} from '@bolha/observability/node';
import type { ApiEnv } from '../config/env.js';

type ObservabilityEnv = Pick<ApiEnv, 'APP_ENV' | 'APP_VERSION' | 'LOG_LEVEL'>;

/** Logger JSON da API (slo-observabilidade.md §5), com redaction de PII. */
export function createApiLogger(env: ObservabilityEnv, destination?: DestinationStream): Logger {
  return createLogger(
    { service: 'bolha-api', env: env.APP_ENV, version: env.APP_VERSION, level: env.LOG_LEVEL },
    destination,
  );
}

/**
 * Liga a observabilidade da aplicação Nest (BV-108): logger pino no lugar do logger do Nest,
 * `request_id` + log de acesso por requisição e log estruturado de erros 5xx. O OpenTelemetry é iniciado antes, no `otel.ts`.
 */
export function setupObservability(
  app: INestApplication,
  env: ObservabilityEnv,
  logger: Logger = createApiLogger(env),
): Logger {
  app.useLogger(new PinoNestLogger(logger));
  app.use(requestContextMiddleware(logger));
  app.useGlobalInterceptors(new ErrorReportingInterceptor(logger));
  return logger;
}

/** Faz o flush de spans e métricas no desligamento (SIGTERM). */
@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}
