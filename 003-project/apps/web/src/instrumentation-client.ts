/**
 * Instrumentação do cliente (Next.js `instrumentation-client.ts`, slo-observabilidade.md §4.1):
 * inicializa o Sentry no browser só quando `NEXT_PUBLIC_SENTRY_DSN` está definido (BV-108).
 *
 * Usa `@sentry/browser` (MIT) e não `@sentry/nextjs`: este puxa o Sentry CLI (licença
 * FSL-1.1, fora da allowlist de runtime) só para upload de source maps. O coletor de RUM
 * (`POST /api/v1/rum`) entra com a história de RUM.
 */
import * as Sentry from '@sentry/browser';
import { buildSentryOptions, sentryEnvFromProcess } from './lib/sentry-options';

const options = buildSentryOptions(sentryEnvFromProcess());
if (options) {
  Sentry.init({
    ...options,
    // Traces de navegação só com taxa > 0 (padrão: apenas erros).
    integrations: (defaults) =>
      options.tracesSampleRate > 0 ? [...defaults, Sentry.browserTracingIntegration()] : defaults,
  });
}
