/**
 * Identificadores (guia §5.4): UUID v7 gerados na aplicação, porque o PostgreSQL 16 não tem
 * `uuidv7()` nativo. Os aliases abaixo documentam a intenção; o valor é a string canônica do UUID.
 */
export type Uuid = string;
export type AccountId = Uuid;
export type BubbleId = Uuid;
export type QuotaId = Uuid;
export type PaymentId = Uuid;
export type PayoutId = Uuid;
export type EventId = Uuid;

/**
 * Porta `IdGenerator` (guia §2.2 / §6.1). Adapter de produção: `UuidV7Generator` (lib `uuid` v10+).
 * Fake: `SequentialIdGenerator` (`@bolha/core-domain/testing`).
 */
export interface IdGenerator {
  next(): Uuid;
}
