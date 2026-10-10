/**
 * `@bolha/observability/node` — observabilidade dos processos Node (api e worker), BV-108:
 * OpenTelemetry (traces + métricas, OTLP), logger pino estruturado sem PII, Sentry de erros,
 * propagação de contexto HTTP → fila → worker e adaptadores NestJS.
 * Não importar no `apps/web` (regra de fronteira `web-observability-browser-only`).
 */
export {
  startTelemetry,
  shutdownTelemetry,
  type ServiceName,
  type TelemetryConfig,
  type TelemetryHandle,
} from './telemetry.js';
export { RedactingSpanProcessor, redactSpanInPlace } from './span-redaction.js';
export {
  createLogger,
  correlationFields,
  PINO_REDACT_PATHS,
  type DestinationStream,
  type Logger,
  type LoggerConfig,
  type LogLevel,
} from './logger.js';
export { initSentry, captureError, flushSentry, type SentryConfig } from './sentry.js';
export {
  withTraceContext,
  consumeWithTraceContext,
  type ConsumeOptions,
  type TraceCarrier,
  type WithTraceContext,
} from './propagation.js';
export {
  getRequestContext,
  resolveRequestId,
  runWithRequestContext,
  REQUEST_ID_HEADER,
  type RequestContext,
} from './request-context.js';
export { ErrorReportingInterceptor, PinoNestLogger, requestContextMiddleware } from './nest.js';
