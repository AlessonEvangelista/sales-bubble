import { CloudKmsKeyProvider, type KmsClient } from './cloud-kms-key-provider.js';
import { PiiCryptoError } from './errors.js';
import type { HmacKeyMaterial } from './hmac-keyring.js';
import type { KeyProvider } from './key-provider.js';
import { LocalKeyProvider, type LocalKek } from './local-key-provider.js';

/**
 * Variáveis lidas (guia §3.3; `.env.example`, bloco "Criptografia de PII" e bloco BV-109):
 *
 * | Variável | Uso |
 * | `PII_KMS_PROVIDER` | `local` (dev/CI) · `secret-manager` · `gcp-kms` (ou outro KMS em nuvem) |
 * | `PII_DATA_KEY_BASE64` / `PII_DATA_KEY_ID` | KEK local ativa (32 bytes) e seu id (`local`/`secret-manager`) |
 * | `PII_DATA_KEYS_PREVIOUS` | KEKs antigas `id:base64,id:base64` (só *unwrap*, rotação) |
 * | `PII_KMS_KEY_NAME` / `PII_KMS_KEY_NAMES_PREVIOUS` | KEK no KMS em nuvem (nome/alias) e antigas (`,`) |
 * | `PII_HMAC_KEY_BASE64` / `PII_HMAC_KEY_VERSION` | *pepper* ativo (≥ 32 bytes) e versão (padrão 1) |
 * | `PII_HMAC_KEYS_PREVIOUS` | *peppers* antigos `versão:base64,…` (busca durante o recálculo) |
 *
 * O `.env` só é aceitável em dev/CI. `local` é recusado com `NODE_ENV=production` (c4.md §7).
 */
export type PiiEnv = Readonly<Record<string, string | undefined>>;

export interface KeyProviderFactoryOptions {
  /** Cliente do KMS em nuvem — obrigatório para `PII_KMS_PROVIDER` diferente de local/secret-manager. */
  readonly kmsClient?: KmsClient;
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function createKeyProviderFromEnv(
  env: PiiEnv,
  options: KeyProviderFactoryOptions = {},
): KeyProvider {
  const provider = (env['PII_KMS_PROVIDER'] ?? 'local').trim();
  const hmac = readHmacKeys(env);

  if (provider === 'local' || provider === 'secret-manager') {
    if (provider === 'local' && env['NODE_ENV'] === 'production') {
      throw new PiiCryptoError(
        'INVALID_CONFIG',
        'PII_KMS_PROVIDER=local é só para dev/CI; em produção use o KMS (ADR-0012).',
      );
    }
    const activeKek: LocalKek = {
      id: (env['PII_DATA_KEY_ID'] ?? 'dev-key-1').trim(),
      key: decodeKey(env['PII_DATA_KEY_BASE64'], 'PII_DATA_KEY_BASE64'),
    };
    return new LocalKeyProvider({
      kind: provider,
      activeKek,
      previousKeks: parsePairs(env['PII_DATA_KEYS_PREVIOUS'], 'PII_DATA_KEYS_PREVIOUS').map(
        ([id, b64]) => ({ id, key: decodeKey(b64, 'PII_DATA_KEYS_PREVIOUS') }),
      ),
      activeHmacKey: hmac.active,
      previousHmacKeys: hmac.previous,
    });
  }

  // KMS em nuvem (ex.: gcp-kms). O cliente do SDK é injetado pela composição da app.
  if (!options.kmsClient) {
    throw new PiiCryptoError(
      'KMS_NOT_CONFIGURED',
      `PII_KMS_PROVIDER=${provider} exige um cliente de KMS; a nuvem ainda não foi definida (BV-104).`,
    );
  }
  const keyName = env['PII_KMS_KEY_NAME']?.trim();
  if (!keyName) {
    throw new PiiCryptoError('INVALID_CONFIG', 'PII_KMS_KEY_NAME é obrigatório para KMS em nuvem.');
  }
  return new CloudKmsKeyProvider({
    client: options.kmsClient,
    activeKekName: keyName,
    previousKekNames: (env['PII_KMS_KEY_NAMES_PREVIOUS'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    activeHmacKey: hmac.active,
    previousHmacKeys: hmac.previous,
  });
}

function readHmacKeys(env: PiiEnv): { active: HmacKeyMaterial; previous: HmacKeyMaterial[] } {
  const active = {
    version: parseVersion(env['PII_HMAC_KEY_VERSION'] ?? '1', 'PII_HMAC_KEY_VERSION'),
    key: decodeKey(env['PII_HMAC_KEY_BASE64'], 'PII_HMAC_KEY_BASE64'),
  };
  const previous = parsePairs(env['PII_HMAC_KEYS_PREVIOUS'], 'PII_HMAC_KEYS_PREVIOUS').map(
    ([version, b64]) => ({
      version: parseVersion(version, 'PII_HMAC_KEYS_PREVIOUS'),
      key: decodeKey(b64, 'PII_HMAC_KEYS_PREVIOUS'),
    }),
  );
  return { active, previous };
}

/** Decodifica base64 estrito. A mensagem de erro cita só o nome da variável. */
function decodeKey(value: string | undefined, name: string): Buffer {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new PiiCryptoError('INVALID_CONFIG', `${name} ausente (gere com: npm run keys:dev).`);
  }
  if (!BASE64.test(trimmed) || trimmed.length % 4 !== 0) {
    throw new PiiCryptoError('INVALID_CONFIG', `${name} não é base64 válido.`);
  }
  return Buffer.from(trimmed, 'base64');
}

function parseVersion(value: string, name: string): number {
  const version = Number(value.trim());
  if (!Number.isInteger(version) || version < 1 || version > 32_767) {
    throw new PiiCryptoError('INVALID_CONFIG', `${name}: versão deve ser inteiro 1..32767.`);
  }
  return version;
}

/** `a:b,c:d` → [[a,b],[c,d]] (separa no primeiro `:`; o base64 não contém `:`). */
function parsePairs(value: string | undefined, name: string): Array<[string, string]> {
  if (!value?.trim()) return [];
  return value.split(',').map((item) => {
    const i = item.indexOf(':');
    const left = item.slice(0, i).trim();
    const right = item.slice(i + 1).trim();
    if (i <= 0 || right.length === 0) {
      throw new PiiCryptoError(
        'INVALID_CONFIG',
        `${name} deve ter o formato id:base64[,id:base64].`,
      );
    }
    return [left, right];
  });
}
