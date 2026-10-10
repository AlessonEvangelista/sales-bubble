/**
 * @bolha/contracts — contratos compartilhados entre front e back.
 *
 * Esqueleto criado no BV-100. DTOs, schemas Zod, OpenAPI, eventos WS/domínio e
 * catálogo de erros RFC 9457 entram no BV-111 (EN-031).
 * Regra: este pacote não importa nenhum outro pacote do monorepo (só `zod`).
 */

/** Prefixo versionado da API REST (guia de desenvolvimento §3.1). */
export const API_BASE_PATH = '/api/v1' as const;

// Feature flags e kill switches (BV-113 / EN-033).
export * from './flags.js';
