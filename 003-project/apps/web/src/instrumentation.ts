/**
 * Instrumentação do servidor do Next.js (`instrumentation.ts`): Sentry no runtime Node/Edge só
 * com `NEXT_PUBLIC_SENTRY_DSN` (BV-108), com a mesma redaction de PII do cliente.
 */
import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions, sentryEnvFromProcess } from './lib/sentry-options';

export function register(): void {
  const options = buildSentryOptions(sentryEnvFromProcess());
  if (options) Sentry.init(options);
}

/** Erros de Server Components, route handlers e middleware vão para o Sentry (sem PII). */
export const onRequestError = Sentry.captureRequestError;
