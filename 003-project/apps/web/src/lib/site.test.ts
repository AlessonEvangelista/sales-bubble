import { describe, expect, it } from 'vitest';
import { SITE_NAME } from './site';

describe('site', () => {
  it('usa o nome do produto', () => {
    expect(SITE_NAME).toBe('Bolha Venda');
  });
});
