import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Variáveis de ambiente do worker (guia de desenvolvimento §3.3). Mesma regra da API:
 * valida na inicialização e não sobe se faltar uma obrigatória. Cobre só o que já é
 * consumido; BullMQ, outbox e reconciliador acrescentam as suas quando entrarem.
 */
export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  BULLMQ_PREFIX: z.string().min(1).default('bull'),
  RECONCILER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
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
