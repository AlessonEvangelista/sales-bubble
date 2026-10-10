import { defineConfig } from 'vitest/config';

// Testes de integração do pacote (BV-107): exigem `DATABASE_URL` apontando para um Postgres 16
// com `npm run db:deploy` já aplicado (CI: job "Integração e contrato"; local: `npm run db:up`).
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
