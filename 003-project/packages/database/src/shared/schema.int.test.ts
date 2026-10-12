import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type PrismaClient } from './prisma-client.js';
import { isCheckViolation, isUniqueViolation } from './sql-errors.js';

/**
 * Integração do schema inicial (BV-107 / EN-027) contra Postgres 16 com as migrations aplicadas
 * (`npm run db:deploy`). Cobre o que o Prisma não modela e o banco precisa garantir:
 * índice único parcial da cota PF (ADR-0002), CHECK de capacidade, UPDATE condicional sob
 * concorrência e o trigger do outbox (pg_notify só no COMMIT — ADR-0010).
 */
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL não definida: suba o Postgres (npm run db:up) e rode npm run db:deploy.',
  );
}

let prisma: PrismaClient;
let pool: pg.Pool;

beforeAll(() => {
  prisma = createPrismaClient(databaseUrl, { maxConnections: 10 });
  pool = new pg.Pool({ connectionString: databaseUrl, max: 25 });
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

/** Envelope cifrado fictício (0x01 + 12 B nonce + ciphertext + 16 B tag). */
const enc = (): Uint8Array<ArrayBuffer> => {
  const blob = new Uint8Array(randomBytes(48));
  blob[0] = 0x01;
  return blob;
};
const hmac = (): Uint8Array<ArrayBuffer> => new Uint8Array(randomBytes(32));

async function createAccount(accountType: 'PF' | 'PJ' = 'PF'): Promise<string> {
  const id = randomUUID();
  await prisma.account.create({
    data: {
      id,
      accountType,
      pseudonym: `user-${id.slice(0, 8)}`,
      emailEnc: enc(),
      emailHash: hmac(),
      documentEnc: enc(),
      documentHash: hmac(),
      nameEnc: enc(),
      piiDataKey: enc(),
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fake',
      status: 'ACTIVE',
    },
  });
  return id;
}

async function createActiveSaleBubble(creatorId: string, maxQuotas: number): Promise<string> {
  const id = randomUUID();
  const startsAt = new Date('2026-10-10T12:00:00Z');
  await prisma.bubble.create({
    data: {
      id,
      type: 'SALE',
      creatorId,
      title: 'Lote de fones de ouvido',
      description: 'Fones bluetooth novos, lacrados.',
      category: 'eletronicos',
      status: 'ACTIVE',
      initialPrice: 10_000n,
      targetPrice: 8_000n,
      minQuotas: 2,
      maxQuotas,
      durationMinutes: 120,
      startsAt,
      expiresAt: new Date(startsAt.getTime() + 120 * 60_000),
      canvasX: 10,
      canvasY: 20,
      onCanvas: true,
      priceTiers: {
        create: [
          { id: randomUUID(), minFilledQuotas: 0, unitPrice: 10_000n },
          { id: randomUUID(), minFilledQuotas: 2, unitPrice: 8_000n },
        ],
      },
    },
  });
  return id;
}

function quotaData(bubbleId: string, accountId: string, accountType: 'PF' | 'PJ', quantity = 1) {
  return {
    id: randomUUID(),
    bubbleId,
    accountId,
    accountType,
    quantity,
    status: 'ACTIVE',
    paymentId: randomUUID(),
    acquiredAt: new Date(),
  };
}

describe('migrations (BV-107)', () => {
  it('cria as tabelas de identity, bubble e platform e registra as 3 migrations', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'accounts',
        'company_profiles',
        'consents',
        'refresh_tokens',
        'bubbles',
        'price_tiers',
        'quotas',
        'outbox_events',
        'processed_events',
        'idempotency_keys',
      ]),
    );
    const applied = await pool.query<{ migration_name: string }>(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY 1`,
    );
    expect(applied.rows.map((r) => r.migration_name)).toEqual([
      '20261009000100_identity',
      '20261009000200_bubble',
      '20261009000300_platform_outbox',
    ]);
  });

  it('cria o índice único parcial da cota PF (ADR-0002)', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'quotas_pf_one_per_bubble_uk'`,
    );
    expect(rows[0]?.indexdef).toMatch(/UNIQUE INDEX .* \(bubble_id, account_id\) WHERE/);
    expect(rows[0]?.indexdef).toMatch(/'PF'/);
  });
});

describe('Prisma Client (driver adapter pg)', () => {
  it('grava e lê conta, bolha com degraus e cota; dinheiro em BigInt', async () => {
    const creatorId = await createAccount('PF');
    const bubbleId = await createActiveSaleBubble(creatorId, 10);
    const buyerId = await createAccount('PF');
    await prisma.quota.create({ data: quotaData(bubbleId, buyerId, 'PF') });

    const bubble = await prisma.bubble.findUniqueOrThrow({
      where: { id: bubbleId },
      include: { priceTiers: { orderBy: { minFilledQuotas: 'asc' } }, quotas: true },
    });
    expect(bubble.initialPrice).toBe(10_000n);
    expect(bubble.priceTiers.map((t) => t.unitPrice)).toEqual([10_000n, 8_000n]);
    expect(bubble.quotas).toHaveLength(1);
    expect(bubble.imageUrls).toEqual([]);
  });
});

describe('cotas (ADR-0002)', () => {
  it('PF: segunda cota viva na mesma bolha viola quotas_pf_one_per_bubble_uk', async () => {
    const bubbleId = await createActiveSaleBubble(await createAccount(), 10);
    const pf = await createAccount('PF');
    await prisma.quota.create({ data: quotaData(bubbleId, pf, 'PF') });

    const second = prisma.quota.create({
      data: {
        ...quotaData(bubbleId, pf, 'PF'),
        status: 'RESERVED',
        acquiredAt: null,
        reservedUntil: new Date(),
      },
    });
    const error = await second.catch((e: unknown) => e);
    expect(isUniqueViolation(error, 'quotas_pf_one_per_bubble_uk')).toBe(true);
  });

  it('PF: cota liberada não bloqueia nova cota; PJ pode ter várias', async () => {
    const bubbleId = await createActiveSaleBubble(await createAccount(), 10);
    const pf = await createAccount('PF');
    await prisma.quota.create({
      data: { ...quotaData(bubbleId, pf, 'PF'), status: 'RELEASED', releasedAt: new Date() },
    });
    await prisma.quota.create({ data: quotaData(bubbleId, pf, 'PF') });

    const pj = await createAccount('PJ');
    await prisma.quota.create({ data: quotaData(bubbleId, pj, 'PJ', 2) });
    await prisma.quota.create({ data: quotaData(bubbleId, pj, 'PJ', 1) });
    expect(await prisma.quota.count({ where: { bubbleId } })).toBe(4);
  });

  it('PII: ciphertext sem o byte de versão 0x01 viola accounts_pii_enc_ck', async () => {
    const id = randomUUID();
    const error = await prisma.account
      .create({
        data: {
          id,
          accountType: 'PF',
          pseudonym: `user-${id.slice(0, 8)}`,
          emailEnc: new Uint8Array(32),
          emailHash: hmac(),
          documentEnc: enc(),
          documentHash: hmac(),
          nameEnc: enc(),
          piiDataKey: enc(),
          passwordHash: 'x',
        },
      })
      .catch((e: unknown) => e);
    expect(isCheckViolation(error, 'accounts_pii_enc_ck')).toBe(true);
  });

  it('PF com quantity > 1 viola quotas_pf_single_ck', async () => {
    const bubbleId = await createActiveSaleBubble(await createAccount(), 10);
    const error = await prisma.quota
      .create({ data: quotaData(bubbleId, await createAccount('PF'), 'PF', 2) })
      .catch((e: unknown) => e);
    expect(isCheckViolation(error, 'quotas_pf_single_ck')).toBe(true);
  });

  it('CHECK impede overbooking mesmo sem a guarda do UPDATE condicional', async () => {
    const bubbleId = await createActiveSaleBubble(await createAccount(), 3);
    const error = await pool
      .query(`UPDATE bubbles SET filled_quotas = 2, reserved_quotas = 2 WHERE id = $1`, [bubbleId])
      .catch((e: unknown) => e);
    expect(isCheckViolation(error, 'bubbles_reserved_ck')).toBe(true);
  });

  it('última cota: 50 incrementos concorrentes, só 1 vence o UPDATE condicional', async () => {
    const bubbleId = await createActiveSaleBubble(await createAccount(), 5);
    await pool.query(`UPDATE bubbles SET filled_quotas = 4 WHERE id = $1`, [bubbleId]);

    const attempts = Array.from({ length: 50 }, () =>
      pool.query(
        `UPDATE bubbles
            SET filled_quotas = filled_quotas + 1, version = version + 1, updated_at = now()
          WHERE id = $1 AND status = 'ACTIVE'
            AND filled_quotas + reserved_quotas + 1 <= max_quotas`,
        [bubbleId],
      ),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r.rowCount === 1)).toHaveLength(1);

    const bubble = await prisma.bubble.findUniqueOrThrow({ where: { id: bubbleId } });
    expect(bubble.filledQuotas).toBe(5);
    expect(bubble.version).toBe(1);
  });
});

describe('bolhas: CHECKs de domínio', () => {
  it('rejeita duração fora de 1 h a 5 dias e compra acima de 4 dias', async () => {
    const creatorId = await createAccount();
    const base = {
      creatorId,
      title: 'Compra coletiva de café',
      description: 'Café especial em grãos.',
      category: 'alimentos',
      initialPrice: 5_000n,
      targetPrice: 5_000n,
      minQuotas: 2,
      maxQuotas: 10,
    };
    const tooShort = await prisma.bubble
      .create({ data: { ...base, id: randomUUID(), type: 'SALE', durationMinutes: 30 } })
      .catch((e: unknown) => e);
    expect(isCheckViolation(tooShort, 'bubbles_duration_ck')).toBe(true);

    const purchaseTooLong = await prisma.bubble
      .create({
        data: { ...base, id: randomUUID(), type: 'PURCHASE', durationMinutes: 5 * 24 * 60 },
      })
      .catch((e: unknown) => e);
    expect(isCheckViolation(purchaseTooLong, 'bubbles_purchase_duration_ck')).toBe(true);
  });
});

describe('outbox (ADR-0010)', () => {
  it('trigger notifica outbox_new só no COMMIT, nunca em rollback', async () => {
    const listener = new pg.Client({ connectionString: databaseUrl });
    await listener.connect();
    const received: string[] = [];
    listener.on('notification', (msg) => {
      if (msg.channel === 'outbox_new' && msg.payload) received.push(msg.payload);
    });
    await listener.query('LISTEN outbox_new');

    try {
      const aggregateId = randomUUID();
      const event = (id: string) => ({
        id,
        aggregateType: 'Bubble',
        aggregateId,
        eventType: 'BubblePublished',
        payload: { bubbleId: aggregateId },
      });

      const rolledBack = randomUUID();
      await prisma
        .$transaction(async (tx) => {
          await tx.outboxEvent.create({ data: event(rolledBack) });
          throw new Error('rollback proposital');
        })
        .catch(() => undefined);

      const committed = randomUUID();
      await prisma.$transaction(async (tx) => {
        await tx.outboxEvent.create({ data: event(committed) });
      });

      await waitFor(() => received.includes(committed));
      expect(received).not.toContain(rolledBack);
      expect(await prisma.outboxEvent.count({ where: { id: rolledBack } })).toBe(0);
    } finally {
      await listener.end();
    }
  });

  it('payload precisa ser objeto JSON', async () => {
    const error = await prisma.outboxEvent
      .create({
        data: {
          id: randomUUID(),
          aggregateType: 'Bubble',
          aggregateId: randomUUID(),
          eventType: 'BubblePublished',
          payload: [1, 2, 3],
        },
      })
      .catch((e: unknown) => e);
    expect(isCheckViolation(error, 'outbox_events_payload_ck')).toBe(true);
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timeout aguardando condição');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
