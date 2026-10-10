import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

/**
 * Configuração do Prisma CLI (Prisma 7) — BV-107.
 *
 * - Migrations usam `DATABASE_DIRECT_URL` (sem pooler — pipeline-ci-cd.md §5) e caem para
 *   `DATABASE_URL` quando ela não existe (dev/CI usam o mesmo Postgres).
 * - Lê o `003-project/.env` quando existir; variáveis do processo têm precedência.
 * - `prisma generate` e `prisma validate` não precisam de banco: sem URL, o datasource fica vazio.
 */
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env['DATABASE_DIRECT_URL'] || process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url ? { datasource: { url } } : {}),
});
