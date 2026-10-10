/**
 * Porta `UnitOfWork` (guia §2.1/§2.2): delimita uma transação atômica sem que o domínio saiba
 * que ela é um `prisma.$transaction` (adapter em `packages/database`).
 *
 * `TScope` é o conjunto de portas transacionais que o caso de uso usa dentro da unidade
 * (ex.: `{ quotas: QuotaReservationPort; events: EventRecorder }`) — cada caso de uso declara
 * só o que precisa (portas pequenas, guia §5.1).
 *
 * Semântica:
 * - `run` confirma (commit) se `work` resolver e desfaz (rollback) se `work` rejeitar,
 *   propagando o mesmo erro;
 * - falhas de negócio devolvidas como `Result` **não** desfazem nada sozinhas: o caso de uso
 *   decide (normalmente validando antes de escrever);
 * - nenhuma chamada ao gateway de pagamento dentro de `run` (ADR-0003 item 3).
 */
export interface UnitOfWork<TScope> {
  run<T>(work: (scope: TScope) => Promise<T>): Promise<T>;
}
