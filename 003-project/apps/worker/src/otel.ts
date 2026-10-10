/**
 * Pré-carregamento do OpenTelemetry do worker (slo-observabilidade.md §4.1): roda ANTES do
 * `main.js` via `node --import ./dist/otel.js dist/main.js` (instrumenta `pg`, `ioredis` e,
 * quando entrar, o BullMQ). Nunca derruba o processo: com ambiente inválido a telemetria fica
 * desligada e o `main.ts` reporta o erro de validação.
 */
import { register } from 'node:module';
import { loadDotEnv, workerEnvSchema } from './config/env.js';

// Hooks de ESM do OpenTelemetry (import-in-the-middle): necessários porque o app é ESM.
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

// Import dinâmico DEPOIS do register: nada de framework (Nest, pino, Sentry) é carregado antes
// das instrumentações. `@bolha/observability/telemetry` só depende do OpenTelemetry.
const { startTelemetry } = await import('@bolha/observability/telemetry');

loadDotEnv();
const parsed = workerEnvSchema
  .pick({
    APP_ENV: true,
    APP_VERSION: true,
    OTEL_EXPORTER_OTLP_ENDPOINT: true,
    OTEL_SDK_DISABLED: true,
    OTEL_METRIC_EXPORT_INTERVAL: true,
  })
  .safeParse(process.env);

if (parsed.success) {
  startTelemetry({
    serviceName: 'bolha-worker',
    serviceVersion: parsed.data.APP_VERSION,
    environment: parsed.data.APP_ENV,
    otlpEndpoint: parsed.data.OTEL_EXPORTER_OTLP_ENDPOINT,
    disabled: parsed.data.OTEL_SDK_DISABLED,
    metricExportIntervalMs: parsed.data.OTEL_METRIC_EXPORT_INTERVAL,
  });
}
