import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import { checkReadiness, type ReadinessProbes } from './readiness.js';

const up = (): Promise<void> => Promise.resolve();
const down = (): Promise<void> => Promise.reject(new Error('connection refused'));
const controller = (probes: ReadinessProbes): HealthController => new HealthController(probes);

describe('HealthController', () => {
  it('responde ok no liveness', () => {
    expect(controller({ db: down, redis: down }).live()).toEqual({ status: 'ok' });
  });

  it('readiness ok quando Postgres e Redis respondem', async () => {
    await expect(controller({ db: up, redis: up }).ready()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });
  });

  it('readiness 503 indicando o dependente fora', async () => {
    const error = await controller({ db: up, redis: down })
      .ready()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(503);
    expect((error as HttpException).getResponse()).toEqual({
      status: 'error',
      db: 'up',
      redis: 'down',
    });
  });

  it('readiness marca down a sonda que estoura o timeout', async () => {
    const hang = (): Promise<void> => new Promise(() => undefined);
    await expect(checkReadiness({ db: hang, redis: up }, 10)).resolves.toEqual({
      status: 'error',
      db: 'down',
      redis: 'up',
    });
  });
});
