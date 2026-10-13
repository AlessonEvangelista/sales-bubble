import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
} from '@opentelemetry/api';

/**
 * Propagação de contexto HTTP → fila → worker (slo-observabilidade.md §4.1; c4.md §7:
 * "`traceparent` gravado no outbox e propagado aos jobs"). O produtor grava o contexto W3C
 * (`traceparent`/`tracestate`) em `job.data._otel`; o consumidor o extrai e abre um span
 * `CONSUMER` filho do span da requisição — assim um único trace liga o clique, o commit e o job.
 *
 * Não depende do BullMQ: serve para `queue.add(name, withTraceContext(data))` e para o
 * `payload` do outbox (mesmo formato).
 */
export interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
}

export type WithTraceContext<T extends object> = T & { _otel?: TraceCarrier };

/** Cópia de `data` com o contexto de trace ativo em `_otel` (sem span ativo: inalterado). */
export function withTraceContext<T extends object>(data: T): WithTraceContext<T> {
  const carrier: TraceCarrier = {};
  propagation.inject(context.active(), carrier);
  if (!carrier.traceparent) return { ...data };
  return { ...data, _otel: carrier };
}

export interface ConsumeOptions {
  /** Nome do span (ex.: `bubble-expire process`). */
  spanName: string;
  /** Nome da fila → `messaging.destination.name`. */
  queue?: string | undefined;
  /** Atributos extras SEM PII (ex.: `bubble.id`, `job.id`). */
  attributes?: Attributes | undefined;
  tracerName?: string | undefined;
}

/**
 * Executa `handler` dentro de um span `CONSUMER` cujo pai é o contexto gravado em
 * `data._otel` (ou uma raiz nova se não houver). Erros marcam o span e são relançados.
 */
export async function consumeWithTraceContext<T>(
  data: { _otel?: TraceCarrier | undefined } | undefined,
  options: ConsumeOptions,
  handler: () => Promise<T> | T,
): Promise<T> {
  const parent = propagation.extract(context.active(), data?._otel ?? {});
  const tracer = trace.getTracer(options.tracerName ?? '@bolha/observability');
  return tracer.startActiveSpan(
    options.spanName,
    {
      kind: SpanKind.CONSUMER,
      attributes: {
        'messaging.system': 'bullmq',
        'messaging.operation.type': 'process',
        ...(options.queue === undefined ? {} : { 'messaging.destination.name': options.queue }),
        ...options.attributes,
      },
    },
    parent,
    async (span) => {
      try {
        return await handler();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
