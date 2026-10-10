import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from './index.js';

describe('@bolha/contracts', () => {
  it('expõe o prefixo versionado da API', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
  });
});
