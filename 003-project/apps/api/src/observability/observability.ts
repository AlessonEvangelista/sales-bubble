import { Module, type INestApplication, type OnApplicationShutdown } from '@nestjs/common';
import {
  createLogger,
  ErrorReportingInterceptor,
  flushSentry,
  initSentry,
  PinoNestLogger,
  requestContextMiddleware,
  shutdownTelemetry,
  type DestinationStream,
  type Logger,
} from '@bolha/observability/node';
import type { ApiEnv } from '../config/env.js';

type ObservabilityEnv = Pick<ApiEnv, 'APP_ENV' | 'APP_VERSION' | 'LOG_LEVEL' | 'SENTRY_DSN'>;

/** Logger JSON da API (slo-observabilidade.md §5), com redaction de PII. */
export function createApiLogger(env: ObservabilityEnv, destination?: DestinationStream): Logger {
  return createLogger(
    { service: 'bolha-api', env: env.APP_ENV, version: env.APP_VERSION, level: env.LOG_LEVEL },
    destination,
  );
}

/**
 * Liga a observabilidade da aplicação Nest (BV-108): Sentry (só com `SENTRY_DSN`), logger pino
 * no lugar do logger do Nest, `request_id` + log de acesso por requisição e captura de erros
 * 5xx. O OpenTelemetry é iniciado antes, no `otel.ts`.
 */
export function setupObservability(
  app: INestApplication,
  env: ObservabilityEnv,
  logger: Logger = createApiLogger(env),
): Logger {
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: env.APP_VERSION,
    service: 'bolha-api',
  });
  app.useLogger(new PinoNestLogger(logger));
  app.use(requestContextMiddleware(logger));
  app.useGlobalInterceptors(new ErrorReportingInterceptor(logger));
  return logger;
}

/** Faz o flush de spans, métricas e eventos do Sentry no desligamento (SIGTERM). */
@Module({})
export class ObservabilityModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([flushSentry(), shutdownTelemetry()]);
  }
}
