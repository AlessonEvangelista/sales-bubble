/**
 * @bolha/contracts — contratos compartilhados entre front e back (BV-111 / EN-031).
 *
 * - `common`  — primitivos (UUID, datas, centavos), enums de domínio e paginação por cursor;
 * - `errors`  — RFC 9457 (problem+json) e catálogo de códigos de erro;
 * - `api/*`   — DTOs Zod das rotas REST e o registro `ROUTES` (fonte do `openapi.yaml`);
 * - `events/*` — eventos de domínio (outbox) e eventos WebSocket, tipados e versionados.
 *
 * Regra de fronteira: este pacote só importa `zod` (`contracts-only-zod`).
 */
export * from './common.js';
export * from './errors.js';
export * from './api/identity.js';
export * from './api/bubbles.js';
export * from './api/quotas.js';
export * from './api/bids.js';
export * from './api/notifications.js';
export * from './api/routes.js';
export * from './events/domain-events.js';
export * from './events/ws-events.js';
