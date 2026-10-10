#!/usr/bin/env node
// Gate de licenças (pipeline-ci-cd.md §2): reprova dependência de RUNTIME (prod) com licença
// fora da allowlist — em especial GPL/AGPL. Dependências de desenvolvimento não entram.
// Sem dependências externas: usa `npm query .prod` sobre a árvore instalada (rodar após `npm ci`).
//
// Uso: node tools/ci/check-licenses.mjs
import { execFileSync } from 'node:child_process';

// Licenças permissivas aceitas (SPDX). Expressões "A OR B" passam se alguma opção estiver aqui;
// "A AND B" exigem todas.
const ALLOWLIST = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  // Copyleft fraco: aceito em uso por link dinâmico (ex.: libvips do sharp, usado pelo Next.js).
  // GPL/AGPL (copyleft forte) continuam bloqueadas.
  'LGPL-2.1',
  'LGPL-3.0',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'WTFPL',
]);

// Exceções pontuais: "nome@versão" → justificativa (registrar também em .security/exceptions.yaml).
const EXCEPTIONS = new Map([
  [
    'sentry@0.45.0',
    'LIC-0001: Sentry CLI (FSL-1.1-Apache-2.0), transitiva de @sentry/node; não roda em runtime.',
  ],
]);

const raw = execFileSync('npm', ['query', '.prod'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  shell: process.platform === 'win32',
});
const nodes = JSON.parse(raw);

/** Normaliza o campo license (string SPDX, objeto legado ou array legado). */
function licenseOf(node) {
  const lic = node.license ?? node.licenses;
  if (!lic) return undefined;
  if (typeof lic === 'string') return lic;
  if (Array.isArray(lic)) return lic.map((l) => (typeof l === 'string' ? l : l.type)).join(' OR ');
  return lic.type;
}

/** Avalia uma expressão SPDX simples (OR/AND, parênteses opcionais, sufixo "+"). */
function isAllowed(expr) {
  const clean = expr.replace(/[()]/g, ' ').trim();
  return clean.split(/\s+OR\s+/i).some((alt) =>
    alt.split(/\s+AND\s+/i).every((id) =>
      ALLOWLIST.has(
        id
          .trim()
          .replace(/\+$/, '')
          .replace(/-or-later$/, ''),
      ),
    ),
  );
}

const violations = [];
const seen = new Set();
for (const node of nodes) {
  // Pacotes do próprio monorepo (@bolha/*) não são dependências de terceiros.
  if (node.name?.startsWith('@bolha/') || node.private) continue;
  const id = `${node.name}@${node.version}`;
  if (seen.has(id)) continue;
  seen.add(id);
  const lic = licenseOf(node);
  if (EXCEPTIONS.has(id)) continue;
  if (!lic || !isAllowed(lic)) violations.push(`${id}: ${lic ?? '(sem licença declarada)'}`);
}

console.log(`Licenças verificadas: ${seen.size} dependências de runtime.`);
if (violations.length) {
  console.error('Licenças fora da allowlist em dependências de runtime:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('OK — nenhuma licença fora da allowlist.');
