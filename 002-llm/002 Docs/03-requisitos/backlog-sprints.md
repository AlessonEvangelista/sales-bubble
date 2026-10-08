# Backlog por Sprint e Correlação com as Specs — Bolha Venda R1

**Versão:** 1.0 · **Data:** 07/10/2026 · **Status:** Gerado a partir do [plano v3.0](../planing-project.md)
**Base:** [Histórias](historias-usuario.md) · [Matriz de rastreabilidade](matriz-rastreabilidade.md) · [ERS](ers.md) · [Spec](../../SPEC.md) · [Estratégia de testes](../07-qualidade/estrategia-testes.md) · [Threat model](../08-seguranca-compliance/threat-model.md)

> Fonte única do cadastro no Jira `BV`. Cada item tem a label `id-<ID>` (ex.: `id-US-021`), além de `sprint-sN`, `epic-eN`, `spec-Fn` e `adr-nnnn`, para filtrar no Jira por sprint, épico ou funcionalidade da Spec. A coluna **Jira** é preenchida quando o cadastro é executado.

## Resumo

| Sprint | Período | Meta | Histórias | Tarefas | Pontos |
| :--- | :--- | :--- | ---: | ---: | ---: |
| **S0** | 12/10 – 23/10/2026 | Decisões tomadas e protótipo validado (Gate A) | 0 | 15 | 0 |
| **S1** | 26/10 – 06/11/2026 | Walking skeleton em staging com cadastro e login PF | 4 | 17 | 16 |
| **S2** | 09/11 – 20/11/2026 | Canvas navegável com bolhas reais; PJ verificada (Gate B) | 9 | 3 | 44 |
| **S3** | 23/11 – 04/12/2026 | Criar bolha e comprar cota sem overbooking | 10 | 2 | 49 |
| **S4** | 07/12 – 18/12/2026 | Bolha explode sozinha e todos veem em tempo real (Gate C) | 10 | 3 | 40 |
| **S5** | 04/01 – 15/01/2027 | Dinheiro reservado, capturado e devolvido corretamente (sandbox) | 10 | 5 | 49 |
| **S6** | 18/01 – 29/01/2027 | Empresas disputam bolhas de compra; triagem funcional | 9 | 4 | 32 |
| **S7** | 01/02 – 12/02/2027 | Score, contestação, moderação e feature complete (Gate D) | 11 | 8 | 50 |
| **S8** | 15/02 – 26/02/2027 | Hardening e beta fechado (Gate E — go-live 01/03/2027) | 11 | 12 | 42 |
| **Total** | | 10 épicos | **74** | **69** | **322** |

## Épicos

| Épico | Jira | Tema | Sprints |
| :--- | :--- | :--- | :--- |
| E0 | [BV-1](https://alessonevangelista.atlassian.net/browse/BV-1) | Discovery & Arquitetura | S0 |
| E1 | [BV-2](https://alessonevangelista.atlassian.net/browse/BV-2) | Fundações | S1–S2 |
| E2 | [BV-3](https://alessonevangelista.atlassian.net/browse/BV-3) | Identidade e perfil | S1–S2 |
| E3 | [BV-4](https://alessonevangelista.atlassian.net/browse/BV-4) | Canvas interativo | S2–S4 |
| E4 | [BV-5](https://alessonevangelista.atlassian.net/browse/BV-5) | Motor de bolhas e cotas | S3 |
| E5 | [BV-6](https://alessonevangelista.atlassian.net/browse/BV-6) | Tempo real, timers, explosão e notificações | S4 |
| E6 | [BV-7](https://alessonevangelista.atlassian.net/browse/BV-7) | Pagamento e estorno | S5 |
| E7 | [BV-8](https://alessonevangelista.atlassian.net/browse/BV-8) | Lances comerciais C2B/B2B | S5–S6 |
| E8 | [BV-9](https://alessonevangelista.atlassian.net/browse/BV-9) | Triagem, score e contestação | S6–S7 |
| E9 | [BV-10](https://alessonevangelista.atlassian.net/browse/BV-10) | Qualidade, segurança, moderação, LGPD e go-live | S6–S8 |

## Backlog por sprint

### S0 — Decisões tomadas e protótipo validado (Gate A)

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| EN-001 | [BV-85](https://alessonevangelista.atlassian.net/browse/BV-85) | Tarefa | Configurar o Jira BV (workflow, componentes, labels, versão R1.0) | E0 |  |  |  |
| EN-002 | [BV-86](https://alessonevangelista.atlassian.net/browse/BV-86) | Tarefa | Configurar o GitHub (develop/main, proteção, CODEOWNERS, templates) | E0 |  |  |  |
| EN-003 | [BV-88](https://alessonevangelista.atlassian.net/browse/BV-88) | Tarefa | Abrir conta e iniciar homologação no Pagar.me | E0 |  | F5 | 0003 |
| EN-004 | [BV-89](https://alessonevangelista.atlassian.net/browse/BV-89) | Tarefa | Fechar protótipo navegável (prototipacao-gemini) das trilhas PF, PJ e Organizadora | E0 |  | F2, F3, F5, F9, F10 |  |
| EN-005 | [BV-90](https://alessonevangelista.atlassian.net/browse/BV-90) | Tarefa | Teste de usabilidade: 15 + 2 sessões | E0 |  | F2, F5, F9 |  |
| EN-006 | [BV-91](https://alessonevangelista.atlassian.net/browse/BV-91) | Tarefa | Revisar e aprovar ADRs 0001–0012 | E0 |  |  | 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012 |
| EN-007 | [BV-92](https://alessonevangelista.atlassian.net/browse/BV-92) | Tarefa | Parecer jurídico sobre itens ⚖️ | E0 |  | F9, F10, F12 |  |
| EN-008 | [BV-93](https://alessonevangelista.atlassian.net/browse/BV-93) | Tarefa | RIPD inicial revisado e DPO designado | E0 |  | F1 | 0012 |
| EN-009 | [BV-94](https://alessonevangelista.atlassian.net/browse/BV-94) | Tarefa | Decisões de produto Q2, Q3, Q5, Q6, Q9, Q10 | E0 |  | F3, F6, F9 |  |
| EN-010 | [BV-95](https://alessonevangelista.atlassian.net/browse/BV-95) | Tarefa | Nomear patrocinador, vertical inicial e orçamento | E0 |  |  |  |
| EN-011 | [BV-96](https://alessonevangelista.atlassian.net/browse/BV-96) | Tarefa | Recrutar 5 PJs parceiras para o beta | E0 |  | F4, F8 |  |
| EN-012 | [BV-97](https://alessonevangelista.atlassian.net/browse/BV-97) | Tarefa | Definir e adquirir os 2 dispositivos de referência | E0 |  | F2, NF |  |
| EN-013 | [BV-98](https://alessonevangelista.atlassian.net/browse/BV-98) | Tarefa | Corrigir divergências documentais e aplicar rebalanceamento de sprints | E0 |  | F6, F10 |  |
| EN-014 | [BV-99](https://alessonevangelista.atlassian.net/browse/BV-99) | Tarefa | Refinamento e planning poker das 74 histórias | E0 |  |  |  |
| SPK-01 | [BV-87](https://alessonevangelista.atlassian.net/browse/BV-87) | Spike | Spike Pagar.me: pré-autorização, Pix, webhook e split | E0 |  | F5, F6, F7 | 0003 |

### S1 — Walking skeleton em staging com cadastro e login PF

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| EN-020 | [BV-100](https://alessonevangelista.atlassian.net/browse/BV-100) | Tarefa | Monorepo Turborepo (apps web/api/worker + packages) | E1 |  |  | 0001 |
| EN-021 | [BV-101](https://alessonevangelista.atlassian.net/browse/BV-101) | Tarefa | Regras de fronteira entre pacotes (boundaries/dependency-cruiser) | E1 |  |  | 0001 |
| EN-022 | [BV-102](https://alessonevangelista.atlassian.net/browse/BV-102) | Tarefa | docker-compose (Postgres 16, Redis 7), .env.example, seeds e comandos | E1 |  |  |  |
| EN-023 | [BV-103](https://alessonevangelista.atlassian.net/browse/BV-103) | Tarefa | CI ci.yml com todos os gates obrigatórios | E1 |  |  |  |
| EN-024 | [BV-104](https://alessonevangelista.atlassian.net/browse/BV-104) | Tarefa | Escolher plataforma de contêiner e provisionar staging (OIDC) | E1 |  |  |  |
| EN-025 | [BV-105](https://alessonevangelista.atlassian.net/browse/BV-105) | Tarefa | CD de staging (GHCR, Trivy, migration job, api/worker, Vercel) | E1 |  |  |  |
| EN-026 | [BV-106](https://alessonevangelista.atlassian.net/browse/BV-106) | Tarefa | release-please e esqueleto de deploy-production com aprovação manual | E1 |  |  |  |
| EN-027 | [BV-107](https://alessonevangelista.atlassian.net/browse/BV-107) | Tarefa | Schema Prisma inicial + migrations (identity, bubble, quota, outbox) | E1 |  | F1, F3, F5 | 0002, 0010 |
| EN-028 | [BV-108](https://alessonevangelista.atlassian.net/browse/BV-108) | Tarefa | Observabilidade base: OTel, logs estruturados, Sentry, redaction de PII | E1 |  | NF | 0012 |
| EN-029 | [BV-109](https://alessonevangelista.atlassian.net/browse/BV-109) | Tarefa | Criptografia de PII: AES-256-GCM + HMAC de busca, chave no KMS | E1 |  | F1 | 0012 |
| EN-030 | [BV-110](https://alessonevangelista.atlassian.net/browse/BV-110) | Tarefa | Gestão de segredos + gitleaks + OIDC no CI | E1 |  |  |  |
| EN-031 | [BV-111](https://alessonevangelista.atlassian.net/browse/BV-111) | Tarefa | Pacote contracts: DTOs Zod, OpenAPI, erros RFC 9457, eventos WS/domínio | E1 |  | F1, F2, F5 |  |
| EN-032 | [BV-112](https://alessonevangelista.atlassian.net/browse/BV-112) | Tarefa | Portas do core-domain (Clock, UnitOfWork, PaymentPort, CnpjPort, Notifier) + fakes | E1 |  |  | 0001, 0003, 0008 |
| EN-033 | [BV-113](https://alessonevangelista.atlassian.net/browse/BV-113) | Tarefa | Infraestrutura de feature flags e kill switches | E1 |  | NF |  |
| US-001 | [BV-11](https://alessonevangelista.atlassian.net/browse/BV-11) | História | Cadastro de pessoa física | E2 | 5 | F1 | 0012 |
| US-004 | [BV-14](https://alessonevangelista.atlassian.net/browse/BV-14) | História | Login por e-mail e senha | E2 | 5 | F1, NF | 0012 |
| US-005 | [BV-15](https://alessonevangelista.atlassian.net/browse/BV-15) | História | Sessão segura | E2 | 3 | F1 |  |
| US-008 | [BV-18](https://alessonevangelista.atlassian.net/browse/BV-18) | História | Permissões por perfil | E2 | 3 | F1, F2 |  |
| SEC-06 | [BV-139](https://alessonevangelista.atlassian.net/browse/BV-139) | Segurança | Auth: Argon2id, throttling, refresh rotativo com detecção de reuso, cookie seguro | E2 |  | F1 |  |
| SEC-08 | [BV-141](https://alessonevangelista.atlassian.net/browse/BV-141) | Segurança | Respostas anti-enumeração em cadastro e recuperação de senha | E2 |  | F1 |  |
| SEC-22 | [BV-153](https://alessonevangelista.atlassian.net/browse/BV-153) | Segurança | Verificar no pentest e no CI que o cadastro e a recuperação de senha respondem de forma genérica (correção já pedida no contrato da API) | E2 |  | F1 |  |

### S2 — Canvas navegável com bolhas reais; PJ verificada (Gate B)

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| EN-034 | [BV-114](https://alessonevangelista.atlassian.net/browse/BV-114) | Tarefa | Design system: tokens e componentes base em ui-components | E1 |  | F2 |  |
| EN-035 | [BV-115](https://alessonevangelista.atlassian.net/browse/BV-115) | Tarefa | Headers de segurança (CSP, HSTS…) e upload seguro de imagem | E1 |  | F3 |  |
| EN-036 | [BV-116](https://alessonevangelista.atlassian.net/browse/BV-116) | Tarefa | Workflow perf.yml: benchmark do canvas com 500 bolhas | E1 |  | F2, NF |  |
| US-002 | [BV-12](https://alessonevangelista.atlassian.net/browse/BV-12) | História | Cadastro de pessoa jurídica com CNPJ verificado | E2 | 8 | F1 | 0008, 0012 |
| US-003 | [BV-13](https://alessonevangelista.atlassian.net/browse/BV-13) | História | Revalidação de CNPJ | E2 | 3 | F1 | 0008 |
| US-006 | [BV-16](https://alessonevangelista.atlassian.net/browse/BV-16) | História | Entrar com Google | E2 | 5 | F1 |  |
| US-007 | [BV-17](https://alessonevangelista.atlassian.net/browse/BV-17) | História | Recuperar senha | E2 | 3 | F1 |  |
| US-009 | [BV-19](https://alessonevangelista.atlassian.net/browse/BV-19) | História | Aceitar nova versão dos termos | E2 | 2 | F1 |  |
| US-010 | [BV-20](https://alessonevangelista.atlassian.net/browse/BV-20) | História | Navegar com pan e zoom | E3 | 5 | F2 |  |
| US-011 | [BV-21](https://alessonevangelista.atlassian.net/browse/BV-21) | História | Ver as bolhas da região | E3 | 8 | F2 | 0010 |
| US-015 | [BV-25](https://alessonevangelista.atlassian.net/browse/BV-25) | História | Explorar sem login | E3 | 2 | F2 |  |
| US-016 | [BV-26](https://alessonevangelista.atlassian.net/browse/BV-26) | História | Canvas fluido com 500 bolhas | E3 | 8 | NF |  |

### S3 — Criar bolha e comprar cota sem overbooking

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| US-012 | [BV-22](https://alessonevangelista.atlassian.net/browse/BV-22) | História | Entender uma bolha num relance | E3 | 5 | F2, F6, NF | 0004, 0009 |
| US-013 | [BV-23](https://alessonevangelista.atlassian.net/browse/BV-23) | História | Ver o detalhe da bolha sem expor participantes | E3 | 5 | F1, F2, F5 | 0004, 0005, 0012 |
| US-017 | [BV-27](https://alessonevangelista.atlassian.net/browse/BV-27) | História | Criar bolha de venda com degraus | E4 | 8 | F3 | 0004, 0006, 0009 |
| US-018 | [BV-28](https://alessonevangelista.atlassian.net/browse/BV-28) | História | Criar bolha de compra | E4 | 5 | F3, F4, F11 | 0004, 0005, 0006 |
| US-019 | [BV-29](https://alessonevangelista.atlassian.net/browse/BV-29) | História | Publicar bolha | E4 | 5 | F3, F4 | 0009, 0011 |
| US-020 | [BV-30](https://alessonevangelista.atlassian.net/browse/BV-30) | História | Cancelar bolha sem adesões | E4 | 2 | F3 | 0009 |
| US-021 | [BV-31](https://alessonevangelista.atlassian.net/browse/BV-31) | História | PF entra com 1 cota, sem overbooking | E4 | 8 | F4, F5, NF | 0002, 0003, 0004 |
| US-022 | [BV-32](https://alessonevangelista.atlassian.net/browse/BV-32) | História | PJ compra várias cotas dentro do teto | E4 | 5 | F5, F7 | 0002, 0006, 0009 |
| US-023 | [BV-33](https://alessonevangelista.atlassian.net/browse/BV-33) | História | Ver o preço cair a cada cota | E4 | 3 | F6 | 0004 |
| US-024 | [BV-34](https://alessonevangelista.atlassian.net/browse/BV-34) | História | Sair da bolha | E4 | 3 | F5 | 0002, 0003 |
| EN-040 | [BV-117](https://alessonevangelista.atlassian.net/browse/BV-117) | Tarefa | Teste de concorrência da última cota no CI (100 requisições → 1 sucesso) | E4 |  | F5 | 0002 |
| SEC-03 | [BV-138](https://alessonevangelista.atlassian.net/browse/BV-138) | Segurança | Idempotency-Key com escopo e hash do corpo | E4 |  | F5 |  |

### S4 — Bolha explode sozinha e todos veem em tempo real (Gate C)

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| US-014 | [BV-24](https://alessonevangelista.atlassian.net/browse/BV-24) | História | Lista acessível e filtros | E3 | 5 | F2, NF |  |
| US-025 | [BV-35](https://alessonevangelista.atlassian.net/browse/BV-35) | História | Ver o canvas mudar em tempo real | E5 | 8 | F2, F7, NF | 0010 |
| US-026 | [BV-36](https://alessonevangelista.atlassian.net/browse/BV-36) | História | Bolha explode no horário | E5 | 5 | F5, F7, NF | 0002, 0009, 0011 |
| US-027 | [BV-37](https://alessonevangelista.atlassian.net/browse/BV-37) | História | Bolha explode ao lotar | E5 | 3 | F7 | 0002, 0009 |
| US-028 | [BV-38](https://alessonevangelista.atlassian.net/browse/BV-38) | História | Reconciliador recupera timers perdidos | E5 | 5 | F7, NF | 0011 |
| US-029 | [BV-39](https://alessonevangelista.atlassian.net/browse/BV-39) | História | Bolha que falha é cancelada | E5 | 2 | F7 | 0009 |
| US-030 | [BV-40](https://alessonevangelista.atlassian.net/browse/BV-40) | História | Bolha de sucesso segue para a triagem | E5 | 2 | F7, F8 | 0009 |
| US-031 | [BV-41](https://alessonevangelista.atlassian.net/browse/BV-41) | História | Ser avisado do que importa | E5 | 5 | F11 | 0010 |
| US-032 | [BV-42](https://alessonevangelista.atlassian.net/browse/BV-42) | História | Avisos de prazo | E5 | 3 | F2, F7, F11 | 0009, 0011 |
| US-033 | [BV-43](https://alessonevangelista.atlassian.net/browse/BV-43) | História | Desligar e-mails não essenciais | E5 | 2 | F11 |  |
| EN-041 | [BV-118](https://alessonevangelista.atlassian.net/browse/BV-118) | Tarefa | Redis com AOF e ≥ 2 réplicas de worker em staging | E5 |  | F7 | 0011 |
| EN-042 | [BV-119](https://alessonevangelista.atlassian.net/browse/BV-119) | Tarefa | Contratar provedor de e-mail transacional e configurar SPF/DKIM | E5 |  | F11 |  |
| SEC-07 | [BV-140](https://alessonevangelista.atlassian.net/browse/BV-140) | Segurança | Rate limit (API e WS) + limites de conexão e inscrição WS | E5 |  | F2, F5 |  |

### S5 — Dinheiro reservado, capturado e devolvido corretamente (sandbox)

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| US-034 | [BV-44](https://alessonevangelista.atlassian.net/browse/BV-44) | História | Entrar pagando com cartão | E6 | 8 | F5 | 0003, 0005 |
| US-035 | [BV-45](https://alessonevangelista.atlassian.net/browse/BV-45) | História | Entrar pagando com Pix | E6 | 8 | F5 | 0002, 0003 |
| US-036 | [BV-46](https://alessonevangelista.atlassian.net/browse/BV-46) | História | Pagar só o preço final | E6 | 5 | F6, F7 | 0003, 0004 |
| US-037 | [BV-47](https://alessonevangelista.atlassian.net/browse/BV-47) | História | Receber 100% de volta quando não dá negócio | E6 | 5 | F7, F9 | 0003, 0009 |
| US-038 | [BV-48](https://alessonevangelista.atlassian.net/browse/BV-48) | História | Webhooks confiáveis | E6 | 5 | F5, F7, NF | 0003 |
| US-039 | [BV-49](https://alessonevangelista.atlassian.net/browse/BV-49) | História | Conciliação diária | E6 | 3 | F5, F7 | 0003 |
| US-040 | [BV-50](https://alessonevangelista.atlassian.net/browse/BV-50) | História | Cadastrar conta de recebimento | E6 | 3 | F5, F7 | 0003 |
| US-041 | [BV-51](https://alessonevangelista.atlassian.net/browse/BV-51) | História | Receber o repasse | E6 | 5 | F6, F9 | 0003 |
| US-042 | [BV-52](https://alessonevangelista.atlassian.net/browse/BV-52) | História | Ver meu histórico financeiro | E6 | 2 | F5, F7 |  |
| EN-043 | [BV-120](https://alessonevangelista.atlassian.net/browse/BV-120) | Tarefa | Adaptador Pagar.me real atrás do PaymentPort | E6 |  | F5, F6, F7, F8 | 0003 |
| EN-044 | [BV-121](https://alessonevangelista.atlassian.net/browse/BV-121) | Tarefa | Contratar empresa de pentest | E6 |  |  |  |
| SEC-01 | [BV-136](https://alessonevangelista.atlassian.net/browse/BV-136) | Segurança | Verificação do webhook + reconsulta ao gateway + webhook_events único | E6 |  | F5, F7 |  |
| SEC-19 | [BV-150](https://alessonevangelista.atlassian.net/browse/BV-150) | Segurança | Anti-abuso Pix: máx. 3 reservas abertas por conta; 3 expiradas em 24 h → Pix bloqueado 24 h; rate limit de cobranças; Pix desligado nos últimos 5 min | E6 |  | F5 |  |
| US-043 | [BV-53](https://alessonevangelista.atlassian.net/browse/BV-53) | História | Enviar lance | E7 | 5 | F8 | 0005 |
| SEC-12 | [BV-143](https://alessonevangelista.atlassian.net/browse/BV-143) | Segurança | Decisão anti-sniping de lances (ADR-0005) | E7 |  | F8 |  |

### S6 — Empresas disputam bolhas de compra; triagem funcional

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| US-044 | [BV-54](https://alessonevangelista.atlassian.net/browse/BV-54) | História | Ajustar ou retirar meu lance | E7 | 2 | F8 | 0005 |
| US-045 | [BV-55](https://alessonevangelista.atlassian.net/browse/BV-55) | História | Comparar lances sem expor as empresas | E7 | 3 | F8 | 0005 |
| US-046 | [BV-56](https://alessonevangelista.atlassian.net/browse/BV-56) | História | Escolher o lance vencedor | E7 | 5 | F8, F11 | 0003, 0005 |
| US-047 | [BV-57](https://alessonevangelista.atlassian.net/browse/BV-57) | História | Seleção automática | E7 | 3 | F8 | 0005, 0011 |
| SEC-14 | [BV-145](https://alessonevangelista.atlassian.net/browse/BV-145) | Segurança | Limite de lances ativos e score mínimo para dar lance | E7 |  | F8 |  |
| US-048 | [BV-58](https://alessonevangelista.atlassian.net/browse/BV-58) | História | Acompanhar a triagem | E8 | 5 | F1, F9 | 0009, 0012 |
| US-049 | [BV-59](https://alessonevangelista.atlassian.net/browse/BV-59) | História | Registrar o envio | E8 | 3 | F9 | 0007 |
| US-050 | [BV-60](https://alessonevangelista.atlassian.net/browse/BV-60) | História | Envio atrasado e cancelamento | E8 | 5 | F9, F10 | 0007, 0011 |
| US-051 | [BV-61](https://alessonevangelista.atlassian.net/browse/BV-61) | História | Confirmar o recebimento | E8 | 3 | F9 | 0011 |
| SEC-02 | [BV-137](https://alessonevangelista.atlassian.net/browse/BV-137) | Segurança | Middleware de autorização por objeto + matriz automatizada (triagem, lances, contestação) | E8 |  | F8, F9, F10 |  |
| SEC-21 | [BV-152](https://alessonevangelista.atlassian.net/browse/BV-152) | Segurança | Casos de triagem: limite por conta, evidência obrigatória, evento de score por abuso | E8 |  | F9 |  |
| US-063 | [BV-73](https://alessonevangelista.atlassian.net/browse/BV-73) | História | Trilha de auditoria | E9 | 3 | F12, NF | 0012 |
| SEC-17 | [BV-148](https://alessonevangelista.atlassian.net/browse/BV-148) | Segurança | audit_log append-only (sem UPDATE/DELETE, hash encadeado, exportação WORM) + motivo obrigatório em toda ação de moderação | E9 |  | F12 |  |

### S7 — Score, contestação, moderação e feature complete (Gate D)

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| US-052 | [BV-62](https://alessonevangelista.atlassian.net/browse/BV-62) | História | Desistir da compra (arrependimento) | E8 | 5 | F9 | 0003 |
| US-053 | [BV-63](https://alessonevangelista.atlassian.net/browse/BV-63) | História | Abrir um caso de problema | E8 | 5 | F9, F10, F12 | 0007 |
| US-054 | [BV-64](https://alessonevangelista.atlassian.net/browse/BV-64) | História | Encerrar a triagem da bolha | E8 | 2 | F9 | 0009 |
| US-055 | [BV-65](https://alessonevangelista.atlassian.net/browse/BV-65) | História | Score calculado por eventos objetivos | E8 | 8 | F10 | 0007 |
| US-056 | [BV-66](https://alessonevangelista.atlassian.net/browse/BV-66) | História | Entender meu score | E8 | 3 | F10 | 0007 |
| US-057 | [BV-67](https://alessonevangelista.atlassian.net/browse/BV-67) | História | Contestar um evento de score | E8 | 5 | F10 | 0007 |
| US-058 | [BV-68](https://alessonevangelista.atlassian.net/browse/BV-68) | História | Julgar contestação | E8 | 3 | F10, F12 | 0007 |
| SEC-13 | [BV-144](https://alessonevangelista.atlassian.net/browse/BV-144) | Segurança | Regras anticonluio do score (contrapartes distintas, teto por par, vínculo) | E8 |  | F10 |  |
| US-059 | [BV-69](https://alessonevangelista.atlassian.net/browse/BV-69) | História | Suspender bolha irregular | E9 | 3 | F12 | 0009 |
| US-060 | [BV-70](https://alessonevangelista.atlassian.net/browse/BV-70) | História | Suspender conta | E9 | 5 | F12 | 0009 |
| US-069 | [BV-79](https://alessonevangelista.atlassian.net/browse/BV-79) | História | Provar carga e concorrência | E9 | 8 | NF |  |
| US-073 | [BV-83](https://alessonevangelista.atlassian.net/browse/BV-83) | História | Observabilidade e alertas | E9 | 3 | NF |  |
| EN-050 | [BV-122](https://alessonevangelista.atlassian.net/browse/BV-122) | Tarefa | Provisionar produção (instâncias, pool, Redis, PITR, KMS) | E9 |  | NF |  |
| EN-051 | [BV-123](https://alessonevangelista.atlassian.net/browse/BV-123) | Tarefa | Runbooks RB-01…RB-12 + game day (RB-02, 03, 09, 11) | E9 |  | F7, NF |  |
| EN-052 | [BV-124](https://alessonevangelista.atlassian.net/browse/BV-124) | Tarefa | SLOs, alertas AL-01…26 e dashboards D1–D10 | E9 |  | NF |  |
| EN-057 | [BV-129](https://alessonevangelista.atlassian.net/browse/BV-129) | Tarefa | Publicar termos de uso e política de privacidade validados | E9 |  | F1, F12 |  |
| SEC-11 | [BV-142](https://alessonevangelista.atlassian.net/browse/BV-142) | Segurança | CAPTCHA adaptativo e sinais de risco na aquisição de cota | E9 |  | F5 |  |
| SEC-18 | [BV-149](https://alessonevangelista.atlassian.net/browse/BV-149) | Segurança | MFA para moderador, segregação (sem casos próprios ou ligados), dupla aprovação para ações de alto impacto | E9 |  | F12 |  |
| SEC-20 | [BV-151](https://alessonevangelista.atlassian.net/browse/BV-151) | Segurança | Denúncia: dedupe, rate limit, sem suspensão automática, peso por reputação do denunciante | E9 |  | F12 |  |

### S8 — Hardening e beta fechado (Gate E — go-live 01/03/2027)

| ID | Jira | Tipo | Item | Épico | Pts | Spec | ADR |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| US-061 | [BV-71](https://alessonevangelista.atlassian.net/browse/BV-71) | História | Denunciar bolha | E9 | 3 | F12 |  |
| US-062 | [BV-72](https://alessonevangelista.atlassian.net/browse/BV-72) | História | Painel operacional | E9 | 5 | F12, NF | 0011 |
| US-064 | [BV-74](https://alessonevangelista.atlassian.net/browse/BV-74) | História | Exportar meus dados | E9 | 5 | F1 | 0012 |
| US-065 | [BV-75](https://alessonevangelista.atlassian.net/browse/BV-75) | História | Corrigir meus dados | E9 | 2 | F1 |  |
| US-066 | [BV-76](https://alessonevangelista.atlassian.net/browse/BV-76) | História | Excluir minha conta | E9 | 5 | F1 | 0012 |
| US-067 | [BV-77](https://alessonevangelista.atlassian.net/browse/BV-77) | História | Revogar consentimentos opcionais | E9 | 2 | F1 |  |
| US-068 | [BV-78](https://alessonevangelista.atlassian.net/browse/BV-78) | História | Falar com o encarregado | E9 | 1 | F1 |  |
| US-070 | [BV-80](https://alessonevangelista.atlassian.net/browse/BV-80) | História | Auditoria de acessibilidade | E9 | 5 | NF |  |
| US-071 | [BV-81](https://alessonevangelista.atlassian.net/browse/BV-81) | História | PWA e compatibilidade | E9 | 3 | NF |  |
| US-072 | [BV-82](https://alessonevangelista.atlassian.net/browse/BV-82) | História | Hardening de segurança e privacidade | E9 | 8 | NF |  |
| US-074 | [BV-84](https://alessonevangelista.atlassian.net/browse/BV-84) | História | Backup e restauração testados | E9 | 3 | NF |  |
| EN-053 | [BV-125](https://alessonevangelista.atlassian.net/browse/BV-125) | Tarefa | Escala de on-call, pager, página de status e templates de comunicação | E9 |  |  |  |
| EN-054 | [BV-126](https://alessonevangelista.atlassian.net/browse/BV-126) | Tarefa | Suite de smoke (test:smoke) + contas sintéticas de produção | E9 |  | F1, F2, F3, F5, F7 |  |
| EN-055 | [BV-127](https://alessonevangelista.atlassian.net/browse/BV-127) | Tarefa | Ensaio de deploy, rollback (< 10 min) e restore | E9 |  | NF |  |
| EN-056 | [BV-128](https://alessonevangelista.atlassian.net/browse/BV-128) | Tarefa | Execução do pentest e correção de críticos/altos | E9 |  |  |  |
| EN-058 | [BV-130](https://alessonevangelista.atlassian.net/browse/BV-130) | Tarefa | Checklist LGPD do Gate E | E9 |  | F1 | 0012 |
| EN-059 | [BV-131](https://alessonevangelista.atlassian.net/browse/BV-131) | Tarefa | Suporte: canal, FAQ e macros (estorno, Pix, triagem) | E9 |  | F5, F9 |  |
| EN-060 | [BV-132](https://alessonevangelista.atlassian.net/browse/BV-132) | Tarefa | Operação do beta fechado (allowlist, convites, limite de valor, feedback) | E9 |  | F1, F5 |  |
| EN-061 | [BV-133](https://alessonevangelista.atlassian.net/browse/BV-133) | Tarefa | Transação real de baixo valor ponta a ponta em produção (cartão e Pix + estorno) | E9 |  | F5, F7 | 0003 |
| EN-062 | [BV-134](https://alessonevangelista.atlassian.net/browse/BV-134) | Tarefa | Lista de espera e comunicação do lançamento | E9 |  |  |  |
| EN-063 | [BV-135](https://alessonevangelista.atlassian.net/browse/BV-135) | Tarefa | Alocar e treinar moderador; SLA de casos | E9 |  | F12 |  |
| SEC-15 | [BV-146](https://alessonevangelista.atlassian.net/browse/BV-146) | Segurança | Painel de detecção de abuso (adesão e saída repetidas, velocidade, vínculos) | E9 |  | F12 |  |
| SEC-16 | [BV-147](https://alessonevangelista.atlassian.net/browse/BV-147) | Segurança | MFA obrigatório para PJ com repasse | E9 |  | F1 |  |

## Correlação: Spec → tarefas

Cada funcionalidade da [Spec](../../SPEC.md) com as histórias e tarefas que a implementam, na ordem das sprints. Um item pode aparecer em mais de uma funcionalidade.

### F1 — Conta, identidade e privacidade

16 histórias · 12 tarefas · 62 pts · sprints S0, S1, S2, S3, S6, S7, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-008 | [BV-93](https://alessonevangelista.atlassian.net/browse/BV-93) | RIPD inicial revisado e DPO designado |  |
| S1 | EN-027 | [BV-107](https://alessonevangelista.atlassian.net/browse/BV-107) | Schema Prisma inicial + migrations (identity, bubble, quota, outbox) |  |
| S1 | EN-029 | [BV-109](https://alessonevangelista.atlassian.net/browse/BV-109) | Criptografia de PII: AES-256-GCM + HMAC de busca, chave no KMS |  |
| S1 | EN-031 | [BV-111](https://alessonevangelista.atlassian.net/browse/BV-111) | Pacote contracts: DTOs Zod, OpenAPI, erros RFC 9457, eventos WS/domínio |  |
| S1 | SEC-06 | [BV-139](https://alessonevangelista.atlassian.net/browse/BV-139) | Auth: Argon2id, throttling, refresh rotativo com detecção de reuso, cookie seguro |  |
| S1 | SEC-08 | [BV-141](https://alessonevangelista.atlassian.net/browse/BV-141) | Respostas anti-enumeração em cadastro e recuperação de senha |  |
| S1 | SEC-22 | [BV-153](https://alessonevangelista.atlassian.net/browse/BV-153) | Verificar no pentest e no CI que o cadastro e a recuperação de senha respondem de forma genérica (correção já pedida no contrato da API) |  |
| S1 | US-001 | [BV-11](https://alessonevangelista.atlassian.net/browse/BV-11) | Cadastro de pessoa física | CT-011, CT-048, CT-053, CT-054 |
| S1 | US-004 | [BV-14](https://alessonevangelista.atlassian.net/browse/BV-14) | Login por e-mail e senha | CT-011, CT-053, CT-054, CT-055 |
| S1 | US-005 | [BV-15](https://alessonevangelista.atlassian.net/browse/BV-15) | Sessão segura | CT-011, CT-053, CT-054, CT-055 |
| S1 | US-008 | [BV-18](https://alessonevangelista.atlassian.net/browse/BV-18) | Permissões por perfil | CT-011, CT-027, CT-053, CT-054, CT-057, CT-058, CT-060 |
| S2 | US-002 | [BV-12](https://alessonevangelista.atlassian.net/browse/BV-12) | Cadastro de pessoa jurídica com CNPJ verificado | CT-011, CT-048, CT-053, CT-054 |
| S2 | US-003 | [BV-13](https://alessonevangelista.atlassian.net/browse/BV-13) | Revalidação de CNPJ | CT-011, CT-053, CT-054 |
| S2 | US-006 | [BV-16](https://alessonevangelista.atlassian.net/browse/BV-16) | Entrar com Google | CT-011, CT-053, CT-054, CT-055 |
| S2 | US-007 | [BV-17](https://alessonevangelista.atlassian.net/browse/BV-17) | Recuperar senha | CT-011, CT-053, CT-054 |
| S2 | US-009 | [BV-19](https://alessonevangelista.atlassian.net/browse/BV-19) | Aceitar nova versão dos termos | CT-011, CT-053, CT-054 |
| S3 | US-013 | [BV-23](https://alessonevangelista.atlassian.net/browse/BV-23) | Ver o detalhe da bolha sem expor participantes | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S6 | US-048 | [BV-58](https://alessonevangelista.atlassian.net/browse/BV-58) | Acompanhar a triagem | CT-011, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S7 | EN-057 | [BV-129](https://alessonevangelista.atlassian.net/browse/BV-129) | Publicar termos de uso e política de privacidade validados |  |
| S8 | EN-054 | [BV-126](https://alessonevangelista.atlassian.net/browse/BV-126) | Suite de smoke (test:smoke) + contas sintéticas de produção |  |
| S8 | EN-058 | [BV-130](https://alessonevangelista.atlassian.net/browse/BV-130) | Checklist LGPD do Gate E |  |
| S8 | EN-060 | [BV-132](https://alessonevangelista.atlassian.net/browse/BV-132) | Operação do beta fechado (allowlist, convites, limite de valor, feedback) |  |
| S8 | SEC-16 | [BV-147](https://alessonevangelista.atlassian.net/browse/BV-147) | MFA obrigatório para PJ com repasse |  |
| S8 | US-064 | [BV-74](https://alessonevangelista.atlassian.net/browse/BV-74) | Exportar meus dados | CT-011, CT-051, CT-052, CT-053, CT-054 |
| S8 | US-065 | [BV-75](https://alessonevangelista.atlassian.net/browse/BV-75) | Corrigir meus dados | CT-011, CT-053, CT-054 |
| S8 | US-066 | [BV-76](https://alessonevangelista.atlassian.net/browse/BV-76) | Excluir minha conta | CT-011, CT-051, CT-052, CT-053, CT-054 |
| S8 | US-067 | [BV-77](https://alessonevangelista.atlassian.net/browse/BV-77) | Revogar consentimentos opcionais | CT-011, CT-053, CT-054 |
| S8 | US-068 | [BV-78](https://alessonevangelista.atlassian.net/browse/BV-78) | Falar com o encarregado | CT-011, CT-053, CT-054 |

### F2 — Canvas

9 histórias · 8 tarefas · 44 pts · sprints S0, S1, S2, S3, S4, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-004 | [BV-89](https://alessonevangelista.atlassian.net/browse/BV-89) | Fechar protótipo navegável (prototipacao-gemini) das trilhas PF, PJ e Organizadora |  |
| S0 | EN-005 | [BV-90](https://alessonevangelista.atlassian.net/browse/BV-90) | Teste de usabilidade: 15 + 2 sessões |  |
| S0 | EN-012 | [BV-97](https://alessonevangelista.atlassian.net/browse/BV-97) | Definir e adquirir os 2 dispositivos de referência |  |
| S1 | EN-031 | [BV-111](https://alessonevangelista.atlassian.net/browse/BV-111) | Pacote contracts: DTOs Zod, OpenAPI, erros RFC 9457, eventos WS/domínio |  |
| S1 | US-008 | [BV-18](https://alessonevangelista.atlassian.net/browse/BV-18) | Permissões por perfil | CT-011, CT-027, CT-053, CT-054, CT-057, CT-058, CT-060 |
| S2 | EN-034 | [BV-114](https://alessonevangelista.atlassian.net/browse/BV-114) | Design system: tokens e componentes base em ui-components |  |
| S2 | EN-036 | [BV-116](https://alessonevangelista.atlassian.net/browse/BV-116) | Workflow perf.yml: benchmark do canvas com 500 bolhas |  |
| S2 | US-010 | [BV-20](https://alessonevangelista.atlassian.net/browse/BV-20) | Navegar com pan e zoom | CT-027, CT-057, CT-058, CT-060 |
| S2 | US-011 | [BV-21](https://alessonevangelista.atlassian.net/browse/BV-21) | Ver as bolhas da região | CT-027, CT-057, CT-058, CT-060 |
| S2 | US-015 | [BV-25](https://alessonevangelista.atlassian.net/browse/BV-25) | Explorar sem login | CT-027, CT-057, CT-058, CT-060 |
| S3 | US-012 | [BV-22](https://alessonevangelista.atlassian.net/browse/BV-22) | Entender uma bolha num relance | CT-027, CT-057, CT-058, CT-060 |
| S3 | US-013 | [BV-23](https://alessonevangelista.atlassian.net/browse/BV-23) | Ver o detalhe da bolha sem expor participantes | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S4 | SEC-07 | [BV-140](https://alessonevangelista.atlassian.net/browse/BV-140) | Rate limit (API e WS) + limites de conexão e inscrição WS |  |
| S4 | US-014 | [BV-24](https://alessonevangelista.atlassian.net/browse/BV-24) | Lista acessível e filtros | CT-027, CT-057, CT-058, CT-060, CT-061 |
| S4 | US-025 | [BV-35](https://alessonevangelista.atlassian.net/browse/BV-35) | Ver o canvas mudar em tempo real | CT-014, CT-026, CT-027, CT-057, CT-058, CT-060, CT-062 |
| S4 | US-032 | [BV-42](https://alessonevangelista.atlassian.net/browse/BV-42) | Avisos de prazo | CT-014, CT-026, CT-027, CT-057, CT-058, CT-060, CT-062 |
| S8 | EN-054 | [BV-126](https://alessonevangelista.atlassian.net/browse/BV-126) | Suite de smoke (test:smoke) + contas sintéticas de produção |  |

### F3 — Criar bolha de venda

4 histórias · 5 tarefas · 20 pts · sprints S0, S1, S2, S3, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-004 | [BV-89](https://alessonevangelista.atlassian.net/browse/BV-89) | Fechar protótipo navegável (prototipacao-gemini) das trilhas PF, PJ e Organizadora |  |
| S0 | EN-009 | [BV-94](https://alessonevangelista.atlassian.net/browse/BV-94) | Decisões de produto Q2, Q3, Q5, Q6, Q9, Q10 |  |
| S1 | EN-027 | [BV-107](https://alessonevangelista.atlassian.net/browse/BV-107) | Schema Prisma inicial + migrations (identity, bubble, quota, outbox) |  |
| S2 | EN-035 | [BV-115](https://alessonevangelista.atlassian.net/browse/BV-115) | Headers de segurança (CSP, HSTS…) e upload seguro de imagem |  |
| S3 | US-017 | [BV-27](https://alessonevangelista.atlassian.net/browse/BV-27) | Criar bolha de venda com degraus | CT-017, CT-018, CT-019 |
| S3 | US-018 | [BV-28](https://alessonevangelista.atlassian.net/browse/BV-28) | Criar bolha de compra | CT-009, CT-017, CT-018, CT-019, CT-074 |
| S3 | US-019 | [BV-29](https://alessonevangelista.atlassian.net/browse/BV-29) | Publicar bolha | CT-009, CT-019, CT-020, CT-074 |
| S3 | US-020 | [BV-30](https://alessonevangelista.atlassian.net/browse/BV-30) | Cancelar bolha sem adesões | CT-019, CT-020 |
| S8 | EN-054 | [BV-126](https://alessonevangelista.atlassian.net/browse/BV-126) | Suite de smoke (test:smoke) + contas sintéticas de produção |  |

### F4 — Criar bolha de compra

3 histórias · 1 tarefas · 18 pts · sprints S0, S3

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-011 | [BV-96](https://alessonevangelista.atlassian.net/browse/BV-96) | Recrutar 5 PJs parceiras para o beta |  |
| S3 | US-018 | [BV-28](https://alessonevangelista.atlassian.net/browse/BV-28) | Criar bolha de compra | CT-009, CT-017, CT-018, CT-019, CT-074 |
| S3 | US-019 | [BV-29](https://alessonevangelista.atlassian.net/browse/BV-29) | Publicar bolha | CT-009, CT-019, CT-020, CT-074 |
| S3 | US-021 | [BV-31](https://alessonevangelista.atlassian.net/browse/BV-31) | PF entra com 1 cota, sem overbooking | CT-001, CT-002, CT-003, CT-007, CT-008, CT-009, CT-010, CT-011 |

### F5 — Entrar e sair de cota

11 histórias · 17 tarefas · 55 pts · sprints S0, S1, S3, S4, S5, S7, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-003 | [BV-88](https://alessonevangelista.atlassian.net/browse/BV-88) | Abrir conta e iniciar homologação no Pagar.me |  |
| S0 | EN-004 | [BV-89](https://alessonevangelista.atlassian.net/browse/BV-89) | Fechar protótipo navegável (prototipacao-gemini) das trilhas PF, PJ e Organizadora |  |
| S0 | EN-005 | [BV-90](https://alessonevangelista.atlassian.net/browse/BV-90) | Teste de usabilidade: 15 + 2 sessões |  |
| S0 | SPK-01 | [BV-87](https://alessonevangelista.atlassian.net/browse/BV-87) | Spike Pagar.me: pré-autorização, Pix, webhook e split |  |
| S1 | EN-027 | [BV-107](https://alessonevangelista.atlassian.net/browse/BV-107) | Schema Prisma inicial + migrations (identity, bubble, quota, outbox) |  |
| S1 | EN-031 | [BV-111](https://alessonevangelista.atlassian.net/browse/BV-111) | Pacote contracts: DTOs Zod, OpenAPI, erros RFC 9457, eventos WS/domínio |  |
| S3 | EN-040 | [BV-117](https://alessonevangelista.atlassian.net/browse/BV-117) | Teste de concorrência da última cota no CI (100 requisições → 1 sucesso) |  |
| S3 | SEC-03 | [BV-138](https://alessonevangelista.atlassian.net/browse/BV-138) | Idempotency-Key com escopo e hash do corpo |  |
| S3 | US-013 | [BV-23](https://alessonevangelista.atlassian.net/browse/BV-23) | Ver o detalhe da bolha sem expor participantes | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S3 | US-021 | [BV-31](https://alessonevangelista.atlassian.net/browse/BV-31) | PF entra com 1 cota, sem overbooking | CT-001, CT-002, CT-003, CT-007, CT-008, CT-009, CT-010, CT-011 |
| S3 | US-022 | [BV-32](https://alessonevangelista.atlassian.net/browse/BV-32) | PJ compra várias cotas dentro do teto | CT-003, CT-004, CT-005, CT-007, CT-008, CT-010, CT-011, CT-012 |
| S3 | US-024 | [BV-34](https://alessonevangelista.atlassian.net/browse/BV-34) | Sair da bolha | CT-003, CT-006, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013 |
| S4 | SEC-07 | [BV-140](https://alessonevangelista.atlassian.net/browse/BV-140) | Rate limit (API e WS) + limites de conexão e inscrição WS |  |
| S4 | US-026 | [BV-36](https://alessonevangelista.atlassian.net/browse/BV-36) | Bolha explode no horário | CT-003, CT-004, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013 |
| S5 | EN-043 | [BV-120](https://alessonevangelista.atlassian.net/browse/BV-120) | Adaptador Pagar.me real atrás do PaymentPort |  |
| S5 | SEC-01 | [BV-136](https://alessonevangelista.atlassian.net/browse/BV-136) | Verificação do webhook + reconsulta ao gateway + webhook_events único |  |
| S5 | SEC-19 | [BV-150](https://alessonevangelista.atlassian.net/browse/BV-150) | Anti-abuso Pix: máx. 3 reservas abertas por conta; 3 expiradas em 24 h → Pix bloqueado 24 h; rate limit de cobranças; Pix desligado nos últimos 5 min |  |
| S5 | US-034 | [BV-44](https://alessonevangelista.atlassian.net/browse/BV-44) | Entrar pagando com cartão | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-035 | [BV-45](https://alessonevangelista.atlassian.net/browse/BV-45) | Entrar pagando com Pix | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-038 | [BV-48](https://alessonevangelista.atlassian.net/browse/BV-48) | Webhooks confiáveis | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-039 | [BV-49](https://alessonevangelista.atlassian.net/browse/BV-49) | Conciliação diária | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-040 | [BV-50](https://alessonevangelista.atlassian.net/browse/BV-50) | Cadastrar conta de recebimento | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-042 | [BV-52](https://alessonevangelista.atlassian.net/browse/BV-52) | Ver meu histórico financeiro | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S7 | SEC-11 | [BV-142](https://alessonevangelista.atlassian.net/browse/BV-142) | CAPTCHA adaptativo e sinais de risco na aquisição de cota |  |
| S8 | EN-054 | [BV-126](https://alessonevangelista.atlassian.net/browse/BV-126) | Suite de smoke (test:smoke) + contas sintéticas de produção |  |
| S8 | EN-059 | [BV-131](https://alessonevangelista.atlassian.net/browse/BV-131) | Suporte: canal, FAQ e macros (estorno, Pix, triagem) |  |
| S8 | EN-060 | [BV-132](https://alessonevangelista.atlassian.net/browse/BV-132) | Operação do beta fechado (allowlist, convites, limite de valor, feedback) |  |
| S8 | EN-061 | [BV-133](https://alessonevangelista.atlassian.net/browse/BV-133) | Transação real de baixo valor ponta a ponta em produção (cartão e Pix + estorno) |  |

### F6 — Preço (bolha de venda)

4 histórias · 4 tarefas · 18 pts · sprints S0, S3, S5

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-009 | [BV-94](https://alessonevangelista.atlassian.net/browse/BV-94) | Decisões de produto Q2, Q3, Q5, Q6, Q9, Q10 |  |
| S0 | EN-013 | [BV-98](https://alessonevangelista.atlassian.net/browse/BV-98) | Corrigir divergências documentais e aplicar rebalanceamento de sprints |  |
| S0 | SPK-01 | [BV-87](https://alessonevangelista.atlassian.net/browse/BV-87) | Spike Pagar.me: pré-autorização, Pix, webhook e split |  |
| S3 | US-012 | [BV-22](https://alessonevangelista.atlassian.net/browse/BV-22) | Entender uma bolha num relance | CT-027, CT-057, CT-058, CT-060 |
| S3 | US-023 | [BV-33](https://alessonevangelista.atlassian.net/browse/BV-33) | Ver o preço cair a cada cota | CT-006 |
| S5 | EN-043 | [BV-120](https://alessonevangelista.atlassian.net/browse/BV-120) | Adaptador Pagar.me real atrás do PaymentPort |  |
| S5 | US-036 | [BV-46](https://alessonevangelista.atlassian.net/browse/BV-46) | Pagar só o preço final | CT-014, CT-021, CT-026, CT-062 |
| S5 | US-041 | [BV-51](https://alessonevangelista.atlassian.net/browse/BV-51) | Receber o repasse | CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039, CT-040 |

### F7 — Explosão e timers

14 histórias · 7 tarefas · 56 pts · sprints S0, S3, S4, S5, S7, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | SPK-01 | [BV-87](https://alessonevangelista.atlassian.net/browse/BV-87) | Spike Pagar.me: pré-autorização, Pix, webhook e split |  |
| S3 | US-022 | [BV-32](https://alessonevangelista.atlassian.net/browse/BV-32) | PJ compra várias cotas dentro do teto | CT-003, CT-004, CT-005, CT-007, CT-008, CT-010, CT-011, CT-012 |
| S4 | EN-041 | [BV-118](https://alessonevangelista.atlassian.net/browse/BV-118) | Redis com AOF e ≥ 2 réplicas de worker em staging |  |
| S4 | US-025 | [BV-35](https://alessonevangelista.atlassian.net/browse/BV-35) | Ver o canvas mudar em tempo real | CT-014, CT-026, CT-027, CT-057, CT-058, CT-060, CT-062 |
| S4 | US-026 | [BV-36](https://alessonevangelista.atlassian.net/browse/BV-36) | Bolha explode no horário | CT-003, CT-004, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013 |
| S4 | US-027 | [BV-37](https://alessonevangelista.atlassian.net/browse/BV-37) | Bolha explode ao lotar | CT-004, CT-014, CT-022, CT-026, CT-062 |
| S4 | US-028 | [BV-38](https://alessonevangelista.atlassian.net/browse/BV-38) | Reconciliador recupera timers perdidos | CT-014, CT-026, CT-062 |
| S4 | US-029 | [BV-39](https://alessonevangelista.atlassian.net/browse/BV-39) | Bolha que falha é cancelada | CT-004, CT-014, CT-022, CT-023, CT-026, CT-043, CT-062 |
| S4 | US-030 | [BV-40](https://alessonevangelista.atlassian.net/browse/BV-40) | Bolha de sucesso segue para a triagem | CT-014, CT-026, CT-031, CT-062 |
| S4 | US-032 | [BV-42](https://alessonevangelista.atlassian.net/browse/BV-42) | Avisos de prazo | CT-014, CT-026, CT-027, CT-057, CT-058, CT-060, CT-062 |
| S5 | EN-043 | [BV-120](https://alessonevangelista.atlassian.net/browse/BV-120) | Adaptador Pagar.me real atrás do PaymentPort |  |
| S5 | SEC-01 | [BV-136](https://alessonevangelista.atlassian.net/browse/BV-136) | Verificação do webhook + reconsulta ao gateway + webhook_events único |  |
| S5 | US-036 | [BV-46](https://alessonevangelista.atlassian.net/browse/BV-46) | Pagar só o preço final | CT-014, CT-021, CT-026, CT-062 |
| S5 | US-037 | [BV-47](https://alessonevangelista.atlassian.net/browse/BV-47) | Receber 100% de volta quando não dá negócio | CT-004, CT-014, CT-022, CT-023, CT-026, CT-035, CT-070, CT-071 |
| S5 | US-038 | [BV-48](https://alessonevangelista.atlassian.net/browse/BV-48) | Webhooks confiáveis | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-039 | [BV-49](https://alessonevangelista.atlassian.net/browse/BV-49) | Conciliação diária | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-040 | [BV-50](https://alessonevangelista.atlassian.net/browse/BV-50) | Cadastrar conta de recebimento | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S5 | US-042 | [BV-52](https://alessonevangelista.atlassian.net/browse/BV-52) | Ver meu histórico financeiro | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S7 | EN-051 | [BV-123](https://alessonevangelista.atlassian.net/browse/BV-123) | Runbooks RB-01…RB-12 + game day (RB-02, 03, 09, 11) |  |
| S8 | EN-054 | [BV-126](https://alessonevangelista.atlassian.net/browse/BV-126) | Suite de smoke (test:smoke) + contas sintéticas de produção |  |
| S8 | EN-061 | [BV-133](https://alessonevangelista.atlassian.net/browse/BV-133) | Transação real de baixo valor ponta a ponta em produção (cartão e Pix + estorno) |  |

### F8 — Lances (bolha de compra)

6 histórias · 5 tarefas · 20 pts · sprints S0, S4, S5, S6

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-011 | [BV-96](https://alessonevangelista.atlassian.net/browse/BV-96) | Recrutar 5 PJs parceiras para o beta |  |
| S4 | US-030 | [BV-40](https://alessonevangelista.atlassian.net/browse/BV-40) | Bolha de sucesso segue para a triagem | CT-014, CT-026, CT-031, CT-062 |
| S5 | EN-043 | [BV-120](https://alessonevangelista.atlassian.net/browse/BV-120) | Adaptador Pagar.me real atrás do PaymentPort |  |
| S5 | SEC-12 | [BV-143](https://alessonevangelista.atlassian.net/browse/BV-143) | Decisão anti-sniping de lances (ADR-0005) |  |
| S5 | US-043 | [BV-53](https://alessonevangelista.atlassian.net/browse/BV-53) | Enviar lance | CT-030, CT-031 |
| S6 | SEC-02 | [BV-137](https://alessonevangelista.atlassian.net/browse/BV-137) | Middleware de autorização por objeto + matriz automatizada (triagem, lances, contestação) |  |
| S6 | SEC-14 | [BV-145](https://alessonevangelista.atlassian.net/browse/BV-145) | Limite de lances ativos e score mínimo para dar lance |  |
| S6 | US-044 | [BV-54](https://alessonevangelista.atlassian.net/browse/BV-54) | Ajustar ou retirar meu lance | CT-031 |
| S6 | US-045 | [BV-55](https://alessonevangelista.atlassian.net/browse/BV-55) | Comparar lances sem expor as empresas | CT-031, CT-032 |
| S6 | US-046 | [BV-56](https://alessonevangelista.atlassian.net/browse/BV-56) | Escolher o lance vencedor | CT-021, CT-031, CT-032, CT-033, CT-034 |
| S6 | US-047 | [BV-57](https://alessonevangelista.atlassian.net/browse/BV-57) | Seleção automática | CT-031, CT-032, CT-033, CT-034 |

### F9 — Triagem

9 histórias · 7 tarefas · 38 pts · sprints S0, S5, S6, S7, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-004 | [BV-89](https://alessonevangelista.atlassian.net/browse/BV-89) | Fechar protótipo navegável (prototipacao-gemini) das trilhas PF, PJ e Organizadora |  |
| S0 | EN-005 | [BV-90](https://alessonevangelista.atlassian.net/browse/BV-90) | Teste de usabilidade: 15 + 2 sessões |  |
| S0 | EN-007 | [BV-92](https://alessonevangelista.atlassian.net/browse/BV-92) | Parecer jurídico sobre itens ⚖️ |  |
| S0 | EN-009 | [BV-94](https://alessonevangelista.atlassian.net/browse/BV-94) | Decisões de produto Q2, Q3, Q5, Q6, Q9, Q10 |  |
| S5 | US-037 | [BV-47](https://alessonevangelista.atlassian.net/browse/BV-47) | Receber 100% de volta quando não dá negócio | CT-004, CT-014, CT-022, CT-023, CT-026, CT-035, CT-070, CT-071 |
| S5 | US-041 | [BV-51](https://alessonevangelista.atlassian.net/browse/BV-51) | Receber o repasse | CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039, CT-040 |
| S6 | SEC-02 | [BV-137](https://alessonevangelista.atlassian.net/browse/BV-137) | Middleware de autorização por objeto + matriz automatizada (triagem, lances, contestação) |  |
| S6 | SEC-21 | [BV-152](https://alessonevangelista.atlassian.net/browse/BV-152) | Casos de triagem: limite por conta, evidência obrigatória, evento de score por abuso |  |
| S6 | US-048 | [BV-58](https://alessonevangelista.atlassian.net/browse/BV-58) | Acompanhar a triagem | CT-011, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S6 | US-049 | [BV-59](https://alessonevangelista.atlassian.net/browse/BV-59) | Registrar o envio | CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039, CT-041 |
| S6 | US-050 | [BV-60](https://alessonevangelista.atlassian.net/browse/BV-60) | Envio atrasado e cancelamento | CT-013, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S6 | US-051 | [BV-61](https://alessonevangelista.atlassian.net/browse/BV-61) | Confirmar o recebimento | CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039, CT-041 |
| S7 | US-052 | [BV-62](https://alessonevangelista.atlassian.net/browse/BV-62) | Desistir da compra (arrependimento) | CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039, CT-041 |
| S7 | US-053 | [BV-63](https://alessonevangelista.atlassian.net/browse/BV-63) | Abrir um caso de problema | CT-013, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S7 | US-054 | [BV-64](https://alessonevangelista.atlassian.net/browse/BV-64) | Encerrar a triagem da bolha | CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039, CT-041 |
| S8 | EN-059 | [BV-131](https://alessonevangelista.atlassian.net/browse/BV-131) | Suporte: canal, FAQ e macros (estorno, Pix, triagem) |  |

### F10 — Score de reputação

6 histórias · 5 tarefas · 29 pts · sprints S0, S6, S7

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-004 | [BV-89](https://alessonevangelista.atlassian.net/browse/BV-89) | Fechar protótipo navegável (prototipacao-gemini) das trilhas PF, PJ e Organizadora |  |
| S0 | EN-007 | [BV-92](https://alessonevangelista.atlassian.net/browse/BV-92) | Parecer jurídico sobre itens ⚖️ |  |
| S0 | EN-013 | [BV-98](https://alessonevangelista.atlassian.net/browse/BV-98) | Corrigir divergências documentais e aplicar rebalanceamento de sprints |  |
| S6 | SEC-02 | [BV-137](https://alessonevangelista.atlassian.net/browse/BV-137) | Middleware de autorização por objeto + matriz automatizada (triagem, lances, contestação) |  |
| S6 | US-050 | [BV-60](https://alessonevangelista.atlassian.net/browse/BV-60) | Envio atrasado e cancelamento | CT-013, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S7 | SEC-13 | [BV-144](https://alessonevangelista.atlassian.net/browse/BV-144) | Regras anticonluio do score (contrapartes distintas, teto por par, vínculo) |  |
| S7 | US-053 | [BV-63](https://alessonevangelista.atlassian.net/browse/BV-63) | Abrir um caso de problema | CT-013, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S7 | US-055 | [BV-65](https://alessonevangelista.atlassian.net/browse/BV-65) | Score calculado por eventos objetivos | CT-013, CT-035, CT-070, CT-071, CT-036, CT-072, CT-044, CT-045 |
| S7 | US-056 | [BV-66](https://alessonevangelista.atlassian.net/browse/BV-66) | Entender meu score | CT-013, CT-035, CT-070, CT-071, CT-036, CT-072, CT-044, CT-045 |
| S7 | US-057 | [BV-67](https://alessonevangelista.atlassian.net/browse/BV-67) | Contestar um evento de score | CT-013, CT-035, CT-070, CT-071, CT-036, CT-072, CT-044, CT-045 |
| S7 | US-058 | [BV-68](https://alessonevangelista.atlassian.net/browse/BV-68) | Julgar contestação | CT-013, CT-035, CT-070, CT-071, CT-036, CT-041, CT-072, CT-044 |

### F11 — Notificações

5 histórias · 1 tarefas · 20 pts · sprints S3, S4, S6

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S3 | US-018 | [BV-28](https://alessonevangelista.atlassian.net/browse/BV-28) | Criar bolha de compra | CT-009, CT-017, CT-018, CT-019, CT-074 |
| S4 | EN-042 | [BV-119](https://alessonevangelista.atlassian.net/browse/BV-119) | Contratar provedor de e-mail transacional e configurar SPF/DKIM |  |
| S4 | US-031 | [BV-41](https://alessonevangelista.atlassian.net/browse/BV-41) | Ser avisado do que importa |  |
| S4 | US-032 | [BV-42](https://alessonevangelista.atlassian.net/browse/BV-42) | Avisos de prazo | CT-014, CT-026, CT-027, CT-057, CT-058, CT-060, CT-062 |
| S4 | US-033 | [BV-43](https://alessonevangelista.atlassian.net/browse/BV-43) | Desligar e-mails não essenciais |  |
| S6 | US-046 | [BV-56](https://alessonevangelista.atlassian.net/browse/BV-56) | Escolher o lance vencedor | CT-021, CT-031, CT-032, CT-033, CT-034 |

### F12 — Moderação

7 histórias · 7 tarefas · 27 pts · sprints S0, S6, S7, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-007 | [BV-92](https://alessonevangelista.atlassian.net/browse/BV-92) | Parecer jurídico sobre itens ⚖️ |  |
| S6 | SEC-17 | [BV-148](https://alessonevangelista.atlassian.net/browse/BV-148) | audit_log append-only (sem UPDATE/DELETE, hash encadeado, exportação WORM) + motivo obrigatório em toda ação de moderação |  |
| S6 | US-063 | [BV-73](https://alessonevangelista.atlassian.net/browse/BV-73) | Trilha de auditoria | CT-041, CT-072, CT-046, CT-047 |
| S7 | EN-057 | [BV-129](https://alessonevangelista.atlassian.net/browse/BV-129) | Publicar termos de uso e política de privacidade validados |  |
| S7 | SEC-18 | [BV-149](https://alessonevangelista.atlassian.net/browse/BV-149) | MFA para moderador, segregação (sem casos próprios ou ligados), dupla aprovação para ações de alto impacto |  |
| S7 | SEC-20 | [BV-151](https://alessonevangelista.atlassian.net/browse/BV-151) | Denúncia: dedupe, rate limit, sem suspensão automática, peso por reputação do denunciante |  |
| S7 | US-053 | [BV-63](https://alessonevangelista.atlassian.net/browse/BV-63) | Abrir um caso de problema | CT-013, CT-035, CT-070, CT-071, CT-036, CT-037, CT-038, CT-039 |
| S7 | US-058 | [BV-68](https://alessonevangelista.atlassian.net/browse/BV-68) | Julgar contestação | CT-013, CT-035, CT-070, CT-071, CT-036, CT-041, CT-072, CT-044 |
| S7 | US-059 | [BV-69](https://alessonevangelista.atlassian.net/browse/BV-69) | Suspender bolha irregular | CT-041, CT-072, CT-046, CT-047 |
| S7 | US-060 | [BV-70](https://alessonevangelista.atlassian.net/browse/BV-70) | Suspender conta | CT-041, CT-072, CT-046, CT-047 |
| S8 | EN-063 | [BV-135](https://alessonevangelista.atlassian.net/browse/BV-135) | Alocar e treinar moderador; SLA de casos |  |
| S8 | SEC-15 | [BV-146](https://alessonevangelista.atlassian.net/browse/BV-146) | Painel de detecção de abuso (adesão e saída repetidas, velocidade, vínculos) |  |
| S8 | US-061 | [BV-71](https://alessonevangelista.atlassian.net/browse/BV-71) | Denunciar bolha | CT-041, CT-072, CT-046, CT-047 |
| S8 | US-062 | [BV-72](https://alessonevangelista.atlassian.net/browse/BV-72) | Painel operacional | CT-041, CT-072, CT-047 |

### NF — Requisitos não funcionais / plataforma

17 histórias · 8 tarefas · 92 pts · sprints S0, S1, S2, S3, S4, S5, S6, S7, S8

| Sprint | ID | Jira | Item | Testes |
| :--- | :--- | :--- | :--- | :--- |
| S0 | EN-012 | [BV-97](https://alessonevangelista.atlassian.net/browse/BV-97) | Definir e adquirir os 2 dispositivos de referência |  |
| S1 | EN-028 | [BV-108](https://alessonevangelista.atlassian.net/browse/BV-108) | Observabilidade base: OTel, logs estruturados, Sentry, redaction de PII |  |
| S1 | EN-033 | [BV-113](https://alessonevangelista.atlassian.net/browse/BV-113) | Infraestrutura de feature flags e kill switches |  |
| S1 | US-004 | [BV-14](https://alessonevangelista.atlassian.net/browse/BV-14) | Login por e-mail e senha | CT-011, CT-053, CT-054, CT-055 |
| S2 | EN-036 | [BV-116](https://alessonevangelista.atlassian.net/browse/BV-116) | Workflow perf.yml: benchmark do canvas com 500 bolhas |  |
| S2 | US-016 | [BV-26](https://alessonevangelista.atlassian.net/browse/BV-26) | Canvas fluido com 500 bolhas |  |
| S3 | US-012 | [BV-22](https://alessonevangelista.atlassian.net/browse/BV-22) | Entender uma bolha num relance | CT-027, CT-057, CT-058, CT-060 |
| S3 | US-021 | [BV-31](https://alessonevangelista.atlassian.net/browse/BV-31) | PF entra com 1 cota, sem overbooking | CT-001, CT-002, CT-003, CT-007, CT-008, CT-009, CT-010, CT-011 |
| S4 | US-014 | [BV-24](https://alessonevangelista.atlassian.net/browse/BV-24) | Lista acessível e filtros | CT-027, CT-057, CT-058, CT-060, CT-061 |
| S4 | US-025 | [BV-35](https://alessonevangelista.atlassian.net/browse/BV-35) | Ver o canvas mudar em tempo real | CT-014, CT-026, CT-027, CT-057, CT-058, CT-060, CT-062 |
| S4 | US-026 | [BV-36](https://alessonevangelista.atlassian.net/browse/BV-36) | Bolha explode no horário | CT-003, CT-004, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013 |
| S4 | US-028 | [BV-38](https://alessonevangelista.atlassian.net/browse/BV-38) | Reconciliador recupera timers perdidos | CT-014, CT-026, CT-062 |
| S5 | US-038 | [BV-48](https://alessonevangelista.atlassian.net/browse/BV-48) | Webhooks confiáveis | CT-003, CT-007, CT-008, CT-010, CT-011, CT-012, CT-013, CT-014 |
| S6 | US-063 | [BV-73](https://alessonevangelista.atlassian.net/browse/BV-73) | Trilha de auditoria | CT-041, CT-072, CT-046, CT-047 |
| S7 | EN-050 | [BV-122](https://alessonevangelista.atlassian.net/browse/BV-122) | Provisionar produção (instâncias, pool, Redis, PITR, KMS) |  |
| S7 | EN-051 | [BV-123](https://alessonevangelista.atlassian.net/browse/BV-123) | Runbooks RB-01…RB-12 + game day (RB-02, 03, 09, 11) |  |
| S7 | EN-052 | [BV-124](https://alessonevangelista.atlassian.net/browse/BV-124) | SLOs, alertas AL-01…26 e dashboards D1–D10 |  |
| S7 | US-069 | [BV-79](https://alessonevangelista.atlassian.net/browse/BV-79) | Provar carga e concorrência |  |
| S7 | US-073 | [BV-83](https://alessonevangelista.atlassian.net/browse/BV-83) | Observabilidade e alertas |  |
| S8 | EN-055 | [BV-127](https://alessonevangelista.atlassian.net/browse/BV-127) | Ensaio de deploy, rollback (< 10 min) e restore |  |
| S8 | US-062 | [BV-72](https://alessonevangelista.atlassian.net/browse/BV-72) | Painel operacional | CT-041, CT-072, CT-047 |
| S8 | US-070 | [BV-80](https://alessonevangelista.atlassian.net/browse/BV-80) | Auditoria de acessibilidade |  |
| S8 | US-071 | [BV-81](https://alessonevangelista.atlassian.net/browse/BV-81) | PWA e compatibilidade |  |
| S8 | US-072 | [BV-82](https://alessonevangelista.atlassian.net/browse/BV-82) | Hardening de segurança e privacidade |  |
| S8 | US-074 | [BV-84](https://alessonevangelista.atlassian.net/browse/BV-84) | Backup e restauração testados |  |

## Dependências (vínculo "Blocks" no Jira)

| Item | Bloqueia |
| :--- | :--- |
| EN-003 | SPK-01 |
| SPK-01 | EN-043 |
| EN-043 | US-034 |
| EN-043 | US-035 |
| US-001 | US-017 |
| US-002 | US-022 |
| US-017 | US-021 |
| US-019 | US-021 |
| US-021 | US-026 |
| US-021 | US-027 |
| US-034 | US-036 |
| US-043 | US-046 |
| US-036 | US-046 |
| US-030 | US-048 |
| US-036 | US-048 |
| US-049 | US-055 |
| US-053 | US-055 |
| EN-044 | EN-056 |
| EN-007 | EN-057 |
| EN-020 | EN-023 |
| EN-027 | US-001 |
| EN-032 | US-021 |
| EN-036 | US-016 |

## Como regenerar

Cadastro executado em 07/10/2026: BV-1 a BV-153. Se uma história ou sprint mudar, edite primeiro a fonte (histórias, matriz, plano) e depois o item no Jira. A label `id-<ID>` é a chave de correspondência entre os dois.

**Pendente:** o projeto BV (team-managed) está com o board Kanban, sem sprints. Depois de ativar **Configurações do projeto → Recursos → Sprints**, as sprints `BV S0`…`BV S8` são criadas e os itens são distribuídos pela label `sprint-sN`.
