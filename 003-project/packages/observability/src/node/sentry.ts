import { trace } from '@opentelemetry/api';
import * as Sentry from '@sentry/node';
import { sentryDataCollection, scrubBreadcrumb, scrubErrorEvent } from '../redaction.js';

export interface SentryConfig {
  /** `SENTRY_DSN`. Vazio/ausente → Sentry desligado (default seguro). */
  dsn?: string | undefined;
  /** `APP_ENV`. */
  environment: string;
  /** `APP_VERSION` → `release` (correlaciona erro e deploy). */
  release: string;
  /** `bolha-api` | `bolha-worker` (tag `service`). */
  service: string;
  /** Transporte alternativo (testes). */
  transport?: Sentry.NodeOptions['transport'];
}

let enabled = false;

/**
 * Inicializa o Sentry de erros no processo Node (api/worker). Sem DSN não faz nada.
 *
 * - `dataCollection` restritivo e `beforeSend`/`beforeSendTransaction`/`beforeBreadcrumb` com a
 *   redaction compartilhada (ADR-0012 item 4; slo-observabilidade.md §5): sem corpo, cookies,
 *   query string, cabeçalhos fora da allowlist nem PII em mensagens.
 * - Traces ficam com o OpenTelemetry (sem `enableOpenTelemetrySetup` nem `tracesSampleRate`): o
 *   Sentry só recebe erros, marcados com `trace_id` para cruzar com o backend de traces.
 */
export function initSentry(config: SentryConfig): boolean {
  if (!config.dsn) return false;
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    dataCollection: sentryDataCollection(),
    // `enableOpenTelemetrySetup` fica no default (false): os traces são do nosso NodeSDK.
    // Sem as integrações padrão: várias registram instrumentações OTel próprias (http, fetch,
    // bancos) e duplicariam os spans do nosso SDK. Ficam só as de captura de erro.
    defaultIntegrations: false,
    integrations: [
      Sentry.eventFiltersIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    initialScope: { tags: { service: config.service } },
    beforeSend: (event) => scrubErrorEvent(withTraceTags(event)),
    beforeSendTransaction: (event) => scrubErrorEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
    ...(config.transport ? { transport: config.transport } : {}),
  });
  enabled = true;
  return true;
}

/** Envia um erro ao Sentry (no-op sem DSN). Use para falhas 5xx e de jobs. */
export function captureError(error: unknown, tags: Record<string, string> = {}): void {
  if (!enabled) return;
  // O trace_id é lido aqui, ainda dentro do span da requisição/job.
  Sentry.captureException(error, { tags: { ...traceTags(), ...tags } });
}

/** Esvazia a fila de eventos (shutdown). */
export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (!enabled) return;
  await Sentry.close(timeoutMs);
  enabled = false;
}

function traceTags(): Record<string, string> {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext || !trace.isSpanContextValid(spanContext)) return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

function withTraceTags<T extends { tags?: Record<string, unknown> | undefined }>(event: T): T {
  const tags = traceTags();
  if (Object.keys(tags).length === 0 || event.tags?.trace_id !== undefined) return event;
  return { ...event, tags: { ...event.tags, ...tags } };
}
