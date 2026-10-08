# ADR-0001 — Monólito modular em NestJS, sem microsserviços no R1

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 §5.1](../../../PRD.MD) · [C4](../c4.md) · ADRs relacionados: ADR-0010, ADR-0011
**Decisores:** Tech Lead, PO · **Revisar em:** Gate E, ou quando um módulo exigir escala ou ciclo de deploy próprio

## Contexto

- O PRD v2.0 desenhava "serviços" (Auth & User, Bubble Core Engine, Triage & Score) atrás de um API Gateway. `tecnologias.md` falava em "micro-serviços". O PRD v2.1 já adota o monólito modular como proposta.
- Time do R1: 1 tech lead, 1 backend pleno, 25% de DevOps ([plano §2](../../planing-project.md)); go-live em 01/03/2027.
- As regras críticas exigem **atomicidade local**: a última cota e a explosão na mesma transação (ADR-0002, ADR-0009); outbox na mesma transação (ADR-0010). Em microsserviços, isso viraria saga, com consistência eventual entre "Bubble" e "Payment" no caminho quente.
- Há trabalho assíncrono pesado (timers, capturas em lote, e-mails) que não pode degradar a latência do `POST /quotas` (p99 < 200 ms no broadcast).

## Decisão

1. Um **único repositório e código** NestJS (Node.js 24 LTS) com módulos por bounded context: `identity`, `bubble`, `bidding`, `payment`, `triage`, `reputation`, `moderation`, `notification`, `realtime`, `platform`.
2. **Dois processos (contêineres) com a mesma imagem:** `api` (HTTP + Socket.io) e `worker` (BullMQ, relay do outbox, reconciliador). Mínimo de 2 réplicas de cada em produção.
3. **Um banco PostgreSQL** com propriedade de tabelas por módulo. Nenhum módulo lê ou escreve tabelas de outro, salvo pela fachada pública do dono. As exceções transacionais estão documentadas em [c4.md §4.3](../c4.md#43-regras-de-dependência-entre-módulos-verificadas-em-ci) (transação de cota; seleção de lance).
4. Camadas hexagonais por módulo (`interfaces → application → domain`, `infrastructure` implementa portas). Domínio puro em `packages/core-domain`.
5. Regras de fronteira verificadas na CI (`dependency-cruiser`/`eslint-plugin-boundaries`).

## Alternativas consideradas

| Critério | **A. Monólito modular (escolhida)** | B. Microsserviços (desenho do PRD v2.0) | C. Monólito sem fronteiras (camadas técnicas) |
| :--- | :---: | :---: | :---: |
| Custo (dev + operação) | ●●● 1 pipeline, 1 imagem, 1 banco | ● N pipelines, rede, service discovery, tracing distribuído obrigatório | ●●● o mais barato no início |
| Reversibilidade | ●●● extrair um módulo depois é viável (fronteiras + eventos já existem) | ● juntar serviços depois é caro | ● vira "big ball of mud"; separar depois é caro |
| Complexidade | ●● disciplina de fronteiras | ● sagas, consistência eventual, contratos versionados entre serviços | ●●● baixa no início, alta depois |
| Risco | ●●● atomicidade local nas regras críticas | ● overbooking e estorno dependem de saga correta; prazo do R1 | ●● risco de acoplamento crescer sem controle |

B descartada: o custo de consistência distribuída cairia justamente no caminho mais crítico (cota → explosão → captura) e o time não comporta a operação. C descartada: sem fronteiras, perde-se a opção de extrair módulos e a testabilidade do domínio.

## Consequências

**Positivas (+)**
- Transações locais para as invariantes críticas; menos peças móveis no R1.
- O `worker` isola a carga assíncrona e escala separadamente, sem contrato remoto.
- Os eventos de domínio (outbox) já desenham as costuras de uma futura extração.

**Negativas (−)**
- Um banco compartilhado é ponto único de escala e de falha → Postgres gerenciado com HA, réplicas de leitura se necessário, índices nos caminhos quentes.
- Deploy acoplado: uma mudança em `notification` reimplanta tudo → testes de regressão e deploy contínuo com rollback rápido.
- Risco de erosão das fronteiras → regras de dependência na CI e revisão de PR.

## Verificação

- CI falha se um módulo importar `infrastructure` ou o repositório de outro módulo.
- Teste de carga (S7): `worker` saturado (10 mil jobs) não aumenta o p99 do `POST /quotas` em mais de 10%.

## Fontes

- Projeto: PRD v2.1 §5; plano v2 §2 e §6; [c4.md](../c4.md).
- **arquitetura-ddd** — *DDD by Examples: Library*: um pacote por bounded context (monólito modular), "sem obstáculos" para depois mover para módulos ou microsserviços; arquitetura local por complexidade do contexto; começar com consistência imediata.
- **asias-arquitetura-hexagonal** — *Skill* (Cockburn; R. C. Martin): regra de dependência e adapters substituíveis.
