import { describe, expect, it } from 'vitest';
import { DATABASE_PACKAGE } from './index.js';

describe('@bolha/database', () => {
  it('é importável', () => {
    expect(DATABASE_PACKAGE).toBe('@bolha/database');
  });
});
