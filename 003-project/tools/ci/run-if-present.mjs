#!/usr/bin/env node
// Executa `npm run <script>` se o script existir no package.json da raiz do monorepo.
// Se não existir, registra um aviso (annotation do GitHub Actions) e sai com 0.
// Usado no CI (BV-103) para gates cujo ferramental entra em tarefas seguintes
// (ex.: `lint:boundaries` no BV-101, `test:int` depois do BV-102/BV-107).
//
// Uso: node tools/ci/run-if-present.mjs <script> <ticket> [-- args extras]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [script, ticket = 'tarefa futura', ...rest] = process.argv.slice(2);
if (!script) {
  console.error('uso: node tools/ci/run-if-present.mjs <script> <ticket> [-- args]');
  process.exit(2);
}

const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

if (!pkg.scripts?.[script]) {
  const msg = `Script "${script}" ainda não existe — gate pendente (${ticket}).`;
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=Gate pendente::${msg}` : msg);
  process.exit(0);
}

const extra = rest[0] === '--' ? rest.slice(1) : rest;
const args = ['run', script, ...(extra.length ? ['--', ...extra] : [])];
const result = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
