import { randomUUID } from 'node:crypto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { RedactingSpanProcessor } from './span-redaction.js';

/** Nomes de serviço fixos por processo (slo-observabilidade.md §4.1). */
export type ServiceName = 'bolha-api' | 'bolha-worker';

export interface TelemetryConfig {
  serviceName: ServiceName;
  /** `APP_VERSION` → `service.version`. */
  serviceVersion: string;
  /** `APP_ENV` → `deployment.environment`. */
  environment: string;
  /**
   * Base OTLP/HTTP (ex.: `http://localhost:4318`, o `otel-lgtm` do compose `--profile obs`).
   * Sem endpoint a telemetria fica desligada (default seguro: nada sai do processo).
   */
  otlpEndpoint?: string | undefined;
  /** `OTEL_SDK_DISABLED=true` desliga explicitamente (ex.: testes). */
  disabled?: boolean | undefined;
  /** Intervalo de exportação de métricas (ms). */
  metricExportIntervalMs?: number | undefined;
  /** Exportador de spans alternativo (testes). Padrão: OTLP/HTTP. */
  traceExporter?: SpanExporter | undefined;
}

export interface TelemetryHandle {
  readonly enabled: boolean;
  shutdown(): Promise<void>;
}

/** Rotas que não geram trace (sondas de saúde e RUM; fora do SLO-01). */
const IGNORED_INCOMING_PATHS = [/^\/api\/v1\/health(\/|$)/, /^\/api\/v1\/rum(\/|$)/];

let active: TelemetryHandle | undefined;

/**
 * Inicializa o OpenTelemetry (traces + métricas) do processo: `NodeSDK` com
 * auto-instrumentações (HTTP, Express, NestJS, `pg`, `ioredis`, runtime do Node), exportação
 * OTLP/HTTP e propagadores W3C (`traceparent`/`baggage`). Os spans passam pelo
 * {@link RedactingSpanProcessor} antes do lote de exportação (ADR-0012).
 *
 * Deve rodar ANTES de qualquer import de framework — por isso é chamado no `otel.ts` carregado
 * com `node --import ./dist/otel.js` (slo-observabilidade.md §4.1). Idempotente.
 */
export function startTelemetry(config: TelemetryConfig): TelemetryHandle {
  if (active) return active;
  if (config.disabled === true || !config.otlpEndpoint) {
    active = { enabled: false, shutdown: () => Promise.resolve() };
    return active;
  }

  const endpoint = config.otlpEndpoint.replace(/\/+$/, '');
  const traceExporter =
    config.traceExporter ?? new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
      'deployment.environment': config.environment,
      'deployment.environment.name': config.environment,
      'service.instance.id': randomUUID(),
    }),
    spanProcessors: [new RedactingSpanProcessor(new BatchSpanProcessor(traceExporter))],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: config.metricExportIntervalMs ?? 60_000,
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Ruído sem valor (signoz-observabilidade: "instrumentar apenas o que tem valor").
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // trace_id/span_id entram no log pelo `mixin` do nosso logger; sem envio de logs via OTel.
        '@opentelemetry/instrumentation-pino': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) =>
            IGNORED_INCOMING_PATHS.some((pattern) => pattern.test(request.url ?? '')),
          // Cabeçalhos nunca viram atributos (Authorization, Cookie…): lista vazia explícita.
          headersToSpanAttributes: { client: { requestHeaders: [], responseHeaders: [] } },
        },
      }),
    ],
  });
  sdk.start();

  active = {
    enabled: true,
    shutdown: async () => {
      await sdk.shutdown();
    },
  };
  return active;
}

/** Encerra a telemetria (flush de spans/métricas pendentes). Chamado no shutdown do Nest. */
export async function shutdownTelemetry(): Promise<void> {
  const handle = active;
  active = undefined;
  await handle?.shutdown();
}
