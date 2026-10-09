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
});
