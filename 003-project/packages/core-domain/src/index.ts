/**
 * @bolha/core-domain — regras de negócio puras (TS sem dependências de infraestrutura).
 *
 * Esqueleto criado no BV-100. Pode importar apenas `@bolha/contracts` (somente tipos) e
 * bibliotecas puras. Proibido: NestJS, Prisma, Redis, BullMQ, Socket.io, `fetch`,
 * `process.env` e relógio do sistema (usar a porta `Clock`). A verificação automática
 * dessa fronteira entra no BV-101.
 */

/** Bounded contexts do monólito modular (ADR-0001). */
export const BOUNDED_CONTEXTS = [
  'identity',
  'bubble',
  'bidding',
  'payment',
  'triage',
  'reputation',
  'moderation',
  'notification',
  'realtime',
  'platform',
] as const;

export type BoundedContext = (typeof BOUNDED_CONTEXTS)[number];
