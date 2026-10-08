# ADR-0009 — Máquina de estados revisada da bolha (`EXPIRED_SUCCESS`/`EXPIRED_FAILED`; flags derivadas)

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 §5.2 e §8.1](../../../PRD.MD) · [Spec v1.1 F7, §4](../../../SPEC.md) · decisão do plano: **D8** · Detalhe: [maquina-estados.md](../maquina-estados.md)
**Decisores:** PO, Tech Lead

## Contexto

A máquina do PRD v2.0 (`DRAFT → ACTIVE → NEAR_FULL / EXPIRING → EXPIRED → IN_TRIAGE → COMPLETED / CANCELLED`) tinha quatro problemas (plano §6, D8):

- (a) não havia `ACTIVE → EXPIRED` direto (uma PJ que compra 100% de uma vez);
- (b) `NEAR_FULL` e `EXPIRING` podem ser verdadeiros ao mesmo tempo, e estados são mutuamente exclusivos;
- (c) uma bolha que expira **sem** meta ia para `IN_TRIAGE`, mas deveria ir para `CANCELLED` com estorno;
- (d) a métrica "explodem com sucesso" era ambígua.

Os diagramas `class.md` e `sequence.md` também divergiam (sem `DRAFT`, timer levando direto a `IN_TRIAGE`).

## Decisão

Estados: `DRAFT`, `ACTIVE`, `EXPIRED_SUCCESS`, `EXPIRED_FAILED`, `IN_TRIAGE`, `COMPLETED`, `CANCELLED`.

```text
DRAFT → ACTIVE → EXPIRED_SUCCESS | EXPIRED_FAILED
EXPIRED_SUCCESS → IN_TRIAGE → COMPLETED | CANCELLED
EXPIRED_SUCCESS → CANCELLED        (compra sem lance válido)
EXPIRED_FAILED  → CANCELLED        (estorno 100% automático)
DRAFT → CANCELLED                  (criador descarta)
ACTIVE → CANCELLED                 (criador sem cotas de terceiros, ou moderação/suspensão da conta)
```

- Explosão por **lotação**: `filled_quotas = max_quotas` (só cotas pagas) → `EXPIRED_SUCCESS` na **mesma transação** da última cota.
- Explosão por **tempo**: `filled_quotas >= min_quotas` → `EXPIRED_SUCCESS`, senão `EXPIRED_FAILED`; reservas Pix pendentes são canceladas na mesma transação.
- `NEAR_FULL` (≥ 80%) e `EXPIRING` (< 60 min) são **flags derivadas** (`is_near_full`, `is_expiring`), calculadas na leitura e no cliente, nunca persistidas como `status`. `is_expiring` também bloqueia a saída de cota.
- Toda transição = `UPDATE … WHERE status = :de [AND guarda]` + evento no outbox na mesma transação; `rows_affected = 0` = transição já feita por outro ator ou guarda falsa (idempotente).
- Métrica de sucesso (PRD §10): taxa de conclusão = `COMPLETED / (COMPLETED + CANCELLED)`; taxa de explosão com sucesso = `EXPIRED_SUCCESS / (EXPIRED_SUCCESS + EXPIRED_FAILED)`.

Tabelas de transição completas (bolha, cota, pagamento, lance, item de triagem, contestação, moderação) em [maquina-estados.md](../maquina-estados.md).

## Alternativas consideradas

| Critério | **A. Estados D8 + flags (escolhida)** | B. Máquina do PRD v2.0 com remendos | C. Estados ortogonais (statecharts paralelos para "lotação" e "tempo") |
| :--- | :---: | :---: | :---: |
| Custo | ●●● | ●● | ●● biblioteca de statecharts |
| Reversibilidade | ●●● | ●● | ●● |
| Complexidade | ●●● 7 estados, transições explícitas | ● combinações inválidas | ● difícil de persistir e consultar em SQL |
| Risco | ●●● falha separada de sucesso; estorno garantido | ● bolha falha entra em triagem | ●● |

## Consequências

**Positivas (+)** Estados mutuamente exclusivos e consultáveis por índice; falha e sucesso separados (estorno automático); métricas sem ambiguidade.
**Negativas (−)** Diagramas antigos (PRD v2.0, `class.md`, `sequence.md`, `arquitetura.md`) ficam obsoletos → marcar como substituídos. A UI precisa calcular as flags (contrato em `packages/contracts`).

## Verificação

Teste de propriedade: só os pares (de, para) da tabela são aceitos; CT de explosão por lotação (PJ 100%) e por tempo (com e sem meta, com reserva Pix pendente).

## Fontes

- Projeto: PRD v2.1 §8.1; Spec v1.1 F5, F7; plano v2 §6 (D8).
- **asias-postgresql** — *PostgreSQL 17 Docs* §13.2: reavaliação do `WHERE` em Read Committed, base das transições condicionais idempotentes.
- **arquitetura-ddd** — *DDD by Examples: Library*: consistência imediata dentro do agregado e eventos entre agregados.
