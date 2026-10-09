// npm run keys:dev [-- --force]
// Gera chaves SOMENTE de desenvolvimento em 003-project/.secrets/ (pasta no .gitignore):
//   - jwt-access.pem / jwt-access.pub — par RSA 2048 para o access token RS256 (api-rest.md);
//   - pii-keys.env — PII_DATA_KEY_BASE64 e PII_HMAC_KEY_BASE64 (32 bytes cada, ADR-0012),
//     para copiar para o .env. Em staging/produção as chaves vêm do KMS/secret manager.
// Não sobrescreve arquivos existentes, a menos que receba --force.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.secrets');
const force = process.argv.includes('--force');

mkdirSync(dir, { recursive: true });

function write(name, content) {
  const path = join(dir, name);
  if (existsSync(path) && !force) {
    console.log(`[keys:dev] mantido (já existe): .secrets/${name}`);
    return;
  }
  writeFileSync(path, content, { mode: 0o600 });
  console.log(`[keys:dev] gerado: .secrets/${name}`);
}

if (force || !existsSync(join(dir, 'jwt-access.pem')) || !existsSync(join(dir, 'jwt-access.pub'))) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  writeFileSync(join(dir, 'jwt-access.pem'), privateKey, { mode: 0o600 });
  writeFileSync(join(dir, 'jwt-access.pub'), publicKey, { mode: 0o600 });
  console.log('[keys:dev] gerado: .secrets/jwt-access.pem e .secrets/jwt-access.pub');
} else {
  console.log('[keys:dev] mantido (já existe): .secrets/jwt-access.pem/.pub');
}

write(
  'pii-keys.env',
  [
    '# Copie estas linhas para o 003-project/.env (somente desenvolvimento).',
    `PII_DATA_KEY_BASE64=${randomBytes(32).toString('base64')}`,
    `PII_HMAC_KEY_BASE64=${randomBytes(32).toString('base64')}`,
    '',
  ].join('\n'),
);
