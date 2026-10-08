# ADR-0006 — Teto de cotas por PJ (`max_pj_share`) com *advisory lock* por (bolha, PJ)

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RF03.2](../../../PRD.MD) · [Spec v1.1 F3, F5, §5](../../../SPEC.md) · decisão do plano: **D5** · ADRs relacionados: ADR-0002
**Decisores:** PO, Tech Lead

## Contexto

- O PRD permite que a PJ compre "múltiplas cotas" sem limite, o que deixaria uma PJ monopolizar a bolha (o PRD proíbe isso para PF).
- Spec v1.1: `max_pj_share` configurável pelo criador entre 10% e 100% (padrão 50%); **teto em cotas = `max(1, ⌊max_pj_share × max_quotas⌋)`**; reservas Pix contam para o teto; recusa `PJ_SHARE_EXCEEDED`.
- O teto é uma regra **por conta**: soma das cotas `RESERVED` + `ACTIVE` daquela PJ naquela bolha. Ele não cabe no `UPDATE` condicional da linha da bolha (ADR-0002), que só conhece totais.

## Decisão

1. Coluna `bubbles.max_pj_share smallint` (10–100, padrão 50), imutável após a publicação. Teto calculado no domínio: `maxPerPj = max(1, floor(max_quotas * max_pj_share / 100))`.
2. **Mecanismo escolhido: *advisory lock* transacional por (bolha, conta PJ)**, adquirido no início da transação de cota, **antes** do `UPDATE` da bolha:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended(:bubble_id::text || ':' || :account_id::text, 0));
SELECT coalesce(sum(quantity), 0) AS held
  FROM quotas WHERE bubble_id = :bubble_id AND account_id = :account_id AND status IN ('RESERVED','ACTIVE');
-- held + :n > maxPerPj → ROLLBACK → 409 PJ_SHARE_EXCEEDED ("Sua empresa pode ocupar no máximo N cotas")
UPDATE bubbles ... (ADR-0002) ...;
INSERT INTO quotas ...;
COMMIT;   -- o advisory lock é liberado no fim da transação
```

3. O lock só serializa requisições **da mesma PJ na mesma bolha** (a corrida que importa para o teto). Ele não afeta outras contas e não toca o caminho de PF. Ordem fixa de aquisição (advisory → linha da bolha) em todos os fluxos de cota: sem ciclo, sem deadlock.

**Por que não "checagem dentro do mesmo `UPDATE`"** (`AND (SELECT sum(quantity) FROM quotas WHERE …) + :n <= teto`): em Read Committed, quando o `UPDATE` espera a linha da bolha e a reavalia, a subconsulta sobre **outra tabela** (`quotas`) não enxerga a cota que a transação concorrente acabou de inserir com segurança garantida. Duas compras simultâneas da mesma PJ poderiam passar o teto. O *advisory lock* torna a leitura da soma e a escrita sequenciais para o par (bolha, PJ).

## Alternativas consideradas

| Critério | **A. Advisory lock (bolha, PJ) + soma (escolhida)** | B. Subconsulta no `UPDATE` da bolha | C. Coluna de contagem por PJ (`bubble_pj_holdings`) com `UPDATE` condicional | D. `SERIALIZABLE` só nessa transação |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●●● 1 instrução extra só para PJ | ●●● | ●● tabela + manutenção em todas as transições de cota | ●● retry |
| Reversibilidade | ●●● | ●●● | ●● | ●●● |
| Complexidade | ●●● | ●●● | ●● dois contadores a manter coerentes | ●● tratar `40001` |
| Risco | ●●● corrida eliminada | ● corrida possível com a mesma PJ em paralelo | ●●● correto, mas mais pontos de bug | ●● aborts sob rajada |

C é a evolução natural se o volume de PJ crescer muito (o `UPDATE` condicional por linha `(bubble_id, account_id)` dispensa o lock). No R1, A é mais simples.

## Consequências

**Positivas (+)** Monopólio impossível acima do teto, inclusive com requisições paralelas da mesma PJ; nenhum impacto em PF.
**Negativas (−)** Uma PJ que dispara muitas compras paralelas na mesma bolha vê latência maior (serialização), o que é aceitável e até desejável (anti-abuso). Com `max_quotas` pequeno, `max(1, …)` garante que a PJ sempre possa comprar ao menos 1 cota.

## Verificação

CT: `max_quotas = 100`, `max_pj_share = 50`; a mesma PJ dispara 10 × `n = 10` em paralelo → exatamente 5 sucessos; reservas Pix contam para o teto; `max_quotas = 3`, `share = 10%` → teto 1.

## Fontes

- Projeto: Spec v1.1 F3, F5, §5; plano v2 §6 (D5).
- **asias-postgresql** — *PostgreSQL 17 Docs* §13.3 "Explicit Locking", *Advisory Locks*: locks com significado definido pela aplicação, em nível de transação (liberados no fim), úteis para estratégias que não se encaixam bem no MVCC; deadlocks são evitados adquirindo locks numa ordem consistente. §13.2: limites do Read Committed com condições que dependem de outras linhas.
