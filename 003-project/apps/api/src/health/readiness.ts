/**
 * Prontidão da API (guia de desenvolvimento §3.1; plano de release §pós-deploy):
 * `GET /api/v1/health/ready` → `{"status":"ok","db":"up","redis":"up"}`, ou 503 se algum
 * dependente estiver fora. A checagem de fila entra junto com o BullMQ.
 */
export type DependencyStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ok' | 'error';
  db: DependencyStatus;
  redis: DependencyStatus;
}

/** Cada sonda resolve se o dependente responde e rejeita caso contrário. */
export interface ReadinessProbes {
  db: () => Promise<void>;
  redis: () => Promise<void>;
}

export const READINESS_PROBES = Symbol('READINESS_PROBES');

async function probe(check: () => Promise<void>, timeoutMs: number): Promise<DependencyStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

export async function checkReadiness(
  probes: ReadinessProbes,
  timeoutMs = 2_000,
): Promise<ReadinessReport> {
  const [db, redis] = await Promise.all([
    probe(probes.db, timeoutMs),
    probe(probes.redis, timeoutMs),
  ]);
  return { status: db === 'up' && redis === 'up' ? 'ok' : 'error', db, redis };
}
