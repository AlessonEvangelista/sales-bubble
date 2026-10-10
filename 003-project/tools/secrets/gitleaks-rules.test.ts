/**
 * Testes da gestão de segredos (BV-110 / SEC-10):
 *
 * 1. Regras do projeto em `.gitleaks.toml` (raiz do repositório): cada regra detecta o seu
 *    segredo e NÃO dispara nos casos legítimos (campos vazios do `.env.example`, caminhos de
 *    chave, referências `${VAR}`, placeholders). Os segredos falsos são gerados em tempo de
 *    execução — nenhum valor que pareça segredo fica versionado (nem neste arquivo).
 *    Precisa do binário do gitleaks (PATH ou `GITLEAKS_BIN`); fora do CI, sem o binário, o
 *    bloco é pulado com aviso. No CI o binário é obrigatório.
 * 2. As cópias de `src/config/secrets.ts` na api e no worker são idênticas.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');
const repoRoot = resolve(projectRoot, '..');
const configPath = join(repoRoot, '.gitleaks.toml');
const gitleaksBin = process.env.GITLEAKS_BIN ?? 'gitleaks';

const hasGitleaks = spawnSync(gitleaksBin, ['version'], { encoding: 'utf8' }).status === 0;
if (!hasGitleaks && process.env.CI) {
  throw new Error('gitleaks não encontrado no CI (instale ou defina GITLEAKS_BIN).');
}
if (!hasGitleaks) {
  console.warn(
    '[test:secrets] gitleaks não instalado: testes das regras pulados (ver gestao-segredos.md).',
  );
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomAlnum(length: number): string {
  return [...randomBytes(length)].map((byte) => ALNUM[byte % ALNUM.length]).join('');
}

/** Monta a chave em partes para que este arquivo não contenha o padrão literal. */
const pagarmeKey = (kind: 'sk' | 'ak', mode: 'live' | 'test') =>
  [kind, mode, randomAlnum(32)].join('_');

interface Finding {
  RuleID: string;
  File: string;
}

/**
 * Casos: nome do arquivo → conteúdo + regra esperada (null = não pode haver achado).
 * Todos são varridos numa única execução do gitleaks (cada execução custa segundos no Windows).
 */
interface Case {
  file: string;
  content: string;
  expected: string | null;
}

const piiKey = randomBytes(32).toString('base64');
const cases: Case[] = [
  {
    file: 'pagarme-sk.ts',
    content: `const key = '${pagarmeKey('sk', 'live')}';`,
    expected: 'pagarme-api-key',
  },
  {
    file: 'pagarme-ak.yaml',
    content: `pagarme:\n  key: ${pagarmeKey('ak', 'test')}`,
    expected: 'pagarme-api-key',
  },
  { file: 'pii.env', content: `PII_HMAC_KEY_BASE64=${piiKey}`, expected: 'bolha-pii-key' },
  {
    file: 'pii.json',
    content: `{ "PII_DATA_KEY_BASE64": "${piiKey}" }`,
    expected: 'bolha-pii-key',
  },
  ...['PAGARME_WEBHOOK_SECRET', 'CAPTCHA_SECRET', 'SMTP_PASSWORD', 'X_API_KEY'].map((name) => ({
    file: `${name.toLowerCase()}.env`,
    content: `${name}=${randomAlnum(24)}`,
    expected: 'bolha-env-secret-assignment',
  })),
  {
    file: 'export.envrc',
    content: `export OAUTH_GOOGLE_CLIENT_SECRET="${randomAlnum(24)}"`,
    expected: 'bolha-env-secret-assignment',
  },
  {
    file: 'legit.env',
    content: [
      // Campo vazio seguido de outra variável: não pode "emprestar" o valor da linha seguinte.
      'PAGARME_SECRET_KEY=',
      'OAUTH_GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/google/callback',
      'PAGARME_WEBHOOK_SECRET=                # comentário explicando o campo',
      'JWT_ACCESS_PRIVATE_KEY_PATH=./.secrets/jwt-access.pem',
      'REFRESH_TOKEN_TTL_DAYS=30',
      'CAPTCHA_SECRET=${CAPTCHA_SECRET_FROM_PLATFORM}',
      'SMTP_PASSWORD=$SMTP_PASSWORD_FROM_PLATFORM',
      'PAGARME_WEBHOOK_SECRET=changeme',
      'PAGARME_WEBHOOK_SECRET=<segredo-do-ambiente>',
    ].join('\n'),
    expected: null,
  },
  {
    file: 'env.example',
    content: readFileSync(join(projectRoot, '.env.example'), 'utf8'),
    expected: null,
  },
];

const workDir = mkdtempSync(join(tmpdir(), 'bv-gitleaks-'));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

/** Regras disparadas por arquivo, após uma varredura com a configuração real. */
const rulesByFile = new Map<string, Set<string>>();

beforeAll(() => {
  if (!hasGitleaks) return;
  const dir = join(workDir, 'cases');
  mkdirSync(dir);
  for (const testCase of cases) writeFileSync(join(dir, testCase.file), `${testCase.content}\n`);
  const report = join(workDir, 'report.json');
  execFileSync(
    gitleaksBin,
    [
      'dir',
      dir,
      '--config',
      configPath,
      '--no-banner',
      '--log-level',
      'error',
      '--report-format',
      'json',
      '--report-path',
      report,
      '--exit-code',
      '0',
    ],
    { encoding: 'utf8' },
  );
  for (const finding of JSON.parse(readFileSync(report, 'utf8')) as Finding[]) {
    const file = basename(finding.File);
    rulesByFile.set(file, (rulesByFile.get(file) ?? new Set()).add(finding.RuleID));
  }
}, 120_000);

describe.skipIf(!hasGitleaks)('regras do .gitleaks.toml', () => {
  it.each(cases.filter((c) => c.expected !== null))('$file → $expected', ({ file, expected }) => {
    expect([...(rulesByFile.get(file) ?? [])]).toContain(expected);
  });

  it.each(cases.filter((c) => c.expected === null))('$file → sem achados', ({ file }) => {
    expect([...(rulesByFile.get(file) ?? [])]).toEqual([]);
  });
});

describe('loader de segredos', () => {
  it('as cópias de secrets.ts na api e no worker são idênticas', () => {
    const read = (app: string) =>
      readFileSync(join(projectRoot, 'apps', app, 'src', 'config', 'secrets.ts'), 'utf8');
    expect(read('worker')).toBe(read('api'));
  });
});
