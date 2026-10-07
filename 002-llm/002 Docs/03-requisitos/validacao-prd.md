# Relatório de Validação do PRD — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Concluído (correções aplicadas no PRD v2.1)
**Base:** [PRD v2.0 → v2.1](../../PRD.MD) · **Spec resultante:** [SPEC.md](../../SPEC.md)

---

## 1. Método

Revisão técnica do PRD v2.0 com a lista de controle de validação de requisitos de Pressman (via AlterEgo, especialista `requirements-engineer`). Cada requisito e seção foi verificado contra 7 perguntas:

1. Está claro, sem dupla interpretação?
2. A fonte (pessoa, lei, documento) está identificada?
3. Tem limite quantitativo?
4. É testável (dá para escrever um critério de validação)?
5. É rastreável a outros requisitos e modelos?
6. Contradiz outro requisito ou restrição do domínio?
7. Há requisito implícito que deveria estar explícito?

Também foram cruzados os documentos irmãos: `mvp.md`, `requirements.md`, `tecnologias.md`, `arquitetura.md`, `judicial-viability.md`, `planing-project.md` e o diagrama `class.md`.

**Resultado:** 22 achados — 6 contradições (C), 9 omissões (O), 5 problemas de verificabilidade (V) e 2 desatualizações (D). Todos foram corrigidos no PRD v2.1. Os que dependem de decisão de negócio entraram como **"Proposto (ADR)"** e ficam pendentes da aprovação no Gate A.

---

## 2. Achados

### 2.1 Contradições

| # | Onde | Problema | Correção no v2.1 |
| :--- | :--- | :--- | :--- |
| C1 | §5.2 e §8.2 × `tecnologias.md` | Três estratégias de concorrência diferentes: Redlock, `SELECT FOR UPDATE` e `SERIALIZABLE` | Fica só o `UPDATE` condicional + índice único parcial para PF (ADR-0002). O diagrama 8.2 foi refeito. |
| C2 | §4.1 × `mvp.md` §3.2 | O PRD exige estorno de "valores pré-reservados", mas o MVP previa liquidação manual, sem gateway. Sem gateway não existe pré-reserva. | Integração com gateway terceirizado (pré-autorização/captura) entra no escopo; continua fora o processamento financeiro próprio (§9). |
| C3 | §8.1 | Toda bolha `EXPIRED` vai para `IN_TRIAGE`, inclusive a que expirou **sem** atingir a meta, que o §4.1 manda estornar | O resultado se divide em `EXPIRED_SUCCESS` e `EXPIRED_FAILED`; a falha vai direto para `CANCELLED` com estorno. |
| C4 | §8.1 | `NEAR_FULL` e `EXPIRING` são estados exclusivos, mas podem ocorrer ao mesmo tempo (80% das cotas e < 1 h) | Viram flags derivadas para a UI, não estados. |
| C5 | §8.1 | Não existe `ACTIVE → EXPIRED` direto. Uma PJ que compra 100% de uma bolha com < 80% preenchido não tem transição válida. | A explosão por lotação vale a partir de `ACTIVE`, na mesma transação da última cota. |
| C6 | §3.1 × §3.2 | O monopólio é proibido para PF (1 cota), mas uma PJ pode comprar 100% das cotas, o que esvazia a proposta coletiva | Teto `max_pj_share` (padrão 50%) — ADR-0006. |

### 2.2 Omissões

| # | Lacuna | Correção no v2.1 |
| :--- | :--- | :--- |
| O1 | Não há requisito de **criação de bolha** (venda e compra) — o RF03 trata só de cotas | Novo RF06 (Criação e publicação de bolhas) |
| O2 | A **curva de desconto** é citada, mas não definida (fórmula, quem define, quem paga quanto) | Degraus definidos pelo criador; preço final único para todos (ADR-0004) |
| O3 | Não existe **meta mínima** de cotas, embora o §4.1 fale em "meta" | Campos `min_quotas` (meta) e `max_quotas` (capacidade) |
| O4 | **Seleção do lance** C2B indefinida (quem escolhe, quando, limite de preço) | Janela de 24 h, fallback para o menor lance, lance ≤ preço-alvo (ADR-0005) |
| O5 | Não há requisito de **pagamento, estorno e repasse** | Novo RF07 |
| O6 | **Algoritmo de score** inexistente; "transparente" sem conteúdo | Score 0–1000, eventos e pesos publicados (ADR-0007) |
| O7 | Faltam **notificações**, **saída de cota**, **duração mín./máx.** e **moderação** | Novos RF08 e RF09; regras no RF03 e RF06 |
| O8 | **Direitos do titular LGPD** (acesso, exclusão, portabilidade) sem requisito | Incluídos no RF01 e no RNF03 |
| O9 | **Verificação de CNPJ** "junto à Receita Federal": não existe API pública oficial em tempo real | Provedor (BrasilAPI + fallback), revalidação a cada 30 dias (ADR-0008) |

### 2.3 Verificabilidade

| # | Item | Problema | Correção no v2.1 |
| :--- | :--- | :--- | :--- |
| V1 | RNF01 "500 bolhas em 60 FPS" | Sem dispositivo de referência nem condição de medição | Device de referência + p95 do frame time durante pan/zoom |
| V2 | RNF01 "WebSockets < 200 ms" | Sem percentil nem ponto de medição | p99, medido do commit no servidor até a renderização no cliente |
| V3 | Métrica primária "> 65% explodem com sucesso" | Toda bolha explode — "sucesso" é ambíguo; base indefinida | `EXPIRED_SUCCESS ÷ bolhas publicadas`, por coorte mensal |
| V4 | Métrica "tempo médio até 100% < 48 h" | Média distorcida; ignora as bolhas que fecham pela meta sem lotar | Mediana do tempo até `EXPIRED_SUCCESS` |
| V5 | Ausência de métricas de proteção (guardrail) | Sucesso poderia ser "comprado" com estornos, fraude ou disputas | Guardrails: taxa de estorno, de contestação procedente e de cancelamento na triagem |

### 2.4 Desatualizações

| # | Item | Correção no v2.1 |
| :--- | :--- | :--- |
| D1 | Rodapé aponta `bolha-venda/PRD.MD`; o arquivo está em `002-llm/PRD.MD` | Rodapé atualizado |
| D2 | Status "Especificado & Pronto para Engenharia" com decisões abertas | "Em revisão — aprovação no Gate A" |

---

## 3. Riscos jurídicos que exigem advogado

A base `juridico-contratos` do AlterEgo cobre LGPD, mas **declara não cobrir direito contratual geral nem responsabilidade de intermediador**. Por isso, os pontos abaixo ficam marcados para parecer jurídico, sem conclusão técnica:

- **Responsabilidade da plataforma em relações de consumo.** O PRD invoca o Marco Civil art. 19 para limitar a responsabilidade, mas em relação de consumo a plataforma pode ser tratada como integrante da cadeia de fornecimento (CDC). Validar com advogado.
- **CDC em B2B.** A aplicação do CDC quando a PJ é destinatária final deve ser analisada caso a caso.
- **CNPJ de MEI.** Pode identificar uma pessoa física; nesse caso, tratar como dado pessoal (o PRD v2.1 aplica a mesma proteção a CPF e CNPJ).

---

## 4. Itens que continuam abertos (Gate A)

As 8 decisões D1–D8 do [plano de projeto](../planing-project.md) foram incorporadas ao PRD v2.1 como **Proposto**. O PRD só passa a "Aprovado" quando PO, Tech Lead e Jurídico assinarem no Gate A. Pendentes de confirmação externa:

- Validade da pré-autorização de cartão no gateway escolhido (define a duração máxima de 5 dias, R5).
- Take rate de 6% (hipótese de negócio).

---

## Fontes consultadas (AlterEgo)

- `requirements-engineer`: Roger S. Pressman, *Engenharia de Software* (7. ed.), cap. de Requisitos, p. 129–130 — lista de controle de validação e estrutura de SRS (Wiegers); *Manual de Processo — Desenvolvimento de Software*, §2.1 (fase 3 → ERS).
- `asias-product-management`: Teresa Torres / producttalk.org — business × product outcomes (*leading* × *lagging*), base para as métricas e guardrails.
- `juridico-contratos`: Q21 (quando acionar advogado externo), Q03 (pseudonimização continua dado pessoal), skill do especialista (escopo sem direito contratual geral).
- `asias-postgresql`: *PostgreSQL 17 Docs* §13.3–13.4 (achado C1).
