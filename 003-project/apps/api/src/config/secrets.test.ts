import { describe, expect, it, vi } from 'vitest';
import { API_SECRET_NAMES } from './secret-names.js';
import {
  EnvSecretStore,
  GcpSecretManagerStore,
  createSecretStore,
  parseSecretsConfig,
  resolveSecrets,
  type FetchLike,
  type SecretStore,
} from './secrets.js';

// O mesmo arquivo secrets.ts existe no worker; tools/secrets garante que as cópias são idênticas.

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function b64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

/** Fetch falso: metadata server + Secret Manager com os segredos do mapa. */
function fakeGcp(secrets: Record<string, string>, opts: { failStatus?: number } = {}) {
  const calls: string[] = [];
  const fetch: FetchLike = (url, init) => {
    calls.push(url);
    if (url.includes('metadata.google.internal')) {
      expect(init.headers['Metadata-Flavor']).toBe('Google');
      return Promise.resolve(jsonResponse(200, { access_token: 'tok', expires_in: 3599 }));
    }
    expect(init.headers.Authorization).toBe('Bearer tok');
    if (opts.failStatus) return Promise.resolve(jsonResponse(opts.failStatus, {}));
    const id = /\/secrets\/([^/]+)\/versions\//.exec(url)?.[1] ?? '';
    const value = secrets[decodeURIComponent(id)];
    return Promise.resolve(
      value === undefined
        ? jsonResponse(404, {})
        : jsonResponse(200, { payload: { data: b64(value) } }),
    );
  };
  return { fetch, calls };
}

describe('parseSecretsConfig', () => {
  it('usa o adapter local (env) por padrão', () => {
    expect(parseSecretsConfig({}).SECRETS_PROVIDER).toBe('env');
  });

  it('exige o projeto quando o provider é o GCP Secret Manager, sem vazar valores', () => {
    expect(() => parseSecretsConfig({ SECRETS_PROVIDER: 'gcp-secret-manager' })).toThrow(
      /SECRETS_GCP_PROJECT/,
    );
    expect(() => parseSecretsConfig({ SECRETS_PROVIDER: 'vault-xyz' })).toThrow(/SECRETS_PROVIDER/);
    expect(() => parseSecretsConfig({ SECRETS_PROVIDER: 'vault-xyz' })).not.toThrow(/vault-xyz/);
  });
});

describe('EnvSecretStore', () => {
  it('lê do ambiente e trata vazio como ausente', async () => {
    const store = new EnvSecretStore({ A: 'valor', B: '' });
    await expect(store.get('A')).resolves.toBe('valor');
    await expect(store.get('B')).resolves.toBeUndefined();
    await expect(store.get('C')).resolves.toBeUndefined();
  });
});

describe('GcpSecretManagerStore (esqueleto)', () => {
  it('busca a versão latest com prefixo e reaproveita o token', async () => {
    const gcp = fakeGcp({ 'api-PAGARME_SECRET_KEY': 'valor-do-sm' });
    const store = new GcpSecretManagerStore({
      projectId: 'bolha-staging',
      prefix: 'api-',
      fetch: gcp.fetch,
    });
    await expect(store.get('PAGARME_SECRET_KEY')).resolves.toBe('valor-do-sm');
    await expect(store.get('CAPTCHA_SECRET')).resolves.toBeUndefined();
    expect(gcp.calls.filter((url) => url.includes('metadata')).length).toBe(1);
    expect(gcp.calls).toContain(
      'https://secretmanager.googleapis.com/v1/projects/bolha-staging/secrets/api-PAGARME_SECRET_KEY/versions/latest:access',
    );
  });

  it('falha (sem valor na mensagem) quando o Secret Manager nega acesso', async () => {
    const gcp = fakeGcp({}, { failStatus: 403 });
    const store = new GcpSecretManagerStore({ projectId: 'bolha-staging', fetch: gcp.fetch });
    await expect(store.get('DATABASE_URL')).rejects.toThrow(/403.*DATABASE_URL/);
  });

  it('falha quando não há identidade de serviço (metadata server indisponível)', async () => {
    const fetch: FetchLike = () => Promise.resolve(jsonResponse(500, {}));
    const store = new GcpSecretManagerStore({ projectId: 'bolha-staging', fetch });
    await expect(store.get('DATABASE_URL')).rejects.toThrow(/identidade de serviço/);
  });
});

describe('createSecretStore', () => {
  it('escolhe o adapter pelo SECRETS_PROVIDER', () => {
    expect(createSecretStore(parseSecretsConfig({}), {}).provider).toBe('env');
    const config = parseSecretsConfig({
      SECRETS_PROVIDER: 'gcp-secret-manager',
      SECRETS_GCP_PROJECT: 'bolha-prod',
    });
    expect(createSecretStore(config, {}).provider).toBe('gcp-secret-manager');
  });
});

describe('resolveSecrets', () => {
  it('com o adapter env, devolve uma cópia do ambiente sem chamadas externas', async () => {
    const source = { DATABASE_URL: 'postgresql://localhost/x', OUTRA: '1' };
    const env = await resolveSecrets(API_SECRET_NAMES, { source });
    expect(env).toEqual(source);
    expect(env).not.toBe(source);
  });

  it('com o Secret Manager, o valor remoto prevalece e ausentes ficam para o schema do env.ts', async () => {
    const gcp = fakeGcp({ DATABASE_URL: 'postgresql://sm/db', REDIS_URL: 'redis://sm:6379' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = await resolveSecrets(API_SECRET_NAMES, {
      source: {
        APP_ENV: 'production',
        SECRETS_PROVIDER: 'gcp-secret-manager',
        SECRETS_GCP_PROJECT: 'bolha-prod',
        DATABASE_URL: 'postgresql://valor-antigo/db',
      },
      fetch: gcp.fetch,
    });
    expect(env.DATABASE_URL).toBe('postgresql://sm/db');
    expect(env.REDIS_URL).toBe('redis://sm:6379');
    expect(env.PAGARME_SECRET_KEY).toBeUndefined();
    // Aviso de configuração duplicada cita só o NOME, nunca os valores.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
    expect(String(warn.mock.calls[0]?.[0])).not.toMatch(/valor-antigo|sm\/db/);
    warn.mockRestore();
  });

  it('aceita um adapter injetado (porta)', async () => {
    const store: SecretStore = {
      provider: 'gcp-secret-manager',
      get: (name) => Promise.resolve(name === 'CAPTCHA_SECRET' ? 'x' : undefined),
    };
    const env = await resolveSecrets(['CAPTCHA_SECRET'], { source: {}, store });
    expect(env.CAPTCHA_SECRET).toBe('x');
  });
});
