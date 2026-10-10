// npm run hooks:install   |   npm run hooks:uninstall
//
// Ativa (opcionalmente) os hooks locais versionados em 003-project/tools/git-hooks/ apontando o
// `core.hooksPath` do clone para esta pasta (BV-110). Nada é instalado automaticamente no
// `npm ci`: o hook é opt-in e não exige ferramenta nova além do próprio gitleaks.
// Quando o Husky for adotado (guia de desenvolvimento §1), o `.husky/pre-commit` deve chamar
// `003-project/tools/git-hooks/pre-commit` e este instalador deixa de ser usado.
import { execFileSync } from 'node:child_process';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hooksDir = dirname(fileURLToPath(import.meta.url));

if (process.argv.includes('--uninstall')) {
  try {
    git('config', '--unset', 'core.hooksPath');
  } catch {
    // já não estava configurado
  }
  console.log('[hooks] core.hooksPath removido; o git volta a usar .git/hooks.');
} else {
  const top = git('rev-parse', '--show-toplevel');
  // Caminho relativo à raiz do clone (o git resolve core.hooksPath relativo a ela).
  const path = relative(top, hooksDir).split('\\').join('/');
  git('config', 'core.hooksPath', path);
  console.log(`[hooks] core.hooksPath = ${path}`);
  console.log(
    '[hooks] pre-commit: gitleaks nos arquivos staged (pulado com aviso se não instalado).',
  );
}
