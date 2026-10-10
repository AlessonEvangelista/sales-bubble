// npm run keys:dev [-- --force]
// Gera chaves SOMENTE de desenvolvimento em 003-project/.secrets/ (pasta no .gitignore):
//   - jwt-access.pem / jwt-access.pub — par RSA 2048 para o access token RS256 (api-rest.md);
//   - pii-keys.env — PII_DATA_KEY_BASE64 e PII_HMAC_KEY_BASE64 (32 bytes cada, ADR-0012),
//     para copiar para o .env. Em staging/produção as chaves vêm do KMS/secret manager.
// Não sobrescreve arquivos existentes, a menos que receba --force.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.secrets');
const force = process.argv.includes('--force');

mkdirSync(dir, { recursive: true });

// Criação exclusiva ('wx') em vez de checar-e-escrever: sem janela de corrida (TOCTOU).
// Retorna false quando o arquivo já existe e --force não foi passado.
function writeSecret(name, content) {
  try {
    writeFileSync(join(dir, name), content, { mode: 0o600, flag: force ? 'w' : 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

function report(name, created) {
  console.log(`[keys:dev] ${created ? 'gerado' : 'mantido (já existe)'}: .secrets/${name}`);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const pemCreated = writeSecret('jwt-access.pem', privateKey);
// A pública só é gravada junto com a privada recém-criada, para o par nunca ficar inconsistente.
if (pemCreated) writeFileSync(join(dir, 'jwt-access.pub'), publicKey, { mode: 0o600 });
report('jwt-access.pem/.pub', pemCreated);

report(
  'pii-keys.env',
  writeSecret(
    'pii-keys.env',
    [
      '# Copie estas linhas para o 003-project/.env (somente desenvolvimento).',
      `PII_DATA_KEY_BASE64=${randomBytes(32).toString('base64')}`,
      `PII_HMAC_KEY_BASE64=${randomBytes(32).toString('base64')}`,
      '',
    ].join('\n'),
  ),
);
