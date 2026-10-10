/**
 * @bolha/core-domain — regras de negócio puras (TS sem dependências de infraestrutura).
 *
 * Esqueleto criado no BV-100. Pode importar apenas `@bolha/contracts` (somente tipos) e
 * bibliotecas puras. Proibido: NestJS, Prisma, Redis, BullMQ, Socket.io, `fetch`,
 * `process.env` e relógio do sistema (usar a porta `Clock`). Verificado por
 * `npm run lint:boundaries` (dependency-cruiser) e pelo ESLint (BV-101).
 *
 * Portas e tipos base (BV-112): `shared/` (Clock, IdGenerator, UnitOfWork, EventRecorder,
 * Result, Money), `payment/` (PaymentPort), `identity/` (CnpjPort), `notification/` (Notifier).
 * Fakes em `@bolha/core-domain/testing`.
 */
export * from './identity/index.js';
export * from './notification/index.js';
export * from './payment/index.js';
export * from './shared/index.js';

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
