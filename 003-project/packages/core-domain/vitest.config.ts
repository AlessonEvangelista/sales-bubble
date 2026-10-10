import { defineConfig } from 'vitest/config';

// Piso de cobertura do core-domain (pipeline-ci-cd.md §2: 90% linhas / 85% ramos).
// Metas por subdomínio (ex.: bubble ≥ 95/90) entram quando os módulos existirem
// (estrategia-testes.md §6). Aplicado só com `--coverage` (CI: `npm run test:coverage`).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
});
