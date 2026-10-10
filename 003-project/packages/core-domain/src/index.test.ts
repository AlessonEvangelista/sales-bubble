import { describe, expect, it } from 'vitest';
import { BOUNDED_CONTEXTS } from './index.js';

describe('@bolha/core-domain', () => {
  it('lista os 10 bounded contexts do ADR-0001 sem repetição', () => {
    expect(BOUNDED_CONTEXTS).toHaveLength(10);
    expect(new Set(BOUNDED_CONTEXTS).size).toBe(BOUNDED_CONTEXTS.length);
  });
});
