import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** String vazia (`SENTRY_DSN=` no .env) conta como ausente. */
const emptyAsUndefined = (value: unknown): unknown => (value === '' ? undefined : value);
const optionalUrl = z.preprocess(emptyAsUndefined, z.url({ protocol: /^https?$/ }).optional());
const booleanFlag = (fallback: boolean) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? String(fallback) : value),
    z.enum(['true', 'false']).transform((value) => value === 'true'),
  );

/**
 * Variáveis de ambiente do worker (guia de desenvolvimento §3.3). Mesma regra da API:
 * valida na inicialização e não sobe se faltar uma obrigatória. Cobre só o que já é
 * consumido; BullMQ, outbox e reconciliador acrescentam as suas quando entrarem.
 */
export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  APP_VERSION: z.string().min(1).default('dev'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  BULLMQ_PREFIX: z.string().min(1).default('bull'),
  RECONCILER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  // --- Observabilidade (BV-108, slo-observabilidade.md §4–5). Todas opcionais, default seguro:
  // sem endpoint OTLP a telemetria fica desligada; sem DSN o Sentry fica desligado.
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  OTEL_SDK_DISABLED: booleanFlag(false),
  OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().min(1_000).default(60_000),
  SENTRY_DSN: optionalUrl,
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/** Lista só os nomes das variáveis inválidas, nunca os valores (TM-14). */
export function parseWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(
      `Variáveis de ambiente ausentes ou inválidas: ${names.join(', ')}. ` +
        'Copie 003-project/.env.example para 003-project/.env (ver README).',
    );
  }
  return result.data;
}

/** Carrega o 003-project/.env em desenvolvimento; variáveis do processo têm precedência. */
export function loadDotEnv(cwd: string = process.cwd()): string | undefined {
  for (const candidate of [resolve(cwd, '.env'), resolve(cwd, '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
  }
  return undefined;
}
