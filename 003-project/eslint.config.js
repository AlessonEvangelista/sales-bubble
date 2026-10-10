// Configuração ESLint compartilhada (flat config) de todo o monorepo.
// As regras de fronteira entre pacotes (eslint-plugin-boundaries / dependency-cruiser)
// entram no BV-101; aqui fica só a base de lint usada por `turbo run lint`.
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
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
);
