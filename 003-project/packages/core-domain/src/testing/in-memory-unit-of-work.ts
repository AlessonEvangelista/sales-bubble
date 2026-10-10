import { DomainInvariantViolation } from '../shared/errors.js';
import type { DomainEvent, EventRecorder } from '../shared/events.js';
import type { UnitOfWork } from '../shared/unit-of-work.js';

/**
 * Participante de uma transação em memória (ex.: repositório fake, `InMemoryEventRecorder`).
 * `begin` tira um snapshot, `commit` o descarta, `rollback` o restaura.
 */
export interface TransactionParticipant {
  begin(): void;
  commit(): void;
  rollback(): void;
}

/**
 * `UnitOfWork` em memória com a mesma semântica do adapter Prisma: commit se `work` resolver,
 * rollback (de todos os participantes) se rejeitar. Permite simular falha no commit e conta
 * commits/rollbacks para asserções. Unidades aninhadas não são suportadas (o adapter real
 * também não aninha `$transaction`).
 */
export class InMemoryUnitOfWork<TScope> implements UnitOfWork<TScope> {
  commits = 0;
  rollbacks = 0;
  private active = false;
  private pendingCommitFailure: Error | undefined;

  constructor(
    private readonly scope: TScope,
    private readonly participants: readonly TransactionParticipant[] = [],
  ) {}

  get inTransaction(): boolean {
    return this.active;
  }

  /** A próxima unidade executa `work` e falha no commit (ex.: perda de conexão) → rollback. */
  failNextCommit(error: Error = new Error('Falha simulada no commit')): void {
    this.pendingCommitFailure = error;
  }

  async run<T>(work: (scope: TScope) => Promise<T>): Promise<T> {
    if (this.active) throw new DomainInvariantViolation('UnitOfWork aninhada não é suportada');
    this.active = true;
    for (const p of this.participants) p.begin();
    try {
      const result = await work(this.scope);
      const failure = this.pendingCommitFailure;
      if (failure) {
        this.pendingCommitFailure = undefined;
        throw failure;
      }
      for (const p of this.participants) p.commit();
      this.commits++;
      return result;
    } catch (error) {
      for (const p of this.participants) p.rollback();
      this.rollbacks++;
      throw error;
    } finally {
      this.active = false;
    }
  }
}

/**
 * `EventRecorder` em memória que se comporta como o outbox: eventos registrados dentro da
 * unidade só aparecem em `committed` após o commit; no rollback são descartados.
 * Registrar fora de uma unidade de trabalho é bug (evento sem transação).
 */
export class InMemoryEventRecorder implements EventRecorder, TransactionParticipant {
  readonly committed: DomainEvent[] = [];
  private staged: DomainEvent[] | undefined;

  record(events: readonly DomainEvent[]): void {
    if (!this.staged) {
      throw new DomainInvariantViolation('Evento registrado fora de uma UnitOfWork');
    }
    this.staged.push(...events);
  }

  ofType(type: string): DomainEvent[] {
    return this.committed.filter((e) => e.type === type);
  }

  begin(): void {
    this.staged = [];
  }

  commit(): void {
    this.committed.push(...(this.staged ?? []));
    this.staged = undefined;
  }

  rollback(): void {
    this.staged = undefined;
  }
}
