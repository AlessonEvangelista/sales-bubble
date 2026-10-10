import { sentryDataCollection, scrubBreadcrumb, scrubErrorEvent } from '@bolha/observability';

/**
 * Opções do Sentry do front (BV-108; slo-observabilidade.md §4.1 e §5). Sem
 * `NEXT_PUBLIC_SENTRY_DSN` devolve `undefined` e o Sentry não é iniciado (default seguro).
 *
 * `dataCollection` restritivo (v11) + `beforeSend`/`beforeBreadcrumb` com a redaction compartilhada de
 * `@bolha/observability` (entrada pura, sem APIs do Node): sem corpo, cookies, query string,
 * cabeçalhos fora da allowlist nem e-mail/CPF/CNPJ/telefone/tokens em mensagens e breadcrumbs.
 */
export interface WebSentryEnv {
  dsn?: string | undefined;
  environment?: string | undefined;
  release?: string | undefined;
  tracesSampleRate?: string | undefined;
}

export function buildSentryOptions(env: WebSentryEnv) {
  if (!env.dsn) return undefined;
  const rate = Number(env.tracesSampleRate ?? '0');
  return {
    dsn: env.dsn,
    environment: env.environment ?? 'local',
    release: env.release ?? 'dev',
    dataCollection: sentryDataCollection(),
    // Traces de navegação só quando configurado (0 = apenas erros).
    tracesSampleRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0,
    beforeSend: <T extends object>(event: T): T => scrubErrorEvent(event),
    beforeBreadcrumb: <T extends { message?: string | undefined; data?: unknown }>(
      breadcrumb: T,
    ): T => scrubBreadcrumb(breadcrumb),
  };
}

/** Lê as variáveis públicas (inlined pelo Next no build). */
export function sentryEnvFromProcess(): WebSentryEnv {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  };
}
