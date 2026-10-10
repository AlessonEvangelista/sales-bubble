/**
 * @bolha/database — persistência (Prisma), migrations, seeds e adapters de repositório.
 *
 * Esqueleto criado no BV-100; sonda de conectividade e infraestrutura do seed no BV-102
 * (EN-022). O schema Prisma e as migrations iniciais entram no BV-107 (EN-027).
 * Pode importar `@bolha/core-domain` e `@bolha/contracts`; nunca `apps/*`.
 */

export const DATABASE_PACKAGE = '@bolha/database' as const;

export { createPostgresProbe, type PostgresProbe } from './postgres-probe.js';

// Feature flags e kill switches — módulo platform (BV-113 / EN-033).
export * from './platform/feature-flags/index.js';
