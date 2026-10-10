import { defineConfig } from 'vitest/config';

// Testes unitários do pacote. Os de integração (`*.int.test.ts`) precisam de Postgres com as
// migrations aplicadas e rodam só com `npm run test:int` (vitest.int.config.ts).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts', '**/node_modules/**'],
  },
});
