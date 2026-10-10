// Configuração ESLint compartilhada (flat config) de todo o monorepo.
// As fronteiras entre pacotes (imports) são verificadas pelo dependency-cruiser
// (`.dependency-cruiser.cjs`, `npm run lint:boundaries` — BV-101). Aqui ficam a base de lint
// e as proibições do core-domain que não são imports (globais de infraestrutura e relógio).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'prototipacao-gemini/**',
      'packages/database/src/shared/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // core-domain puro (guia §2.1 e §5.4): sem `process.env`, sem `fetch`, sem relógio do sistema
    // (usar a porta `Clock`). Os caminhos são relativos a este arquivo (raiz do monorepo).
    files: ['packages/core-domain/src/**/*.ts'],
    ignores: ['packages/core-domain/src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'core-domain não lê process/env: receba configuração por parâmetro.',
        },
        {
          name: 'fetch',
          message: 'core-domain não faz I/O: defina uma porta e implemente o adapter fora.',
        },
        {
          name: 'setTimeout',
          message: 'core-domain não agenda timers: use jobs (ADR-0011) via porta.',
        },
        {
          name: 'setInterval',
          message: 'core-domain não agenda timers: use jobs (ADR-0011) via porta.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'core-domain não lê o relógio do sistema: use a porta Clock.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'core-domain não lê o relógio do sistema: use a porta Clock.',
        },
      ],
    },
  },
  prettier,
);
