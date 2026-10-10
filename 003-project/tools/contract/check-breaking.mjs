#!/usr/bin/env node
// Gate de contrato (BV-111 / EN-031; estrategia-testes.md §3.3, pipeline-ci-cd.md §2):
// detecta breaking change do OpenAPI da branch contra a versão de `main` com o oasdiff.
//
// - Base: `git show <ref>:003-project/packages/contracts/openapi.yaml` (ref padrão
//   `origin/main`; sobrescreva com CONTRACT_BASE_REF). Se a ref não existir localmente
//   (checkout raso do CI), faz `git fetch --depth=1 origin main`.
// - Base sem openapi.yaml (primeira versão do contrato) → nada a comparar, passa.
// - oasdiff: usa o binário `oasdiff` do PATH; senão, a imagem Docker fixada abaixo.
//   Sem nenhum dos dois, falha (no CI o runner ubuntu tem Docker).
// - Quebra intencional = nova versão maior (`/api/v2`, api-rest §1.1). Para um PR que
//   assume a quebra com aprovação, use OASDIFF_ALLOW_BREAKING=1 (documente no PR).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OASDIFF_IMAGE = 'tufin/oasdiff:v1.33.0';
const SPEC_PATH_IN_REPO = '003-project/packages/contracts/openapi.yaml';
const root = fileURLToPath(new URL('../..', import.meta.url));
const specFile = join(root, 'packages', 'contracts', 'openapi.yaml');
const baseRef = process.env.CONTRACT_BASE_REF ?? 'origin/main';

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });

function readBaseSpec() {
  let show = run('git', ['show', `${baseRef}:${SPEC_PATH_IN_REPO}`]);
  if (show.status !== 0 && /unknown revision|bad revision|invalid object name/i.test(show.stderr)) {
    const [remote, ...branch] = baseRef.split('/');
    run('git', ['fetch', '--no-tags', '--depth=1', remote, branch.join('/')], { stdio: 'inherit' });
    show = run('git', ['show', `${baseRef}:${SPEC_PATH_IN_REPO}`]);
  }
  if (show.status !== 0) {
    if (/does not exist|exists on disk, but not in/i.test(show.stderr)) return null;
    console.error(`Não foi possível ler a base ${baseRef}: ${show.stderr.trim()}`);
    process.exit(2);
  }
  return show.stdout;
}

const base = readBaseSpec();
if (base === null) {
  console.log(
    `${baseRef} ainda não tem openapi.yaml — primeira versão do contrato, nada a comparar.`,
  );
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'oasdiff-'));
writeFileSync(join(work, 'base.yaml'), base);
copyFileSync(specFile, join(work, 'revision.yaml'));

const args = ['breaking', 'base.yaml', 'revision.yaml', '--fail-on', 'ERR', '--format', 'text'];
let result;
if (run('oasdiff', ['--version']).status === 0) {
  result = spawnSync('oasdiff', args, { cwd: work, stdio: 'inherit' });
} else if (run('docker', ['version', '--format', '{{.Server.Version}}']).status === 0) {
  result = spawnSync(
    'docker',
    ['run', '--rm', '-v', `${work}:/specs`, '-w', '/specs', OASDIFF_IMAGE, ...args],
    { stdio: 'inherit' },
  );
} else {
  console.error('oasdiff não encontrado (nem binário no PATH nem Docker).');
  rmSync(work, { recursive: true, force: true });
  process.exit(2);
}
rmSync(work, { recursive: true, force: true });

if (result.status === 0) {
  console.log(`Sem breaking changes no contrato em relação a ${baseRef}.`);
  process.exit(0);
}
if (process.env.OASDIFF_ALLOW_BREAKING === '1') {
  console.warn('Breaking change detectada, mas liberada por OASDIFF_ALLOW_BREAKING=1.');
  process.exit(0);
}
console.error(
  `Breaking change no contrato em relação a ${baseRef}. Mudanças incompatíveis exigem /api/v2 (api-rest §1.1).`,
);
process.exit(result.status ?? 1);
