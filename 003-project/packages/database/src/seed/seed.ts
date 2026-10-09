import pg from 'pg';

/**
 * Seed de desenvolvimento (guia de desenvolvimento §3.4).
 *
 * BV-102 entrega a infraestrutura do comando (`npm run db:seed [-- --small]`): leitura do
 * `.env`, conexão com o Postgres do docker compose e o plano do que será semeado. A gravação
 * dos dados depende do schema Prisma e das migrations do BV-107 (EN-027); até lá o seed
 * apenas valida a conexão e informa que não há tabelas. Deve permanecer idempotente
 * (upsert por chave natural) quando os dados forem gravados.
 */

/** Contas do seed (só dev). A senha de dev é definida junto com o hash Argon2id (SEC-06). */
export const SEED_ACCOUNTS = [
  { email: 'carlos@seed.local', type: 'PF', note: 'Persona Carlos Silva, score 500' },
  {
    email: 'compras@tecnolotes.seed.local',
    type: 'PJ',
    note: 'Persona TecnoLotes Ltda, CNPJ fictício ATIVO',
  },
  { email: 'pj2@seed.local', type: 'PJ', note: 'Concorrente em lances' },
  { email: 'admin@seed.local', type: 'PF', note: 'Papel moderator' },
] as const;

/** ~500 bolhas para o benchmark do RNF01; `--small` cria só 20. */
export const SEED_BUBBLES_DEFAULT = 500;
export const SEED_BUBBLES_SMALL = 20;

export interface SeedOptions {
  small: boolean;
}

export interface SeedPlan {
  accounts: number;
  bubbles: number;
}

export function parseSeedOptions(argv: readonly string[]): SeedOptions {
  return { small: argv.includes('--small') };
}

export function buildSeedPlan(options: SeedOptions): SeedPlan {
  return {
    accounts: SEED_ACCOUNTS.length,
    bubbles: options.small ? SEED_BUBBLES_SMALL : SEED_BUBBLES_DEFAULT,
  };
}

export interface SeedResult {
  plan: SeedPlan;
  /** Tabelas encontradas no schema `public`. */
  tables: number;
  seeded: boolean;
}

export async function runSeed(databaseUrl: string, options: SeedOptions): Promise<SeedResult> {
  const plan = buildSeedPlan(options);
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const { rows } = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tables = Number(rows[0]?.count ?? 0);
    // TODO(BV-107): com o schema Prisma criado, fazer upsert de SEED_ACCOUNTS e das bolhas.
    return { plan, tables, seeded: false };
  } finally {
    await client.end();
  }
}
