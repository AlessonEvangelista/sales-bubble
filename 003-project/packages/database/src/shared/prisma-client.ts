import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client.js';

/**
 * Fábrica do PrismaClient (Prisma 7 + driver adapter `pg`) — BV-107.
 *
 * O client é gerado em `src/shared/generated/prisma` (`prisma generate`, fora do git) e só é
 * exposto por aqui: os adapters de cada contexto recebem o client (ou a transação) por
 * parâmetro, e as apps (api/worker) criam uma instância por processo.
 */
export interface CreatePrismaClientOptions {
  /** Tamanho máximo do pool (padrão do `pg`: 10). */
  maxConnections?: number;
  /** Timeout de conexão em ms (padrão 5 s). */
  connectionTimeoutMs?: number;
}

export function createPrismaClient(
  connectionString: string,
  options: CreatePrismaClientOptions = {},
): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    ...(options.maxConnections ? { max: options.maxConnections } : {}),
  });
  return new PrismaClient({ adapter });
}

export { PrismaClient };
export { Prisma } from './generated/prisma/client.js';

/** Client transacional recebido em `prisma.$transaction(async (tx) => ...)`. */
export type PrismaTransaction = Prisma.TransactionClient;

/** Aceita o client raiz ou uma transação (os adapters funcionam com os dois). */
export type PrismaExecutor = PrismaClient | PrismaTransaction;
