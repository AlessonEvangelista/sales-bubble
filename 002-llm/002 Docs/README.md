# Índice da Documentação — Bolha Venda

**Atualizado em:** 06/10/2026 · **Status do conjunto:** Rascunho para revisão (aprovação no Gate A)

Documentação completa do projeto, organizada pelas 12 fases do *Manual de Processo* do AlterEgo. Todos os documentos novos seguem o mesmo cabeçalho (versão, data, status, base) e terminam com **"Fontes consultadas (AlterEgo)"**.

**Documentos de referência** (em `002-llm/`):
- [PRD v2.1](../PRD.MD) — o quê e por quê.
- [Spec do Produto v1.1](../SPEC.md) — como o produto se comporta. **Prevalece em caso de conflito**, exceto quando um ADR mais recente decidir diferente.

> **Como ler:** quem chega agora começa pelo PRD → Spec → glossário → C4. Quem vai codar: guia de desenvolvimento → ERS → histórias → API. Quem decide: plano de projeto → business case → ADRs → questões em aberto (abaixo).

---

## Mapa por fase

| Fase do manual | Pasta | Documento | Gate |
| :--- | :--- | :--- | :--- |
| 2 · Discovery | [01-negocio](01-negocio/) | [Business case](01-negocio/business-case.md) — Lean Canvas, Impact Map, modelo de receita, unit economics (fórmulas), hipóteses H1–H12 | A |
| | | [Stakeholders e RACI](01-negocio/stakeholders-raci.md) — mapa de poder × interesse, RACI por gate, plano de comunicação | A |
| 2 · Discovery | [02-discovery](02-discovery/) | [Event Storming](02-discovery/event-storming.md) — Big Picture, 7 fluxos de processo, bounded contexts, context map, hotspots | A |
| | | [Glossário](02-discovery/glossario.md) — linguagem ubíqua (~70 termos, nome no código) | A |
| | | [Personas e jornadas](02-discovery/personas-jornadas.md) — 4 personas, JTBD, 4 jornadas | A |
| 3 · Requisitos | [03-requisitos](03-requisitos/) | [Validação do PRD](03-requisitos/validacao-prd.md) — 22 achados e correções (v2.0 → v2.1) | A |
| | | [ERS (IEEE 830)](03-requisitos/ers.md) — 95 RF · 34 RN · 22 RNF | A |
| | | [Histórias de usuário](03-requisitos/historias-usuario.md) — 74 US INVEST + Gherkin, 322 pontos (estimativa inicial) | A |
| | | [Matriz de rastreabilidade](03-requisitos/matriz-rastreabilidade.md) — PRD → ERS → US → sprint → ADR → teste | A |
| 4–5 · Modelagem e UX | [04-design](04-design/) | [Arquitetura de informação e fluxos](04-design/arquitetura-informacao-fluxos.md) — sitemap, 25 telas, 12 fluxos | A |
| | | [Especificação de telas](04-design/especificacao-telas.md) — estados, microcopy, wireframes | A |
| | | [Acessibilidade](04-design/acessibilidade.md) — plano WCAG 2.1 AA para canvas WebGL | A / E |
| | | [Plano de pesquisa com usuários](04-design/plano-pesquisa-usuario.md) — teste de usabilidade do protótipo | A |
| | | [Style guide](style-guide.md) *(anterior; ver aviso no topo)* | — |
| 6 · Arquitetura | [05-arquitetura](05-arquitetura/) | [C4 + cenários de qualidade](05-arquitetura/c4.md) | A |
| | | [ADRs 0001–0012](05-arquitetura/adr/README.md) — todos com status *Proposto* | A |
| | | [Modelo de dados](05-arquitetura/modelo-dados.md) — ERD + DDL PostgreSQL 16 | B |
| | | [Máquinas de estado](05-arquitetura/maquina-estados.md) — bolha, cota, pagamento, lance, triagem, contestação, moderação | B |
| | | [Eventos de domínio](05-arquitetura/eventos-dominio.md) — catálogo, outbox, filas BullMQ, reconciliador | B |
| | | [API REST](05-arquitetura/api-rest.md) · [API WebSocket](05-arquitetura/api-websocket.md) | B |
| 7 · Planejamento | (raiz) | [Plano de projeto](planing-project.md) — S0–S8, gates A–E, riscos R1–R10, D1–D8 | todos |
| 8 · Desenvolvimento | [06-engenharia](06-engenharia/) | [Guia de desenvolvimento](06-engenharia/guia-desenvolvimento.md) — monorepo, setup, convenções, exemplo `AcquireQuota` | B |
| | | [Pipeline CI/CD](06-engenharia/pipeline-ci-cd.md) | B |
| | (raiz) | [Governança](governance.md) — Gitflow, Conventional Commits, logs | — |
| 9 · QA | [07-qualidade](07-qualidade/) | [Estratégia de testes](07-qualidade/estrategia-testes.md) — CT-001…CT-074 | C / D |
| | | [Plano de teste de carga](07-qualidade/plano-teste-carga.md) — k6, metas do PRD §10 | E |
| Transversal | [08-seguranca-compliance](08-seguranca-compliance/) | [Threat model](08-seguranca-compliance/threat-model.md) — STRIDE, TM-01…19, backlog SEC | E |
| | | [LGPD / RIPD](08-seguranca-compliance/lgpd-ripd.md) — ROPA, riscos ao titular, incidente (ANPD em 3 dias úteis) | A / E |
| | | [Matriz de cláusulas dos termos](08-seguranca-compliance/matriz-clausulas-termos.md) — **rascunho técnico para advogado** | E |
| 10–12 · Operação | [09-operacao](09-operacao/) | [SLOs e observabilidade](09-operacao/slo-observabilidade.md) — SLO-01…08, alertas AL-01…26 | E |
| | | [Plano de release](09-operacao/plano-release.md) — beta fechado → público, kill switches | E |
| | | [Runbooks](09-operacao/runbooks.md) — RB-01…12 | E |
| | | [Resposta a incidentes](09-operacao/resposta-incidentes.md) — S1–S4, postmortem | E |

**Fase 1 (Pré-venda/Comercial) não se aplica:** é um produto próprio, sem cliente contratante. Proposta, SOW e NDA foram substituídos pelo business case.

### Documentos anteriores (mantidos para histórico)
[mvp.md](mvp.md), [requirements.md](requirements.md), [arquitetura.md](arquitetura.md), [tecnologias.md](tecnologias.md), [estrutura-projeto.md](estrutura-projeto.md), [judicial-viability.md](judicial-viability.md) e os diagramas em [003 diagrams](../003%20diagrams/). Cada um tem um aviso no topo dizendo o que está desatualizado e qual documento o substitui.

---

## Decisões e pendências para o Gate A

| # | Pendência | Onde está | Quem decide |
| :--- | :--- | :--- | :--- |
| 1 | Aprovar os ADRs 0001–0012 (D1–D8 do plano) | [adr/](05-arquitetura/adr/README.md) | PO + Tech Lead |
| 2 | Validade real da pré-autorização no Pagar.me (define as durações de 5/4 dias) e mecanismo de assinatura do webhook | Spec Q1, ADR-0003 | Tech Lead (spike na S0) |
| 3 | ⚖️ Responsabilidade da plataforma (CDC × Marco Civil art. 19); CDC em B2B; arrependimento em C2C/B2B; frete da devolução | Validação §3, Spec Q7–Q8 | Jurídico |
| 4 | ⚖️ Score sem 2ª instância × LGPD art. 20 (revisão de decisão automatizada) | LGPD/RIPD | Jurídico + DPO |
| 5 | Taxa de 6% sobre o GMV concluído; tarifa de Pix/gateway em bolhas que falham; nota fiscal | Spec Q5, Q9, Q10; business case | PO + Financeiro |
| 6 | PF vendedora (C2C) no R1; categorias proibidas; frete incluso | Spec Q2, Q3, Q6 | PO |
| 7 | Designar DPO e moderador; definir a vertical inicial e o orçamento | Business case, RACI | Patrocinador |
| 8 | Explosão ≤ 2 s com queda de worker exige BullMQ agressivo (lock de 1 s) — validar no teste de carga | ADR-0011, plano de carga | Tech Lead (S7) |
| 9 | Escolha da plataforma de contêiner (Railway × Cloud Run) | Fatos de stack, pipeline | Tech Lead (S1) |
