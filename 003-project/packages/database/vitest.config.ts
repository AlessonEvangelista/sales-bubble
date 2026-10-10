import { configDefaults, defineConfig } from 'vitest/config';

// Testes unitários (`npm run test`). Os de integração (`*.int.test.ts`, precisam de Redis/Postgres
// do docker compose ou dos services do CI) rodam só em `npm run test:int` (vitest.int.config.ts).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
  },
});
