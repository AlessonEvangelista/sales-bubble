import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { redactAttributes, redactString } from '../redaction.js';

type MutableAttributes = Record<string, unknown>;

/**
 * Processador de spans que remove PII antes da exportação (ADR-0012: "traces OTel sem atributos
 * de PII"; TM-13). Envolve o processador real (ex.: `BatchSpanProcessor`) e, no fim de cada span,
 * reescreve atributos do span e dos eventos (inclusive `exception.message`/`exception.stacktrace`)
 * e o status com {@link redactAttributes}/{@link redactString}.
 *
 * É a camada da aplicação; o Collector ainda aplica `attributes/delete` como segunda barreira
 * (slo-observabilidade.md §4.1).
 */
export class RedactingSpanProcessor implements SpanProcessor {
  constructor(private readonly delegate: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    redactSpanInPlace(span);
    this.delegate.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}

/** Reescreve, no próprio objeto, os atributos/eventos/status de um span finalizado. */
export function redactSpanInPlace(span: ReadableSpan): void {
  replaceAttributes(span.attributes as MutableAttributes);
  for (const event of span.events) {
    if (event.attributes) replaceAttributes(event.attributes as MutableAttributes);
  }
  for (const link of span.links) {
    if (link.attributes) replaceAttributes(link.attributes as MutableAttributes);
  }
  const status = span.status as { message?: string };
  if (typeof status.message === 'string') status.message = redactString(status.message);
}

function replaceAttributes(target: MutableAttributes): void {
  const redacted = redactAttributes(target);
  for (const key of Object.keys(target)) target[key] = redacted[key];
}
