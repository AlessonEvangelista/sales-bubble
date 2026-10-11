import { configDefaults, defineConfig } from 'vitest/config';

// Testes unitários do pacote. Os de integração (`*.int.test.ts`) precisam de Postgres/Redis
// e rodam só com `npm run test:int` (vitest.int.config.ts).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
  },
});
