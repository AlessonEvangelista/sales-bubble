# ADR-0004 — Curva de preço em degraus com preço final único

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RF03.3](../../../PRD.MD) · [Spec v1.1 F3 e F6](../../../SPEC.md) · decisão do plano: **D3** · ADRs relacionados: ADR-0002, ADR-0003
**Decisores:** PO, Tech Lead, Jurídico (oferta vinculante, CDC art. 30)

## Contexto

- O PRD fala em "preço progressivamente menor" sem definir a fórmula (linear? degraus?) nem quem paga o quê quando o preço cai depois da adesão.
- O pagamento reserva um valor na adesão (ADR-0003); o valor final precisa ser conhecido na explosão e ser justo para quem entrou primeiro.
- A UI precisa mostrar "preço atual se fechar agora" e "próximo degrau" em tempo real (RF02.2, RF03.3).

## Decisão

1. O criador da bolha de **venda** define de 1 a 10 **degraus** `(min_filled_quotas, unit_price)` em centavos (mín. R$ 1,00). O primeiro tem `min_filled_quotas = 0` e `unit_price = initial_price`; o último tem `unit_price = target_price`. Limites estritamente crescentes, preços não crescentes. Os degraus ficam **imutáveis** após a publicação.
2. `preço_atual(filled) = unit_price do maior degrau com min_filled_quotas ≤ filled_quotas`. Só `filled_quotas` (cotas pagas) conta; reservas Pix não (Spec v1.1 F5).
3. **Preço final único:** `final_unit_price = preço_atual(filled_quotas)` no instante da explosão, gravado na mesma transação. Todos pagam o mesmo, inclusive quem entrou no primeiro degrau.
4. Reserva na adesão = `initial_price × cotas` (máximo possível). Na explosão: cartão captura `final × cotas`; Pix estorna `(initial − final) × cotas`.
5. Implementação em `packages/core-domain/bubble/price-curve.ts` (função pura, compartilhada por `api` e `web`). As validações multi-linha ficam no domínio, e o banco garante `target_price <= initial_price` e `unit_price >= 100` ([modelo-dados.md §3.2](../modelo-dados.md#32-bolhas-degraus-e-cotas)).
6. Bolhas de **compra** não têm degraus: `initial_price = target_price` = preço máximo aceitável; o preço final é o do lance vencedor (ADR-0005).

```ts
export function currentUnitPrice(tiers: readonly Tier[], filled: number): Cents {
  // tiers ordenados por minFilledQuotas ASC, validados na criação
  let price = tiers[0].unitPrice;
  for (const t of tiers) { if (t.minFilledQuotas <= filled) price = t.unitPrice; else break; }
  return price;
}
```

## Alternativas consideradas

| Critério | **A. Degraus + preço final único (escolhida)** | B. Curva linear contínua | C. Preço por ordem de entrada (cada um paga o degrau em que entrou) |
| :--- | :---: | :---: | :---: |
| Custo | ●●● | ●● | ●● |
| Reversibilidade | ●●● (degraus aproximam qualquer curva) | ●● | ● muda o contrato com o usuário |
| Complexidade | ●●● simples de explicar e testar | ●● arredondamentos por cota | ●● cobrança diferente por pessoa |
| Risco | ●●● justo e transparente | ●● preço "quebrado" confunde; centavos a cada cota | ● percepção de injustiça; desincentiva entrar cedo |

## Consequências

**Positivas (+)** Regra explicável numa frase; incentivo a convidar (todos ganham com o próximo degrau); captura é um único valor por bolha.
**Negativas (−)** O participante reserva mais do que provavelmente pagará (limite de cartão) → a UI mostra "você paga no máximo R$ X; hoje sairia por R$ Y". A saída de cotas pode **baixar** de degrau → `QuotaReleased` traz `tier_changed` e a UI destaca.

## Verificação

Testes de propriedade (fast-check): o preço é monotônico não crescente em `filled`; `currentUnitPrice(tiers, 0) = initial_price`; o exemplo da Spec F6 (35 → falha; 72 → R$ 80; 100 → R$ 75) como teste de unidade.

## Fontes

- Projeto: Spec v1.1 F3, F6; plano v2 §6 (D3).
- **asias-arquitetura-hexagonal** — *Skill*: regra de negócio pura no domínio, sem dependência de infraestrutura (reutilizável no front).
