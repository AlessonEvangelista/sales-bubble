import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://bolha:bolha@localhost:5432/bolha_dev?schema=public',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseApiEnv', () => {
  it('aplica os defaults de desenvolvimento', () => {
    expect(parseApiEnv(base)).toMatchObject({
      API_PORT: 3001,
      APP_ENV: 'local',
      NODE_ENV: 'development',
    });
  });

  it('converte a porta para número', () => {
    expect(parseApiEnv({ ...base, API_PORT: '4000' }).API_PORT).toBe(4000);
  });

  it('não sobe sem as variáveis obrigatórias e não vaza valores na mensagem', () => {
    expect(() => parseApiEnv({ REDIS_URL: 'http://segredo@host' })).toThrow(
      /DATABASE_URL, REDIS_URL/,
    );
    expect(() => parseApiEnv({ REDIS_URL: 'http://segredo@host' })).not.toThrow(/segredo/);
  });

  it('valida FLAGS_DEFAULTS e limita o TTL do cache de flags a 10 s (BV-113)', () => {
    expect(parseApiEnv(base).FLAGS_CACHE_TTL_MS).toBe(10_000);
    expect(parseApiEnv({ ...base, FLAGS_DEFAULTS: 'payments_enabled:false' }).FLAGS_DEFAULTS).toBe(
      'payments_enabled:false',
    );
    expect(() => parseApiEnv({ ...base, FLAGS_DEFAULTS: 'nao_existe:true' })).toThrow(
      /FLAGS_DEFAULTS/,
    );
    expect(() => parseApiEnv({ ...base, FLAGS_CACHE_TTL_MS: '60000' })).toThrow(
      /FLAGS_CACHE_TTL_MS/,
    );
  });
});
