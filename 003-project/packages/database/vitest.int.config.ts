import { defineConfig } from 'vitest/config';

// Testes de integração do pacote (BV-107/BV-113): exigem Postgres 16 e Redis 7
// (CI: job "Integração e contrato"; local: `npm run db:up`).
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
