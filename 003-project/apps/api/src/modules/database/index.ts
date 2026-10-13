/**
 * API pública do módulo `database` (guia §2.2: outros módulos só importam por aqui ou pelo
 * `*.module.ts`).
 */
export { DatabaseModule } from './database.module.js';
export { PiiService, type BlindHash, type Bytes } from './pii.service.js';
