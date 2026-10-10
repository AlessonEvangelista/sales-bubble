import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('responde ok no liveness', () => {
    expect(new HealthController().live()).toEqual({ status: 'ok' });
  });
});
