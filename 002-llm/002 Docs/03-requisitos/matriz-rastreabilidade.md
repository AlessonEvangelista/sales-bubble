# Matriz de Rastreabilidade — Bolha Venda (Release 1.0)

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto v1.1](../../SPEC.md) · [ERS](ers.md) · [Histórias de usuário](historias-usuario.md) · [Relatório de validação do PRD](validacao-prd.md)

> **Para que serve.** A matriz liga cada necessidade (PRD v2.1, RF01–RF09 e RNF01–RNF06) aos requisitos da ERS (RF/RN/RNF), às histórias (US), ao épico e à sprint do [plano](../planing-project.md), aos ADRs (status **proposto**) e aos tipos de teste previstos. Com ela dá para verificar que nada se perdeu e nada foi inventado entre a necessidade e o teste.
>
> **Como é mantida.** As tabelas foram geradas a partir dos campos estruturados da ERS (Origem, ADR, Teste) e das histórias (Épico, Sprint, Requisitos). Toda mudança de ID ou de vínculo deve ser feita nesses documentos e a matriz, regenerada. Os casos de teste (CT-xxx) são derivados pela [estratégia de testes](../07-qualidade/estrategia-testes.md) a partir da coluna "Testes".

**Legenda dos testes:**
- **unit:** Vitest no `core-domain`.
- **integração:** Supertest + Testcontainers (Postgres/Redis reais, gateway em sandbox ou fake).
- **E2E:** Playwright.
- **carga:** k6.
- **a11y:** axe-core + teste manual com leitor de tela.

---

## 1. PRD v2.1 → ERS → Histórias → Sprint → ADR → Testes

| PRD | Necessidade | RF / RN / RNF da ERS | US | Épico · Sprint | ADR | Testes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RF01.1** | Cadastro CPF/CNPJ, CNPJ ATIVO | RF-001, RF-002 | US-001, US-002 | E2 · S1, S2 | ADR-0008, ADR-0012 | unit, integração, E2E |
| **RF01.2** | JWT + refresh rotativo, OAuth2 Google | RF-004, RF-005, RF-006, RF-011 | US-004, US-005, US-006 | E2 · S1, S2 | ADR-0012 | unit, integração, E2E |
| **RF01.3** | Pseudônimo público | RF-008, RF-094, RN-031 | US-001, US-002, US-013 | E2, E3 · S1, S2, S3 | ADR-0012 | unit, integração, E2E |
| **RF01.4** | Exportação e exclusão (LGPD) | RF-089, RF-091 | US-064, US-066 | E9 · S7, S8 | ADR-0012 | integração, E2E |
| **RF02.1** | Canvas pan/zoom + WebSockets | RF-013, RF-014, RF-017 | US-010, US-011, US-025 | E3, E5 · S2, S4 | ADR-0010 | unit, integração, E2E, carga, a11y |
| **RF02.2** | Exibição da bolha e flags | RF-015, RF-016, RF-019, RN-011 | US-012, US-013, US-032 | E3, E5 · S3, S4 | ADR-0004, ADR-0005, ADR-0009 | unit, E2E, a11y |
| **RF02.3** | Lista alternativa acessível | RF-020 | US-014 | E3 · S3 | — | E2E, a11y |
| **RF03.1** | PF 1 cota | RF-033, RN-001 | US-021 | E4 · S3 | ADR-0002 | unit, integração, carga |
| **RF03.2** | PJ múltiplas cotas até max_pj_share | RF-034, RN-002 | US-017, US-022 | E4 · S3 | ADR-0006 | unit, integração |
| **RF03.3** | Recálculo de preço/degrau | RF-037, RN-006 | US-023, US-036 | E4, E6 · S3, S5 | ADR-0004 | unit, integração |
| **RF03.4** | Saída de cota | RF-039, RN-013 | US-024 | E4 · S3 | ADR-0002, ADR-0003 | unit, integração, E2E |
| **RF03.5** | Atomicidade / "Cotas esgotadas" | RF-032, RN-003 | US-021, US-035 | E4, E6 · S3, S5 | ADR-0002 | unit, integração, carga |
| **RF04.1** | Lances ≤ preço-alvo | RF-040, RF-041, RN-014 | US-043 | E7 · S5 | ADR-0005 | unit, integração, E2E |
| **RF04.2** | Seleção em 24 h + fallback | RF-044, RF-045, RN-015 | US-046, US-047 | E7 · S6 | ADR-0005, ADR-0011 | unit, integração, E2E |
| **RF04.3** | Lances pseudonimizados | RF-043 | US-045 | E7 · S6 | ADR-0005 | integração, E2E |
| **RF05.1** | Explosão por tempo/lotação | RF-058, RF-059, RF-061, RF-062, RN-009, RN-010 | US-022, US-026, US-027, US-029, US-037 | E4, E5, E6 · S3, S4, S5 | ADR-0002, ADR-0009, ADR-0011 | unit, integração, E2E, carga |
| **RF05.2** | Triagem com prazos | RF-063, RF-065, RF-066, RF-067, RF-069, RF-070, RF-072, RN-016 | US-017, US-030, US-048, US-049, US-050, US-051, US-052, US-054 | E4, E5, E8 · S3, S4, S6, S7 | ADR-0003, ADR-0009, ADR-0011, ADR-0012 | unit, integração, E2E, a11y |
| **RF05.3** | Score e contestação | RF-073, RF-074, RF-076, RF-077, RF-078, RN-021, RN-022 | US-049, US-055, US-056, US-057, US-058 | E8 · S6, S7 | ADR-0007 | unit, integração, E2E |
| **RF06.1** | Bolha de venda | RF-023, RF-025, RF-030, RN-005 | US-017, US-018 | E4 · S3 | ADR-0004, ADR-0006 | unit, integração, E2E |
| **RF06.2** | Bolha de compra + fornecedores | RF-024, RF-031 | US-018 | E4 · S3 | ADR-0005 | unit, integração, E2E |
| **RF06.3** | Duração 1 h–5 d | RF-025, RN-012 | US-017, US-018 | E4 · S3 | ADR-0004, ADR-0006 | unit, integração |
| **RF06.4** | DRAFT → ACTIVE, cancelamento | RF-026, RF-028, RN-026 | US-019, US-020 | E4 · S3 | ADR-0009, ADR-0011 | unit, integração, E2E |
| **RF07.1** | Pré-autorização / Pix | RF-047, RF-048, RN-007, RN-008, RN-029 | US-027, US-034, US-035, US-036, US-046 | E5, E6, E7 · S4, S5, S6 | ADR-0002, ADR-0003, ADR-0005 | unit, integração, E2E |
| **RF07.2** | Captura do preço final | RF-049, RF-050, RN-007, RN-008 | US-034, US-036, US-046 | E6, E7 · S5, S6 | ADR-0003, ADR-0004, ADR-0005 | unit, integração |
| **RF07.3** | Estorno 100% | RF-051, RF-062 | US-029, US-037 | E5, E6 · S4, S5 | ADR-0003, ADR-0009 | unit, integração, E2E |
| **RF07.4** | Repasse | RF-054, RF-056, RN-019 | US-040, US-041 | E6 · S5 | ADR-0003 | unit, integração, E2E |
| **RF08.1** | Notificações | RF-079, RF-080, RF-081 | US-031, US-032 | E5 · S4 | ADR-0010, ADR-0011 | integração, E2E |
| **RF09.1** | Moderação e auditoria | RF-078, RF-083, RF-084, RF-086, RF-088, RN-030, RNF-021 | US-037, US-058, US-059, US-060, US-061, US-063 | E6, E8, E9 · S5, S7 | ADR-0007, ADR-0009, ADR-0012 | unit, integração, E2E, volume |
| **RNF01** | Desempenho (60 FPS, p99 < 200 ms) | RF-017, RNF-001, RNF-002, RNF-007 | US-016, US-025, US-069 | E3, E5, E9 · S2, S4, S7 | ADR-0010 | integração, E2E, carga, RUM |
| **RNF02** | Concorrência e pontualidade | RF-032, RNF-004, RNF-006 | US-021, US-026, US-028, US-069 | E4, E5, E9 · S3, S4, S7 | ADR-0002 | unit, integração, carga |
| **RNF03** | Segurança e privacidade | RF-092, RF-093, RF-095, RNF-010, RNF-011 | US-066, US-067, US-068, US-072 | E9 · S8 | ADR-0012 | integração, E2E, SCA/DAST, pentest, revisão RIPD |
| **RNF04** | Disponibilidade, RPO/RTO | RNF-008, RNF-009 | US-073, US-074 | E9 · S7, S8 | ADR-0011 | monitoração sintética, teste de restauração |
| **RNF05** | Acessibilidade WCAG 2.1 AA | RF-020, RNF-012 | US-014, US-070 | E3, E9 · S3, S8 | — | E2E, a11y |
| **RNF06** | Compatibilidade e PWA | RNF-013, RNF-014 | US-071 | E9 · S8 | — | E2E |

Requisitos da ERS **sem item do PRD como origem**: vêm da Spec, de leis, do plano ou de derivação explícita. Esses requisitos não são órfãos, porque a origem deles está declarada na ERS:

| ID | Origem declarada |
| :--- | :--- |
| RF-007 | Derivado (PRD RF01.2) |
| RF-009 | Spec F1; LGPD arts. 7º, 8º, 37 |
| RF-018 | Spec §6; derivado (PRD RNF01) |
| RF-021 | Spec F2; PLANO §6 |
| RF-022 | Spec F2 |
| RF-029 | Spec F3; CDC art. 30; JUR §2.1 |
| RF-035 | Spec §2, F4 |
| RF-036 | Spec F5, §6; PLANO E4 |
| RF-042 | Spec F8 |
| RF-046 | Spec F8, F11; CDC art. 31 |
| RF-052 | Spec §6; PLANO E6 |
| RF-053 | PLANO E6, §9 |
| RF-055 | CDC art. 6º, III; derivado (PRD RF07) |
| RF-068 | Spec F9, F10, §5, §6 |
| RF-071 | Spec F9, F10, F12; DIAG activities (DisputaRegistrada → ModeracaoAdmin) |
| RF-075 | Spec F10 |
| RF-082 | Spec F11; LGPD art. 18, IX |
| RF-085 | Spec F12; Marco Civil art. 19; JUR §2.3 |
| RF-087 | DIAG UC11; PLANO E9 |
| RF-090 | LGPD art. 18, III |
| RN-004 | Spec F3 |
| RN-017 | Spec F9, §5 |
| RN-023 | Spec F9, F10, §6 · ADR-0007 |
| RN-024 | Spec §2, F4 |
| RN-025 | Spec F3; CDC art. 30 |
| RN-028 | Spec F6, §5, Q9 |
| RN-032 | Código Civil art. 5º |
| RN-033 | Spec F10, Q4 |
| RN-034 | Spec F2, §5 |
| RNF-003 | Derivado (PRD RNF01) |
| RNF-005 | Derivado |
| RNF-016 | PLANO §8 (DoD) |
| RNF-017 | Spec F5, §6; ADR-0003 |
| RNF-019 | C-04, C-08 |
| RNF-020 | PLANO Gate A, E3 |
| RNF-022 | PLANO E9; R8 |

---

## 2. Matriz detalhada dos requisitos funcionais

| RF | Requisito | Módulo | Prior. | PRD | Spec | US | Épico · Sprint | ADR (proposto) | Testes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RF-001 | Cadastro de Pessoa Física | Identidade, perfil e privacidade | Must | RF01.1 | F1 | US-001 | E2 · S1 | ADR-0012 | unit, integração, E2E |
| RF-002 | Cadastro de Pessoa Jurídica com verificação de CNPJ | Identidade, perfil e privacidade | Must | RF01.1, §3.2 | F1 | US-002 | E2 · S2 | ADR-0008 | unit, integração, E2E |
| RF-003 | Revalidação periódica de CNPJ | Identidade, perfil e privacidade | Should | §3.2 | F1, §6 | US-003 | E2 · S2 | ADR-0008 | unit, integração |
| RF-004 | Login por e-mail e senha com JWT | Identidade, perfil e privacidade | Must | RF01.2 | F1 | US-004 | E2 · S1 | — | unit, integração, E2E |
| RF-005 | Login social com Google (OAuth 2.0 / OIDC) | Identidade, perfil e privacidade | Should | RF01.2 | F1 | US-006 | E2 · S2 | — | integração, E2E |
| RF-006 | Renovação e revogação de sessão | Identidade, perfil e privacidade | Must | RF01.2 | F1 | US-005 | E2 · S1 | — | unit, integração |
| RF-007 | Recuperação de senha | Identidade, perfil e privacidade | Should | — | — | US-007 | E2 · S2 | — | integração, E2E |
| RF-008 | Pseudônimo público | Identidade, perfil e privacidade | Must | RF01.3, §4.1 | F1 | US-001, US-002, US-013 | E2, E3 · S1, S2, S3 | ADR-0012 | unit, integração, E2E |
| RF-009 | Termos de uso e consentimentos versionados | Identidade, perfil e privacidade | Must | — | F1 | US-001, US-009 | E2 · S1, S2 | — | integração, E2E |
| RF-010 | Perfis e permissões | Identidade, perfil e privacidade | Must | §3 | §2 | US-008 | E2 · S1 | — | unit, integração |
| RF-011 | Consulta do próprio perfil | Identidade, perfil e privacidade | Must | RF01.2 | F1 | US-004 | E2 · S1 | ADR-0012 | integração |
| RF-012 | Acesso de visitante ao canvas | Canvas interativo | Should | §3.3 | §2 | US-008, US-015 | E2, E3 · S1, S2 | — | E2E |
| RF-013 | Navegação por pan e zoom | Canvas interativo | Must | RF02.1 | F2 | US-010 | E3 · S2 | — | E2E, a11y |
| RF-014 | Carga por viewport, culling e nível de detalhe | Canvas interativo | Must | RF02.1, §5.2.1 | F2 | US-011 | E3 · S2 | ADR-0010 | unit, integração, carga |
| RF-015 | Representação visual da bolha | Canvas interativo | Must | RF02.2 | F2, F6 | US-012 | E3 · S3 | ADR-0004 | unit, E2E, a11y |
| RF-016 | Flags derivadas e bolhas encerradas | Canvas interativo | Must | RF02.2 | F2 | US-012, US-032 | E3, E5 · S3, S4 | ADR-0009 | unit, E2E, a11y |
| RF-017 | Atualização em tempo real | Canvas interativo | Must | RF02.1, RNF01 | F2 | US-025 | E5 · S4 | ADR-0010 | integração, E2E, carga |
| RF-018 | Reconexão e ressincronização | Canvas interativo | Must | — | §6 | US-025 | E5 · S4 | ADR-0010 | integração, E2E |
| RF-019 | Detalhe da bolha | Canvas interativo | Must | RF02.2 | F2, F5 | US-013 | E3 · S3 | ADR-0004, ADR-0005 | E2E, a11y |
| RF-020 | Lista alternativa acessível | Canvas interativo | Must | RF02.3, RNF05 | F2 | US-014 | E3 · S3 | — | E2E, a11y |
| RF-021 | Posicionamento automático da bolha | Canvas interativo | Should | — | F2 | US-011 | E3 · S2 | — | unit |
| RF-022 | Filtros de visualização | Canvas interativo | Should | — | F2 | US-014 | E3 · S3 | — | E2E |
| RF-023 | Criar bolha de venda | Criação e publicação de bolhas | Must | RF06.1 | F3 | US-017 | E4 · S3 | ADR-0004, ADR-0006 | unit, integração, E2E |
| RF-024 | Criar bolha de compra | Criação e publicação de bolhas | Must | RF06.2 | F4 | US-018 | E4 · S3 | ADR-0005 | unit, integração, E2E |
| RF-025 | Validação dos parâmetros da bolha | Criação e publicação de bolhas | Must | RF06.1, RF06.3 | F3 | US-017, US-018 | E4 · S3 | ADR-0004, ADR-0006 | unit, integração |
| RF-026 | Publicar bolha | Criação e publicação de bolhas | Must | RF06.4 | F3, F4 | US-019 | E4 · S3 | ADR-0009, ADR-0011 | unit, integração, E2E |
| RF-027 | Editar e descartar rascunho | Criação e publicação de bolhas | Should | §8.1 | F3 | US-017 | E4 · S3 | ADR-0009 | unit, integração |
| RF-028 | Cancelamento pelo criador | Criação e publicação de bolhas | Should | RF06.4 | F3 | US-020 | E4 · S3 | ADR-0009 | unit, integração |
| RF-029 | Imutabilidade das condições publicadas | Criação e publicação de bolhas | Must | — | F3 | US-019 | E4 · S3 | — | unit, integração |
| RF-030 | Imagens da bolha | Criação e publicação de bolhas | Should | RF06.1 | F3 | US-017 | E4 · S3 | — | unit, integração |
| RF-031 | Fornecedores sugeridos em bolha de compra | Criação e publicação de bolhas | Should | RF06.2 | F4, F11 | US-018 | E4 · S3 | — | integração |
| RF-032 | Aquisição atômica de cota | Cotas e preço | Must | RF03.5, RNF02, §5.2.3 | F5, §6 | US-021 | E4 · S3 | ADR-0002 | unit, integração, carga |
| RF-033 | Limite de 1 cota por PF | Cotas e preço | Must | RF03.1 | F5, §6 | US-021 | E4 · S3 | ADR-0002 | unit, integração, carga |
| RF-034 | Múltiplas cotas para PJ, com teto | Cotas e preço | Must | RF03.2 | F5 | US-022 | E4 · S3 | ADR-0006 | unit, integração |
| RF-035 | Participação do criador | Cotas e preço | Must | — | §2, F4 | US-018, US-021 | E4 · S3 | — | unit, integração |
| RF-036 | Idempotência da aquisição | Cotas e preço | Must | — | F5, §6 | US-021, US-034 | E4, E6 · S3, S5 | ADR-0003 | unit, integração |
| RF-037 | Recálculo e exibição do preço | Cotas e preço | Must | RF03.3 | F6 | US-023 | E4 · S3 | ADR-0004 | unit, integração |
| RF-038 | Resumo da adesão | Cotas e preço | Must | §4.1 | F5 | US-021 | E4 · S3 | ADR-0004 | E2E, a11y |
| RF-039 | Saída de cota | Cotas e preço | Should | RF03.4 | F5 | US-024 | E4 · S3 | ADR-0002, ADR-0003 | unit, integração, E2E |
| RF-040 | Submeter lance | Lances comerciais | Must | RF04.1 | F8 | US-043 | E7 · S5 | ADR-0005 | unit, integração, E2E |
| RF-041 | Validação do lance | Lances comerciais | Must | RF04.1 | F8 | US-043 | E7 · S5 | ADR-0005 | unit, integração |
| RF-042 | Substituir e retirar lance | Lances comerciais | Should | — | F8 | US-044 | E7 · S6 | ADR-0005 | unit, integração |
| RF-043 | Visibilidade pseudonimizada dos lances | Lances comerciais | Must | RF04.3 | F8 | US-045 | E7 · S6 | ADR-0005 | integração, E2E |
| RF-044 | Seleção do lance pelo criador | Lances comerciais | Must | RF04.2 | F8 | US-046 | E7 · S6 | ADR-0005 | unit, integração, E2E |
| RF-045 | Seleção automática do lance | Lances comerciais | Must | RF04.2 | F8, §6 | US-047 | E7 · S6 | ADR-0005, ADR-0011 | unit, integração |
| RF-046 | Revelação do vencedor | Lances comerciais | Should | — | F8, F11 | US-046 | E7 · S6 | ADR-0005 | integração |
| RF-047 | Pré-autorização de cartão na adesão | Pagamento, estorno e repasse | Must | RF07.1, §8.2 | F5 | US-034 | E6 · S5 | ADR-0003 | unit, integração, E2E |
| RF-048 | Reserva e cobrança Pix | Pagamento, estorno e repasse | Must | RF07.1 | F5, §6 | US-035 | E6 · S5 | ADR-0002, ADR-0003 | unit, integração, E2E |
| RF-049 | Liquidação de bolha de venda com sucesso | Pagamento, estorno e repasse | Must | RF07.2 | F6, F7, §6 | US-036 | E6 · S5 | ADR-0003, ADR-0004 | unit, integração |
| RF-050 | Liquidação de bolha de compra | Pagamento, estorno e repasse | Must | RF07.2 | F8 | US-046 | E7 · S6 | ADR-0003, ADR-0005 | unit, integração |
| RF-051 | Estorno integral | Pagamento, estorno e repasse | Must | RF07.3, §4.1 | F7, F9 | US-037 | E6 · S5 | ADR-0003, ADR-0009 | unit, integração, E2E |
| RF-052 | Processamento de webhooks do gateway | Pagamento, estorno e repasse | Must | — | §6 | US-038 | E6 · S5 | ADR-0003 | unit, integração |
| RF-053 | Conciliação diária | Pagamento, estorno e repasse | Must | — | — | US-039 | E6 · S5 | ADR-0003 | integração |
| RF-054 | Repasse ao vendedor | Pagamento, estorno e repasse | Must | RF07.4 | F6, F9 | US-041 | E6 · S5 | ADR-0003 | unit, integração |
| RF-055 | Histórico financeiro do usuário | Pagamento, estorno e repasse | Should | — | — | US-042 | E6 · S5 | — | integração, E2E |
| RF-056 | Cadastro de recebedor | Pagamento, estorno e repasse | Must | RF07.4 | §2, Q2 | US-040 | E6 · S5 | ADR-0003 | integração, E2E |
| RF-057 | Agendamento de timers | Explosão e timers | Must | §5.2.4 | F7 | US-026 | E5 · S4 | ADR-0011 | unit, integração |
| RF-058 | Explosão por tempo | Explosão e timers | Must | RF05.1 | F7, §6 | US-026 | E5 · S4 | ADR-0009, ADR-0011 | unit, integração, carga |
| RF-059 | Explosão por lotação | Explosão e timers | Must | RF05.1 | F7, §6 | US-022, US-027 | E4, E5 · S3, S4 | ADR-0002, ADR-0009 | unit, integração |
| RF-060 | Reconciliador de timers | Explosão e timers | Must | §5.2.4 | F7, §6 | US-028 | E5 · S4 | ADR-0011 | integração |
| RF-061 | Bloqueio após a explosão | Explosão e timers | Must | RF05.1 | F5 | US-026 | E5 · S4 | ADR-0002 | unit, integração |
| RF-062 | Desfecho de falha | Explosão e timers | Must | RF05.1, RF07.3 | F7 | US-029, US-037 | E5, E6 · S4, S5 | ADR-0009 | unit, integração, E2E |
| RF-063 | Encaminhamento à triagem | Explosão e timers | Must | RF05.2, §8.1 | F7, F8 | US-030 | E5 · S4 | ADR-0009 | unit, integração |
| RF-064 | Publicação confiável de eventos (outbox) | Explosão e timers | Must | §5.2.5 | — | US-025 | E5 · S4 | ADR-0010 | integração |
| RF-065 | Abertura dos itens de triagem | Triagem | Must | RF05.2 | F9 | US-048 | E8 · S6 | ADR-0009 | unit, integração |
| RF-066 | Painel de triagem | Triagem | Must | RF05.2 | F1, F9 | US-048 | E8 · S6 | ADR-0012 | integração, E2E, a11y |
| RF-067 | Registro de envio | Triagem | Must | RF05.2 | F9 | US-049 | E8 · S6 | — | unit, integração, E2E |
| RF-068 | Atraso e cancelamento por falta de envio | Triagem | Must | — | F9, F10, §5, §6 | US-050 | E8 · S6 | ADR-0007, ADR-0011 | unit, integração |
| RF-069 | Confirmação de recebimento | Triagem | Must | RF05.2 | F9 | US-051 | E8 · S7 | ADR-0011 | unit, integração, E2E |
| RF-070 | Arrependimento e devolução | Triagem | Must | RF05.2, §4.1 | F9, §6 | US-052 | E8 · S7 | ADR-0003 | unit, integração, E2E |
| RF-071 | Caso de problema com o item | Triagem | Must | — | F9, F10, F12 | US-053 | E8 · S7 | ADR-0007 | integração, E2E |
| RF-072 | Encerramento da triagem | Triagem | Must | RF05.2, §8.1 | F9 | US-054 | E8 · S7 | ADR-0009 | unit, integração |
| RF-073 | Score inicial | Reputação | Must | RF05.3 | F10 | US-055 | E8 · S7 | ADR-0007 | unit |
| RF-074 | Registro de eventos de score | Reputação | Must | RF05.3 | F10 | US-055 | E8 · S7 | ADR-0007 | unit, integração |
| RF-075 | Cálculo com decaimento e versão | Reputação | Must | — | F10 | US-055 | E8 · S7 | ADR-0007 | unit |
| RF-076 | "Meu score": exibição e explicação | Reputação | Must | RF05.3 | F10 | US-056 | E8 · S7 | ADR-0007 | integração, E2E |
| RF-077 | Abertura de contestação | Reputação | Must | RF05.3 | F10 | US-057 | E8 · S7 | ADR-0007 | unit, integração, E2E |
| RF-078 | Decisão da contestação | Reputação | Must | RF05.3, RF09.1 | F10, F12 | US-058 | E8 · S7 | ADR-0007 | unit, integração |
| RF-079 | Notificações in-app | Notificações | Must | RF08.1 | F11 | US-031 | E5 · S4 | ADR-0010 | integração, E2E |
| RF-080 | E-mails transacionais | Notificações | Must | RF08.1 | F11 | US-031 | E5 · S4 | — | integração |
| RF-081 | Avisos de prazo | Notificações | Should | RF08.1 | F7, F11 | US-032 | E5 · S4 | ADR-0011 | integração |
| RF-082 | Preferências de notificação | Notificações | Should | — | F11 | US-033 | E5 · S4 | — | integração |
| RF-083 | Suspensão de bolha pela moderação | Moderação e administração | Must | RF09.1 | F12 | US-059 | E9 · S7 | ADR-0009 | integração, E2E |
| RF-084 | Suspensão de conta | Moderação e administração | Must | RF09.1 | F12, §6 | US-060 | E9 · S7 | ADR-0009 | integração |
| RF-085 | Denúncia de bolha | Moderação e administração | Should | — | F12 | US-061 | E9 · S7 | — | integração |
| RF-086 | Fila de moderação | Moderação e administração | Must | RF09.1 | F12 | US-058, US-061 | E8, E9 · S7 | — | integração, E2E |
| RF-087 | Painel operacional | Moderação e administração | Should | — | — | US-062 | E9 · S8 | ADR-0011 | integração |
| RF-088 | Trilha de auditoria | Moderação e administração | Must | RF09.1 | F12 | US-063 | E9 · S7 | ADR-0012 | integração |
| RF-089 | Acesso e portabilidade | LGPD e direitos do titular | Must | RF01.4 | F1 | US-064 | E9 · S7 | ADR-0012 | integração, E2E |
| RF-090 | Correção de dados | LGPD e direitos do titular | Must | — | — | US-065 | E9 · S8 | — | integração |
| RF-091 | Exclusão de conta | LGPD e direitos do titular | Must | RF01.4 | F1, §6 | US-066 | E9 · S8 | ADR-0012 | integração, E2E |
| RF-092 | Revogação de consentimento | LGPD e direitos do titular | Must | RNF03 | — | US-067 | E9 · S8 | — | integração |
| RF-093 | Canal do encarregado e política de privacidade | LGPD e direitos do titular | Must | RNF03 | — | US-068 | E9 · S8 | — | E2E |
| RF-094 | Minimização da exposição pública | LGPD e direitos do titular | Must | RF01.3, §4.1 | F1 | US-013 | E3 · S3 | ADR-0012 | integração, E2E |
| RF-095 | Expurgo automatizado por retenção | LGPD e direitos do titular | Must | RNF03 | — | US-066 | E9 · S8 | ADR-0012 | integração |

---

## 3. Regras de negócio

Toda RN é verificada por **teste unitário** no `core-domain` (função pura de domínio) e por pelo menos um cenário Gherkin das histórias vinculadas.

| RN | Regra | Origem | RF que a aplicam | US | Épico · Sprint | ADR |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RN-001 | Cota PF | PRD RF03.1; Spec §5 | RF-033 | US-021 | E4 · S3 | — |
| RN-002 | Teto PJ | PRD RF03.2; Spec F3, §5 | RF-025, RF-034 | US-017, US-022 | E4 · S3 | ADR-0006 |
| RN-003 | Capacidade | PRD RF03.5; Spec F5; DADOS §1.1 | RF-032, RF-048 | US-021, US-035 | E4, E6 · S3, S5 | ADR-0002 |
| RN-004 | Parâmetros de cotas | Spec F3 | RF-025 | US-017 | E4 · S3 | — |
| RN-005 | Degraus de preço (venda) | PRD RF06.1; Spec F3 | RF-023, RF-025 | US-017 | E4 · S3 | ADR-0004 |
| RN-006 | Preço atual e preço final | PRD RF03.3; Spec F6 | RF-015, RF-037, RF-049 | US-023, US-036 | E4, E6 · S3, S5 | ADR-0004 |
| RN-007 | Valores — venda | PRD RF07.1–RF07.2; Spec F5, F6 | RF-038, RF-047–RF-049 | US-034, US-036 | E6 · S5 | ADR-0003 |
| RN-008 | Valores — compra | PRD RF07.1–RF07.2; Spec F5, F8 | RF-047, RF-048, RF-050 | US-034, US-046 | E6, E7 · S5, S6 | ADR-0005 |
| RN-009 | Explosão por tempo | PRD RF05.1(a); Spec F7, §6 | RF-058, RF-062 | US-026 | E5 · S4 | ADR-0009 |
| RN-010 | Explosão por lotação | PRD RF05.1(b); Spec F7; DADOS §1.1 | RF-059 | US-022, US-027 | E4, E5 · S3, S4 | ADR-0009 |
| RN-011 | Flags derivadas | PRD RF02.2, §5.2.2; Spec §5 | RF-016, RF-081 | US-012 | E3 · S3 | ADR-0009 |
| RN-012 | Duração | PRD RF06.3; Spec §5; R5 | RF-025, RF-026 | US-017 | E4 · S3 | — |
| RN-013 | Saída de cota | PRD RF03.4; Spec F5 | RF-039 | US-024 | E4 · S3 | — |
| RN-014 | Validade do lance | PRD RF04.1; Spec F8 | RF-040–RF-042 | US-043 | E7 · S5 | ADR-0005 |
| RN-015 | Seleção do lance | PRD RF04.2; Spec F8, §5 | RF-044, RF-045 | US-046, US-047 | E7 · S6 | ADR-0005 |
| RN-016 | Prazo de envio e tolerância | PRD RF05.2; Spec F3, F9, §5 | RF-065, RF-067, RF-068 | US-017, US-048, US-050 | E4, E8 · S3, S6 | — |
| RN-017 | Confirmação automática | Spec F9, §5 | RF-069 | US-051 | E8 · S7 | — |
| RN-018 | Arrependimento e devolução | PRD §4.1; Spec F9, §5; CDC art. 49 | RF-070 | US-052 | E8 · S7 | — |
| RN-019 | Repasse | PRD RF07.4; Spec F6, F9, §6 | RF-054 | US-041 | E6 · S5 | — |
| RN-020 | Fechamento da triagem | PRD §8.1; Spec F9 | RF-072 | US-054 | E8 · S7 | ADR-0009 |
| RN-021 | Score | PRD RF05.3; Spec F10, §5 | RF-073–RF-076 | US-049, US-055 | E8 · S6, S7 | ADR-0007 |
| RN-022 | Contestação | PRD RF05.3; Spec F10, §5 | RF-077, RF-078 | US-057, US-058 | E8 · S7 | ADR-0007 |
| RN-023 | Penalidades | Spec F9, F10, §6 | RF-049, RF-068, RF-071 | US-050, US-053 | E8 · S6, S7 | ADR-0007 |
| RN-024 | Participação do criador | Spec §2, F4 | RF-035, RF-026 | US-018 | E4 · S3 | — |
| RN-025 | Imutabilidade | Spec F3; CDC art. 30 | RF-029 | US-019 | E4 · S3 | — |
| RN-026 | Cancelamento pelo criador | PRD RF06.4; Spec F3 | RF-027, RF-028 | US-020 | E4 · S3 | — |
| RN-027 | Verificação de CNPJ | PRD §3.2; Spec F1, §5 | RF-002, RF-003 | US-002, US-003 | E2 · S2 | ADR-0008 |
| RN-028 | Take rate | Spec F6, §5, Q9 | RF-054 | US-041 | E6 · S5 | — |
| RN-029 | Reserva Pix | PRD RF07.1; Spec F5, §5, §6 | RF-048 | US-027, US-035 | E5, E6 · S4, S5 | — |
| RN-030 | Suspensão pela moderação | PRD RF09.1; Spec F12 | RF-083 | US-037, US-059 | E6, E9 · S5, S7 | ADR-0009 |
| RN-031 | Pseudônimo | PRD RF01.3; Spec F1 | RF-008 | US-001 | E2 · S1 | — |
| RN-032 | Capacidade civil | Código Civil art. 5º | RF-001 | US-001 | E2 · S1 | — |
| RN-033 | Score informativo | Spec F10, Q4 | RF-076 | US-055 | E8 · S7 | — |
| RN-034 | Bolhas encerradas no canvas | Spec F2, §5 | RF-016 | US-012 | E3 · S3 | — |

---

## 4. Requisitos não funcionais

| RNF | Atributo | Origem | US | Épico · Sprint | Verificação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RNF-001 | Desempenho do canvas | PRD RNF01; R1 | US-016 | E3 · S2 | E2E (benchmark Playwright), RUM |
| RNF-002 | Latência de tempo real | PRD RNF01, §10 | US-025, US-069 | E5, E9 · S4, S7 | carga (k6), RUM |
| RNF-003 | Latência da API | Derivado (PRD RNF01) | US-069 | E9 · S7 | carga |
| RNF-004 | Pontualidade dos timers | PRD RNF02, §10; R3 | US-026, US-028, US-069 | E5, E9 · S4, S7 | integração (caos), carga |
| RNF-005 | Carregamento | Derivado | US-016 | E3 · S2 | E2E (Lighthouse CI) |
| RNF-006 | Integridade de cotas | PRD RNF02; R2 | US-021, US-069 | E4, E9 · S3, S7 | integração (concorrência), carga |
| RNF-007 | Escalabilidade | PRD RNF01–02; R7 | US-069 | E9 · S7 | carga |
| RNF-008 | Disponibilidade | PRD RNF04 | US-073 | E9 · S7 | monitoração sintética |
| RNF-009 | Backup e recuperação | PRD RNF04; ADR-0011 | US-074 | E9 · S8 | teste de restauração |
| RNF-010 | Segurança | PRD RNF03 | US-072 | E9 · S8 | pentest, SCA/DAST, integração |
| RNF-011 | Privacidade | PRD RNF03, §4.1; LGPD arts. 46, 48; ADR-0012; R6 | US-072 | E9 · S8 | integração (scanner de PII), revisão RIPD |
| RNF-012 | Acessibilidade | PRD RNF05; Spec F2, F7, §8 | US-014, US-070 | E3, E9 · S3, S8 | a11y (axe-core + manual) |
| RNF-013 | Compatibilidade | PRD RNF06 | US-071 | E9 · S8 | E2E (matriz de navegadores) |
| RNF-014 | PWA | PRD RNF06, §9 | US-071 | E9 · S8 | E2E (Lighthouse, offline) |
| RNF-015 | Observabilidade | PRD §10; PLANO §1, E9 | US-062, US-073 | E9 · S7, S8 | integração (alerta sintético) |
| RNF-016 | Manutenibilidade | PLANO §8 (DoD) | **—** | — · — | análise estática / cobertura no CI |
| RNF-017 | Idempotência | Spec F5, §6; ADR-0003 | US-021, US-038 | E4, E6 · S3, S5 | integração |
| RNF-018 | Confiabilidade de eventos | PRD §5.2.5; ADR-0010 | US-025 | E5 · S4 | integração (caos) |
| RNF-019 | Localização | C-04, C-08 | US-012 | E3 · S3 | unit, E2E |
| RNF-020 | Usabilidade | PLANO Gate A, E3 | US-070 | E9 · S8 | teste de usabilidade |
| RNF-021 | Auditabilidade | PRD RF09.1; LGPD art. 37 | US-063 | E9 · S7 | integração, volume |
| RNF-022 | Antiabuso | PLANO E9; R8 | US-004, US-069 | E2, E9 · S1, S7 | integração, carga |

---

## 5. Achados da validação do PRD → ERS

Os achados do [relatório de validação](validacao-prd.md) e onde cada um foi resolvido nesta especificação:

| Achado | Problema | Resolvido em | ADR |
| :--- | :--- | :--- | :--- |
| C1 | Três estratégias de concorrência | RF-032, RF-033, RN-003, C-02 | ADR-0002 |
| C2 | Estorno sem gateway (MVP manual) | RF-047 a RF-056 | ADR-0003 |
| C3 | Bolha sem meta ia para triagem | RF-058, RF-062, RN-009 | ADR-0009 |
| C4 | NEAR_FULL/EXPIRING como estados | RF-016, RN-011 | ADR-0009 |
| C5 | Sem ACTIVE → EXPIRED direto | RF-059, RN-010 | ADR-0009 |
| C6 | PJ sem teto | RF-034, RN-002 | ADR-0006 |
| O1 | Sem requisito de criação de bolha | RF-023 a RF-031 | ADR-0004 |
| O2 | Curva de desconto indefinida | RN-005, RN-006, RF-037 | ADR-0004 |
| O3 | Sem meta mínima | RN-004, RN-009 | — |
| O4 | Seleção do lance indefinida | RF-044, RF-045, RN-015 | ADR-0005 |
| O5 | Sem pagamento/estorno/repasse | RF-047 a RF-056 | ADR-0003 |
| O6 | Algoritmo de score inexistente | RF-073 a RF-078, RN-021, RN-022 | ADR-0007 |
| O7 | Notificações, saída, duração, moderação | RF-079 a RF-088, RF-039, RN-012, RN-013 | — |
| O8 | Direitos do titular | RF-089 a RF-095 | ADR-0012 |
| O9 | Verificação de CNPJ | RF-002, RF-003, RN-027 | ADR-0008 |
| V1 | 60 FPS sem dispositivo | RNF-001 | — |
| V2 | WS < 200 ms sem percentil | RNF-002 | ADR-0010 |
| V3 | Métrica primária ambígua | RNF-015 (métricas do PRD §10) | — |
| V4 | Média de tempo até 100% | RNF-015 | — |
| V5 | Sem guardrails | RNF-015 | — |
| D1 | Rodapé do PRD desatualizado | — (documental) | — |
| D2 | Status do PRD | — (documental) | — |

---

## 6. Verificação de cobertura

| Verificação | Resultado |
| :--- | :--- |
| Totais | 95 RF (Must 77 · Should 18 · Could 0) · 34 RN · 22 RNF · 74 US (322 pontos, estimativa inicial) |
| Itens do PRD (RF01.1–RF09.1, RNF01–RNF06) sem requisito na ERS | nenhum ✅ |
| RF sem história de usuário | nenhum ✅ |
| RF sem tipo de teste definido | nenhum ✅ |
| RF **Must** verificados só por teste unitário (sem integração/E2E) | RF-073, RF-075 — aceitável: regra de domínio pura |
| RN sem história de usuário | nenhum ✅ |
| RNF sem história de usuário | RNF-016 |
| Histórias sem requisito vinculado | nenhum ✅ |
| Histórias que citam ID inexistente na ERS | nenhum ✅ |
| ADR-0001 a ADR-0012 sem requisito vinculado | ADR-0001 |

**Órfãos e justificativa:**

- **RNF-016:** atributo de processo, verificado pela DoD e pelo CI (cobertura, lint, complexidade), não por uma história.
- **ADR-0001:** decisão estrutural (monólito modular); restringe todos os RF (C-01) sem ser origem de nenhum em particular.

**Distribuição por épico (conferência do plano):**

| Épico | Tema | US | Pontos | Sprints do plano |
| :--- | :--- | :--- | :--- | :--- |
| E2 | Identidade | 9 | 37 | S1–S2 |
| E3 | Canvas | 7 | 38 | S2–S3 |
| E4 | Bolhas e cotas | 8 | 39 | S3 |
| E5 | Tempo real/explosão | 9 | 35 | S4 |
| E6 | Pagamento | 9 | 44 | S5 |
| E7 | Lances | 5 | 18 | S5–S6 |
| E8 | Triagem/score | 11 | 47 | S6–S7 |
| E9 | Qualidade/LGPD/moderação | 16 | 64 | S7–S8 |

**Pontos por sprint (estimativa inicial):** S1 = 16 · S2 = 44 · S3 = 54 · S4 = 35 · S5 = 49 · S6 = 26 · S7 = 64 · S8 = 34.

A distribuição não é homogênea: S3 (E4 + fim de E3) e S7 (fim de E8 + início de E9, na sprint com o Carnaval) são os picos, e S1 é deliberadamente leve, porque divide espaço com E1. A velocidade só será conhecida depois da S2 (plano §5). Se a velocidade real ficar abaixo do pico, os primeiros candidatos a sair da R1 são os RF **Should/Could** sem dependência legal: RF-021, RF-022, RF-031, RF-042, RF-082 e RF-087.

---

## Fontes consultadas (AlterEgo)

- **requirements-engineer** — *Manual de Processo — Fase 3 (Requisitos)*, §5.4: a matriz de rastreabilidade liga cada requisito à sua origem (necessidade de negócio, stakeholder, regulação) e aos artefatos derivados (caso de uso, história, caso de teste, módulo), garantindo que "nada foi perdido e nada foi inventado". A estrutura das seções 1, 2 e 6 segue essa orientação.
- **qualidade-qa** — Roger S. Pressman, *Engenharia de Software*, lista de controle de validação de requisitos: a pergunta "que outros requisitos se relacionam a este? Estão indicados numa matriz de referência cruzada?" e as métricas de completude e rastreabilidade de Davis et al. fundamentam a verificação de cobertura da seção 6.
