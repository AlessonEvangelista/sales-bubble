import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Variáveis de ambiente da API (guia de desenvolvimento §3.3).
 *
 * A API valida o ambiente na inicialização e NÃO sobe se faltar uma variável obrigatória.
 * Este schema cobre só o que já é consumido; cada história acrescenta as suas variáveis
 * (JWT, PII, Pagar.me…) quando passar a usá-las. Os nomes seguem o `.env.example`.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  APP_VERSION: z.string().min(1).default('dev'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Valida o ambiente. A mensagem de erro lista apenas os NOMES das variáveis inválidas,
 * nunca os valores (podem conter segredos — TM-14).
 */
export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(
      `Variáveis de ambiente ausentes ou inválidas: ${names.join(', ')}. ` +
        'Copie 003-project/.env.example para 003-project/.env (ver README).',
    );
  }
  return result.data;
}

/**
 * Carrega o `.env` da raiz do monorepo (003-project/.env) em desenvolvimento.
 * Variáveis já definidas no processo têm precedência (staging/produção injetam pelo
 * secret manager e não têm arquivo `.env`).
 */
export function loadDotEnv(cwd: string = process.cwd()): string | undefined {
  for (const candidate of [resolve(cwd, '.env'), resolve(cwd, '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
  }
  return undefined;
}
