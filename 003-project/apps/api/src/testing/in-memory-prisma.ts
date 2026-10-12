import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@bolha/database';
import { createPiiCryptoFromEnv, type PiiCrypto } from '@bolha/database/pii';

/**
 * Dublês para testes da API sem Postgres: um subconjunto do Prisma em memória que respeita as
 * constraints únicas do schema (BV-107) e a atomicidade de `$transaction`, e a cifra de PII
 * real (BV-109) com chaves aleatórias. Só o que os casos de uso usam — não é um ORM.
 */
export interface AccountRow {
  id: string;
  accountType: string;
  pseudonym: string;
  emailEnc: Uint8Array;
  emailHash: Uint8Array;
  documentEnc: Uint8Array;
  documentHash: Uint8Array;
  nameEnc: Uint8Array;
  passwordHash: string | null;
  piiDataKey: Uint8Array;
  piiKeyVersion: number;
  status: string;
  role: string;
  score: number;
  scoreModelVersion: string;
}

export interface ConsentRow {
  id: string;
  accountId: string;
  purpose: string;
  documentVersion: string;
  grantedAt: Date;
  ipHash: Uint8Array | null;
  userAgent: string | null;
}

export interface InMemoryDb {
  accounts: AccountRow[];
  consents: ConsentRow[];
}

type Where = Partial<Record<string, unknown>> & { OR?: Where[] };

const ACCOUNT_UNIQUE: [keyof AccountRow, string][] = [
  ['pseudonym', 'accounts_pseudonym_uk'],
  ['emailHash', 'accounts_email_hash_uk'],
  ['documentHash', 'accounts_document_hash_uk'],
];

export function createInMemoryPrisma(db: InMemoryDb = { accounts: [], consents: [] }): {
  prisma: PrismaClient;
  db: InMemoryDb;
} {
  const client = {
    account: {
      findFirst: async ({ where }: { where: Where }) =>
        db.accounts.find((a) => matches(a, where)) ?? null,
      findUnique: async ({ where }: { where: Where }) =>
        db.accounts.find((a) => matches(a, where)) ?? null,
      create: async ({ data }: { data: Partial<AccountRow> }) => {
        const row: AccountRow = { score: 500, scoreModelVersion: 'v1', ...data } as AccountRow;
        for (const [column, constraint] of ACCOUNT_UNIQUE) {
          if (db.accounts.some((a) => equal(a[column], row[column])))
            throw uniqueViolation(constraint);
        }
        db.accounts.push(row);
        return row;
      },
    },
    consent: {
      createMany: async ({ data }: { data: Omit<ConsentRow, 'grantedAt'>[] }) => {
        db.consents.push(...data.map((c) => ({ grantedAt: new Date(), ...c })));
        return { count: data.length };
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone(db);
      try {
        return await fn(client);
      } catch (error) {
        Object.assign(db, snapshot);
        throw error;
      }
    },
    $disconnect: async () => undefined,
  };
  return { prisma: client as unknown as PrismaClient, db };
}

/** Cifra de PII real (provedor `local`) com KEK e pepper aleatórios. */
export function createTestPiiCrypto(): PiiCrypto {
  return createPiiCryptoFromEnv({
    PII_KMS_PROVIDER: 'local',
    PII_DATA_KEY_BASE64: randomBytes(32).toString('base64'),
    PII_HMAC_KEY_BASE64: randomBytes(32).toString('base64'),
  });
}

function matches(row: object, where: Where): boolean {
  const { OR, ...fields } = where;
  if (OR && !OR.some((w) => matches(row, w))) return false;
  return Object.entries(fields).every(([key, value]) =>
    equal((row as Record<string, unknown>)[key], value),
  );
}

function equal(a: unknown, b: unknown): boolean {
  if (a instanceof Uint8Array && b instanceof Uint8Array) return Buffer.compare(a, b) === 0;
  return a === b;
}

/** Mesmo formato que o driver adapter devolve (lido por `isUniqueViolation`). */
function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error(`Unique constraint failed: ${constraint}`), {
    code: 'P2002',
    meta: { constraint },
  });
}
