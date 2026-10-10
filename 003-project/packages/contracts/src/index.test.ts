import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  CONTRACT_VERSION,
  ROUTES,
  ERROR_CODES,
  DOMAIN_EVENT_TYPES,
} from './index.js';

describe('@bolha/contracts', () => {
  it('expõe o prefixo versionado da API', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
  });

  it('exporta contrato, catálogo de erros e eventos pelo index', () => {
    expect(CONTRACT_VERSION).toMatch(/^1\.\d+\.\d+$/);
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(ERROR_CODES).toContain('QUOTA_SOLD_OUT');
    expect(DOMAIN_EVENT_TYPES).toContain('BubbleExploded');
  });
});
