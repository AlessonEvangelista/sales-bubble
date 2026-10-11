import { z } from 'zod';

/*
 * Loader de segredos (BV-110 / EN-030 / SEC-10, threat model §7 e TM-14).
 *
 * ESTE ARQUIVO É IDÊNTICO em apps/api e apps/worker (apps não importam umas às outras e a
 * estrutura de pacotes do guia §2 não prevê pacote de infraestrutura compartilhada). O teste
 * `npm run test:secrets` falha se as duas cópias divergirem — altere as duas juntas.
 * A lista de segredos de cada processo fica em `secret-names.ts`, que é específico de cada app.
 *
 * Política: 002-llm/002 Docs/08-seguranca-compliance/gestao-segredos.md.
 *
 * Porta `SecretStore` + adapters escolhidos por `SECRETS_PROVIDER`:
 * - `env` (padrão): lê do ambiente do processo. Em dev/CI o ambiente vem do `.env`/runner; em
 *   staging/produção a PLATAFORMA injeta os segredos do secret manager como variáveis
 *   (Cloud Run `--set-secrets`, variáveis seladas do Railway). Nenhum código de nuvem.
 * - `gcp-secret-manager`: o próprio processo busca cada segredo no GCP Secret Manager no
 *   arranque, autenticado pela identidade de serviço (metadata server), sem chave em arquivo.
 *   ESQUELETO: a nuvem ainda não foi escolhida (BV-104, HITL); a chamada REST está pronta e
 *   testada com `fetch` falso, mas não foi validada contra um projeto real.
 *
 * Regras de segurança: nenhuma mensagem de erro ou log inclui VALORES de segredo, só nomes.
 */

export const SECRETS_PROVIDERS = ['env', 'gcp-secret-manager'] as const;
export type SecretsProvider = (typeof SECRETS_PROVIDERS)[number];

/** Porta: fonte de segredos. `undefined` = o segredo não existe nessa fonte. */
export interface SecretStore {
  readonly provider: SecretsProvider;
  get(name: string): Promise<string | undefined>;
}

const secretsConfigSchema = z
  .object({
    APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
    SECRETS_PROVIDER: z.enum(SECRETS_PROVIDERS).default('env'),
    SECRETS_GCP_PROJECT: z
      .string()
      .regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
      .optional(),
    SECRETS_GCP_PREFIX: z
      .string()
      .regex(/^[A-Za-z0-9_-]*$/)
      .default(''),
  })
  .superRefine((config, ctx) => {
    if (config.SECRETS_PROVIDER === 'gcp-secret-manager' && !config.SECRETS_GCP_PROJECT) {
      ctx.addIssue({
        code: 'custom',
        path: ['SECRETS_GCP_PROJECT'],
        message: 'obrigatório com SECRETS_PROVIDER=gcp-secret-manager',
      });
    }
  });

export type SecretsConfig = z.infer<typeof secretsConfigSchema>;

export function parseSecretsConfig(source: NodeJS.ProcessEnv): SecretsConfig {
  const result = secretsConfigSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Configuração do loader de segredos inválida: ${names.join(', ')}.`);
  }
  return result.data;
}

/** Adapter local: lê do ambiente do processo (dev/CI, ou plataforma que injeta segredos). */
export class EnvSecretStore implements SecretStore {
  readonly provider = 'env' as const;

  constructor(private readonly source: NodeJS.ProcessEnv) {}

  get(name: string): Promise<string | undefined> {
    const value = this.source[name];
    return Promise.resolve(value === undefined || value === '' ? undefined : value);
  }
}

export type FetchLike = (
  url: string,
  init: { method?: string; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-account/token';
const SECRET_MANAGER_API = 'https://secretmanager.googleapis.com/v1';
const REQUEST_TIMEOUT_MS = 5_000;

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });
const accessResponseSchema = z.object({ payload: z.object({ data: z.string() }) });

export interface GcpSecretManagerOptions {
  projectId: string;
  /** Prefixo do id do segredo no Secret Manager (ex.: `api-` → `api-DATABASE_URL`). */
  prefix?: string;
  /** Versão lida; `latest` por padrão (rotação = nova versão + reinício/novo deploy). */
  version?: string;
  fetch?: FetchLike;
}

/**
 * Adapter GCP Secret Manager (ESQUELETO — BV-104 em HITL).
 * Usa a API REST `projects/{p}/secrets/{id}/versions/{v}:access` com token OAuth da identidade de serviço,
 * obtido do metadata server do Cloud Run (sem chave JSON, sem segredo de longa duração).
 * A conta de serviço do processo precisa só de `roles/secretmanager.secretAccessor` nos
 * segredos que usa (menor privilégio).
 */
export class GcpSecretManagerStore implements SecretStore {
  readonly provider = 'gcp-secret-manager' as const;
  private token: string | undefined;
  private readonly fetch: FetchLike;

  constructor(private readonly options: GcpSecretManagerOptions) {
    this.fetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  async get(name: string): Promise<string | undefined> {
    const secretId = `${this.options.prefix ?? ''}${name}`;
    const url =
      `${SECRET_MANAGER_API}/projects/${encodeURIComponent(this.options.projectId)}` +
      `/secrets/${encodeURIComponent(secretId)}` +
      `/versions/${encodeURIComponent(this.options.version ?? 'latest')}:access`;
    const response = await this.fetch(url, {
      headers: { Authorization: `Bearer ${await this.accessToken()}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(`Secret Manager respondeu ${response.status} ao ler o segredo ${secretId}.`);
    }
    const body = accessResponseSchema.parse(await response.json());
    return Buffer.from(body.payload.data, 'base64').toString('utf8');
  }

  private async accessToken(): Promise<string> {
    if (this.token) return this.token;
    const response = await this.fetch(METADATA_TOKEN_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `Metadata server respondeu ${response.status}: o processo não tem identidade de serviço GCP.`,
      );
    }
    this.token = tokenResponseSchema.parse(await response.json()).access_token;
    return this.token;
  }
}

export function createSecretStore(
  config: SecretsConfig,
  source: NodeJS.ProcessEnv,
  deps: { fetch?: FetchLike } = {},
): SecretStore {
  switch (config.SECRETS_PROVIDER) {
    case 'env':
      return new EnvSecretStore(source);
    case 'gcp-secret-manager':
      return new GcpSecretManagerStore({
        projectId: config.SECRETS_GCP_PROJECT ?? '',
        prefix: config.SECRETS_GCP_PREFIX,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      });
  }
}

export interface ResolveSecretsOptions {
  source?: NodeJS.ProcessEnv;
  store?: SecretStore;
  fetch?: FetchLike;
}

/**
 * Resolve os segredos declarados pelo processo e devolve um NOVO objeto de ambiente
 * (`source` + segredos), pronto para a validação Zod de `env.ts`. Segredo ausente na fonte
 * não é erro aqui: quem decide se é obrigatório é o schema do `env.ts`.
 *
 * Com um provider remoto, o valor do secret manager prevalece sobre o do ambiente. Em
 * staging/produção, um segredo que também está como variável comum gera aviso (sem valor),
 * porque indica configuração duplicada fora do secret manager.
 */
export async function resolveSecrets(
  names: readonly string[],
  options: ResolveSecretsOptions = {},
): Promise<NodeJS.ProcessEnv> {
  const source = options.source ?? process.env;
  const config = parseSecretsConfig(source);
  const store =
    options.store ??
    createSecretStore(config, source, options.fetch ? { fetch: options.fetch } : {});
  const resolved: NodeJS.ProcessEnv = { ...source };
  if (store.provider === 'env') return resolved;

  const remote = config.APP_ENV === 'staging' || config.APP_ENV === 'production';
  const duplicated: string[] = [];
  for (const name of names) {
    const value = await store.get(name);
    if (value === undefined) continue;
    if (remote && source[name]) duplicated.push(name);
    resolved[name] = value;
  }
  if (duplicated.length > 0) {
    console.warn(
      `[secrets] variáveis também definidas fora do secret manager (ignoradas): ${duplicated.join(', ')}`,
    );
  }
  return resolved;
}
