import pg from 'pg';

/**
 * Sonda de conectividade com o PostgreSQL, usada pelo readiness da API (`/health/ready`)
 * e pelo seed. Usa o driver `pg` diretamente porque o schema Prisma só chega no BV-107;
 * o Prisma 7 usa o mesmo driver via `@prisma/adapter-pg`, então a dependência permanece.
 */
export interface PostgresProbe {
  /** Executa `SELECT 1`; rejeita se o banco não responder. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createPostgresProbe(connectionString: string, timeoutMs = 2_000): PostgresProbe {
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
    idleTimeoutMillis: 30_000,
  });
  // Erros de conexões ociosas não podem derrubar o processo; o próximo ping os reporta.
  pool.on('error', () => undefined);

  return {
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
  };
}
