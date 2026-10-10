/**
 * Evento de domínio como o caso de uso o devolve para o adapter gravar no outbox, na mesma
 * transação da mudança de estado (guia §7, ADR-0010). Nome no passado (`QuotaAcquired`).
 * Payload sem PII. O schema serializado/versionado de cada evento vive em `@bolha/contracts`.
 */
export interface DomainEvent<
  TType extends string = string,
  TPayload = Readonly<Record<string, unknown>>,
> {
  readonly type: TType;
  readonly aggregateId: string;
  readonly payload: TPayload;
}

/**
 * Porta `EventRecorder` (guia §2.2): registra eventos dentro da unidade de trabalho corrente.
 * O adapter de produção grava em `outbox_events` na mesma transação (`appendOutbox`), de modo
 * que não existe evento sem commit nem commit sem evento.
 */
export interface EventRecorder {
  record(events: readonly DomainEvent[]): void;
}
