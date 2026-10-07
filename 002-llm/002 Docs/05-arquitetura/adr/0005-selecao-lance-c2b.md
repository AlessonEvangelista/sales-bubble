# ADR-0005 — Seleção do lance em bolhas de compra (C2B/B2B)

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RF04](../../../PRD.MD) · [Spec v1.1 F8](../../../SPEC.md) · decisão do plano: **D4** · ADRs relacionados: ADR-0009, ADR-0011
**Decisores:** PO, Tech Lead

## Contexto

O PRD não define quem escolhe o lance, quando, nem se os lances são públicos. Os participantes autorizam até o `target_price`. Sem regra de fallback, uma bolha de compra bem-sucedida poderia ficar parada para sempre com dinheiro reservado (e a pré-autorização expira — R5).

## Decisão

1. **Envio:** só PJ `ACTIVE` com CNPJ `ATIVA`, diferente do criador, enquanto a bolha está `ACTIVE`. `unit_price ≤ target_price` (senão 422 `BID_ABOVE_TARGET`). Um lance vigente por PJ por bolha (índice único parcial). **Substituir** = na mesma transação, o anterior vira `WITHDRAWN` e o novo é inserido (`replaces_bid_id`). Após a explosão, o lance fica vinculante até a seleção.
2. **Visibilidade:** durante `ACTIVE`, preço, prazo e faixa de score de cada lance são públicos, com a empresa por **pseudônimo**. O nome da vencedora é revelado aos participantes após a seleção.
3. **Janela:** na explosão com sucesso, `bid_selection_deadline = exploded_at + 24 h`. O criador escolhe com `POST /bubbles/{id}/bids/{bidId}/select`. Aviso em T−2 h.
4. **Fallback:** no prazo, o job `bid-selection-timeout` (e o reconciliador) escolhe `ORDER BY unit_price ASC, submitted_at ASC LIMIT 1` entre lances `SUBMITTED` de licitantes ainda com CNPJ `ATIVA`. Sem lance válido → bolha `CANCELLED` (`NO_VALID_BID`) com estorno de 100%.
5. **Corrida criador × timeout** resolvida por um `UPDATE` condicional único:

```sql
UPDATE bubbles SET selected_bid_id = :bid, final_unit_price = :price, version = version + 1
 WHERE id = :id AND status = 'EXPIRED_SUCCESS' AND selected_bid_id IS NULL
   AND (:by_creator = false OR now() < bid_selection_deadline);
-- 1 linha: vence; 0 linhas: o outro chegou antes (criador recebe 409 BID_SELECTION_WINDOW_CLOSED)
```

   Na mesma transação: lance → `SELECTED` (índice único `bids_one_selected_uk`), outbox `BidSelected`. Consumidores: captura no preço do lance (o restante do `target_price` é liberado), rejeição dos demais lances e notificações. Essa transação toca `bubbles` e `bids` (exceção documentada em [c4.md §4.3](../c4.md#43-regras-de-dependência-entre-módulos-verificadas-em-ci)).

## Alternativas consideradas

| Critério | **A. Criador escolhe em 24 h + fallback menor preço (escolhida)** | B. Leilão automático (menor preço vence sempre) | C. Criador escolhe sem prazo | D. Votação dos participantes |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●●● | ●●● | ●●● | ● |
| Reversibilidade | ●●● (parâmetro de janela) | ●●● | ●● | ● |
| Complexidade | ●● job + corrida tratada | ●●● | ●●● | ● quórum, empates |
| Risco | ●●● prazo limitado; critérios além do preço (prazo de entrega, score) | ●● ignora prazo/score | ● dinheiro preso; pré-autorização expira | ●● baixa participação |

## Consequências

**Positivas (+)** O criador pode valorizar prazo e reputação; a bolha nunca fica presa; a corrida é segura sem lock.
**Negativas (−)** A janela de 24 h consome validade da pré-autorização → bolhas de compra têm duração máxima de **4 dias** (venda: 5), para que duração + 24 h ≤ 5 dias (CHECK `bubbles_purchase_duration_ck`; validar a validade real no spike do gateway, Spec Q1). Pseudônimos não impedem conluio entre PJs → monitorar padrões (R8).

## Verificação

CT: timeout escolhe o menor preço e, no empate, o mais antigo; criador e timeout em paralelo → exatamente 1 `BidSelected`; sem lances → `CANCELLED` + estornos; lance acima do alvo → 422.

## Fontes

- Projeto: PRD v2.1 RF04; Spec v1.1 F8; plano v2 §6 (D4).
- **asias-postgresql** — *PostgreSQL 17 Docs* §13.2: `UPDATE` em Read Committed reavalia a condição após a transação concorrente (base da resolução da corrida).
