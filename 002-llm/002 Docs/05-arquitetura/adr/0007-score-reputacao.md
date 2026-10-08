# ADR-0007 — Score de reputação 0–1000 por eventos ponderados com meia-vida de 180 dias, versionado e contestável

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RF05.3](../../../PRD.MD) · [Spec v1.1 F10](../../../SPEC.md) · decisão do plano: **D6** · ADRs relacionados: ADR-0009
**Decisores:** PO, Tech Lead, Jurídico (decisão automatizada que afeta o titular — LGPD art. 20)

## Contexto

- O PRD exige score atualizado ao fim das transações, com contestação em até 5 dias, mas não define o algoritmo.
- O score precisa ser **explicável** ("por que meu score mudou"), resistente a manipulação (R8) e evoluível sem reescrever o histórico.
- No R1 o score é apenas informativo: não bloqueia ninguém (Spec F10).

## Decisão

1. **Livro de eventos** (`score_events`) como fonte da verdade; o `accounts.score` é cache recalculável.
2. Pesos v1 (Spec v1.1 F10):

| `kind` | Quem | Pontos |
| :--- | :--- | ---: |
| `TX_COMPLETED_BUYER` / `TX_COMPLETED_SELLER` | comprador / vendedor (item `COMPLETED`) | +20 / +30 |
| `SHIPPED_ON_TIME` | vendedor | +5 |
| `SHIPPING_LATE` (envio na tolerância de +3 dias) | vendedor | −15 |
| `CANCELLED_BY_FAULT` (fim da tolerância ou cancelamento do comprador no atraso) | vendedor | −60 |
| `TRIAGE_CASE_UPHELD` (caso de triagem procedente) | vendedor | −30 |
| `CHARGEBACK_REJECTED` (chargeback após `COMPLETED`, improcedente) | comprador | −40 |

   Não geram penalidade: reserva Pix expirada, saída de cota, arrependimento e falha de captura por pré-autorização expirada.
3. Fórmula: `score = clamp(0, 1000, round(500 + Σ points_i × 0,5^(idade_i_em_dias / 180)))`, somando só eventos `EFFECTIVE` (eventos `UNDER_REVIEW` e `REVERSED` ficam de fora). Faixas: 0–299 Risco · 300–599 Regular · 600–799 Bom · 800–1000 Excelente.
4. **Versionamento:** `score_model_version` em cada evento e na conta. Mudar pesos ou meia-vida = nova versão, recálculo em lote e changelog público.
5. **Recalcular:** de forma síncrona no consumidor que grava o evento (custo O(eventos da conta), pequeno) e num job diário (`maintenance:score-decay`) para o decaimento. `ScoreChanged` só é emitido se a faixa ou o valor inteiro mudar.
6. **Idempotência:** `UNIQUE (account_id, kind, source_id)`: o mesmo item nunca pontua duas vezes.
7. **Contestação:** até 5 dias do evento; o evento vai para `UNDER_REVIEW` (não conta); julgamento pelo módulo `moderation`, por moderador diferente do que decidiu o caso de origem; `UPHELD` → `REVERSED`; `REJECTED` → `EFFECTIVE`. Ver [maquina-estados.md §7](../maquina-estados.md#7-contestação-de-score).

## Alternativas consideradas

| Critério | **A. Eventos ponderados + meia-vida (escolhida)** | B. Média de avaliações (estrelas) | C. Contador simples sem decaimento | D. Modelo estatístico (bayesiano/ML) |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●●● | ●● exige UI e moderação de avaliações | ●●● | ● dados que não existem no R1 |
| Reversibilidade | ●●● (versão + recálculo) | ●● | ●● | ●● |
| Complexidade | ●● | ●● | ●●● | ● |
| Risco | ●●● baseado em fatos verificáveis; explicável | ● avaliações manipuláveis e subjetivas | ●● passado ruim pesa para sempre (ou bom passado protege fraude) | ● opaco; difícil de contestar (LGPD art. 20) |

## Consequências

**Positivas (+)** Cada ponto tem origem auditável; contestação simples (reverter um evento); evolução por versão.
**Negativas (−)** Pesos são hipóteses → revisar com dados do beta. Um vendedor novo (500) não se distingue de um mediano → exibir também "nº de transações concluídas".

## Verificação

Testes de unidade da fórmula (decaimento em 180 dias = metade do peso); teste de idempotência do consumidor; contestação procedente remove o efeito no recálculo.

## Fontes

- Projeto: Spec v1.1 F10; plano v2 §6 (D6), §9 (contestação).
- **arquitetura-ddd** — *DDD + Microservices Web* (microservices.io): o *audit log* confiável e as consultas temporais de um registro baseado em eventos (página "Event sourcing"), aplicados aqui só ao livro de pontos, sem *event sourcing* do sistema inteiro.
