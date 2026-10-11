import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSeedOptions, runSeed } from './seed.js';

/**
 * Ponto de entrada de `npm run db:seed` (executado em packages/database).
 * Lê o 003-project/.env quando existir; variáveis do processo têm precedência.
 */
async function main(): Promise<void> {
  const envFile = resolve(process.cwd(), '../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL não definida. Copie 003-project/.env.example para 003-project/.env.',
    );
  }

  const result = await runSeed(databaseUrl, parseSeedOptions(process.argv.slice(2)));
  console.log(
    `[db:seed] Postgres conectado; ${result.tables} tabela(s) no schema public. ` +
      `Plano: ${result.plan.accounts} contas e ${result.plan.bubbles} bolhas.`,
  );
  if (!result.seeded) {
    console.log(
      result.tables === 0
        ? '[db:seed] Schema ainda não existe: rode `npm run db:deploy`. Nenhum dado gravado.'
        : '[db:seed] Gravação dos dados aguarda o módulo de cripto de PII (BV-109). Nenhum dado gravado.',
    );
  }
}

main().catch((error: unknown) => {
  console.error('[db:seed] falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
