import { describe, expect, it } from 'vitest';
import { WorkerStatus } from './worker-status.js';

describe('WorkerStatus', () => {
  it('descreve o estado do worker', () => {
    expect(new WorkerStatus().describe()).toBe('worker pronto (10 bounded contexts)');
  });
});
