import { describe, expect, it } from 'vitest';
import { UI_COMPONENTS_PACKAGE } from './index.js';

describe('@bolha/ui-components', () => {
  it('é importável', () => {
    expect(UI_COMPONENTS_PACKAGE).toBe('@bolha/ui-components');
  });
});
