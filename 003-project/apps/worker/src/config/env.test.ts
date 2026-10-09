import { describe, expect, it } from 'vitest';
import { parseWorkerEnv } from './env.js';

describe('parseWorkerEnv', () => {
  it('aceita o ambiente local do docker compose com defaults', () => {
    const env = parseWorkerEnv({
      DATABASE_URL: 'postgresql://bolha:bolha@localhost:5432/bolha_dev',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(env).toMatchObject({ BULLMQ_PREFIX: 'bull', RECONCILER_INTERVAL_MS: 60_000 });
  });

  it('não sobe sem DATABASE_URL e REDIS_URL', () => {
    expect(() => parseWorkerEnv({})).toThrow(/DATABASE_URL, REDIS_URL/);
  });
});
