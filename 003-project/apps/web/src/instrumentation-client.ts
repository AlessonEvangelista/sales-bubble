/**
 * Instrumentação do cliente (Next.js `instrumentation-client.ts`, slo-observabilidade.md §4.1):
 * inicializa o Sentry no browser só quando `NEXT_PUBLIC_SENTRY_DSN` está definido (BV-108).
 * O coletor de RUM (`POST /api/v1/rum`) entra com a história de RUM.
 */
import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions, sentryEnvFromProcess } from './lib/sentry-options';

const options = buildSentryOptions(sentryEnvFromProcess());
if (options) Sentry.init(options);

/** Traces de navegação do App Router (só têm efeito com `tracesSampleRate` > 0). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
