import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFlagDefaults } from '@bolha/contracts';
import { z } from 'zod';

/** String vazia (ex.: `OTEL_EXPORTER_OTLP_ENDPOINT=` no .env) conta como ausente. */
const emptyAsUndefined = (value: unknown): unknown => (value === '' ? undefined : value);
const optionalUrl = z.preprocess(emptyAsUndefined, z.url({ protocol: /^https?$/ }).optional());
const booleanFlag = (fallback: boolean) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? String(fallback) : value),
    z.enum(['true', 'false']).transform((value) => value === 'true'),
  );

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
  // --- Observabilidade (BV-108, slo-observabilidade.md §4–5). Todas opcionais, default seguro:
  // sem endpoint OTLP a telemetria fica desligada.
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  OTEL_SDK_DISABLED: booleanFlag(false),
  OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().min(1_000).default(60_000),
  // Feature flags (BV-113): defaults por ambiente ("chave:true,chave:false") e TTL do cache
  // em memória (plano de release §3: efeito em ≤ 10 s, por isso o teto de 10 000 ms).
  FLAGS_DEFAULTS: z
    .string()
    .optional()
    .refine(
      (raw) => {
        try {
          parseFlagDefaults(raw);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'FLAGS_DEFAULTS inválido' },
    ),
  FLAGS_CACHE_TTL_MS: z.coerce.number().int().min(100).max(10_000).default(10_000),
  // Saltos de proxy confiáveis para `req.ip` (Cloud Run/LB: 1). 0 = conexão direta.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  // Access token RS256 (BV-15, api-rest §1.2). Caminhos relativos à raiz do monorepo ou ao
  // diretório atual; em dev, gerar com `npm run keys:dev`.
  JWT_ACCESS_PRIVATE_KEY_PATH: z.string().min(1).default('./.secrets/jwt-access.pem'),
  JWT_ACCESS_PUBLIC_KEY_PATH: z.string().min(1).default('./.secrets/jwt-access.pub'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  // CAPTCHA do login após 3 falhas (US-004). `none` só fora de produção.
  CAPTCHA_PROVIDER: z.enum(['none', 'turnstile', 'hcaptcha']).default('none'),
  CAPTCHA_SECRET: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Valida o ambiente. A mensagem de erro lista apenas os NOMES das variáveis inválidas,
 * nunca os valores (podem conter segredos — TM-14).
 */
export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema
    .superRefine((env, ctx) => {
      if (env.NODE_ENV === 'production' && env.CAPTCHA_PROVIDER === 'none') {
        ctx.addIssue({ code: 'custom', path: ['CAPTCHA_PROVIDER'], message: 'none em produção' });
      }
      if (env.CAPTCHA_PROVIDER !== 'none' && !env.CAPTCHA_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['CAPTCHA_SECRET'], message: 'obrigatório' });
      }
    })
    .safeParse(source);
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
