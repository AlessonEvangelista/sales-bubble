import { defineConfig } from 'vitest/config';

// Testes de integração (`npm run test:int`): usam REDIS_URL (docker compose local ou service do CI).
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    testTimeout: 15_000,
  },
});
