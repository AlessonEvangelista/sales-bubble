import { defineConfig } from 'vitest/config';

// Argon2id com os parâmetros de produção (64 MiB, t=3 — SEC-06) leva segundos em máquina
// lenta ou sob carga; os testes de auth fazem vários hashes por caso.
export default defineConfig({
  test: {
    testTimeout: 30_000,
  },
});
