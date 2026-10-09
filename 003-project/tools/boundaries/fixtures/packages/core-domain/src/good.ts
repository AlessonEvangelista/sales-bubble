import type { Money } from '@bolha/contracts';
import { v7 } from 'uuid';

export const ok = (m: Money) => [m, v7()];
