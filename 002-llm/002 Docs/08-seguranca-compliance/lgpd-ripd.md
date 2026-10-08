# LGPD — Inventário de Dados (ROPA) e RIPD — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto v1.1](../../SPEC.md) · [API REST](../05-arquitetura/api-rest.md) · [Threat model](threat-model.md)

> ⚖️ **Rascunho técnico.** As bases legais, os prazos de retenção e os papéis de controlador e operador precisam de **validação por advogado/DPO antes do Gate A**. Plano §3: "RIPD/DPIA inicial" é critério do Gate A, e o "checklist LGPD" é critério do Gate E e da Spec §8, item 5. Consultor técnico não assina parecer jurídico (skill `juridico-contratos`, Fase 5).

---

## 1. Papéis

| Papel | Quem | Observações |
| :--- | :--- | :--- |
| **Controlador** | A empresa operadora da plataforma Bolha Venda (razão social a definir) | Decide finalidades e meios do tratamento: cadastro, canvas, pagamentos intermediados, score, moderação |
| **Controlador independente** (para os dados recebidos na triagem) | Vendedor (PJ, ou PF em C2C) | Recebe nome e endereço de entrega do comprador **só do próprio negócio, a partir da captura** (Spec F1) para cumprir a entrega e as obrigações fiscais. Deve constar dos Termos do Vendedor ([matriz](matriz-clausulas-termos.md)) |
| **Operadores** | Provedor de nuvem (API/workers: Railway ou Cloud Run; Postgres e Redis gerenciados), Vercel, provedor de e-mail, Grafana/SigNoz, Sentry, KMS/Secret Manager | Contrato de operador (DPA) com instruções, segurança, sub-operadores, devolução ou eliminação e apoio a incidentes |
| **Gateway de pagamento** (Pagar.me) | **Papel misto, a definir em contrato**: operador para o processamento em nome da plataforma; controlador independente para as próprias obrigações regulatórias (antifraude, PLD, regulação do Banco Central) | ⚖️ Validar com o jurídico |
| **Provedores de CNPJ** (BrasilAPI, ReceitaWS) | Terceiros consultados | Sai só o CNPJ. A resposta pode trazer o QSA (nomes de sócios, que são dado pessoal): armazenar só razão social, CNAE e situação |
| **Encarregado (DPO)** | A designar no S0. "DPO as a service" é aceitável para PME (`juridico-contratos`) | Identidade e contato publicados na Política de Privacidade e no rodapé (art. 41). Recebe as comunicações dos titulares e da ANPD. ⚖️ Mesmo que a empresa se enquadre como agente de pequeno porte, o tratamento inclui avaliação de comportamento (score) e dados financeiros. Recomenda-se indicar o encarregado e não usar a dispensa |

---

## 2. Inventário de dados / ROPA

Legenda das bases legais (LGPD art. 7º): **EC** execução de contrato ou procedimentos preliminares (V) · **OL** cumprimento de obrigação legal ou regulatória (II) · **ED** exercício regular de direitos em processo (VI) · **LI** legítimo interesse (IX, com LIA documentado) · **CS** consentimento (I).

| # | Dado / categoria | Titular | Finalidade | Base legal | Retenção (proposta, ⚖️ validar) | Compartilhamento | Proteção |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| D1 | Nome, e-mail, senha (hash Argon2id), CPF | PF (e responsável legal da PJ) | Cadastro, autenticação, unicidade (1 cota PF por bolha), comunicação transacional | EC | Enquanto a conta estiver ativa. Na exclusão, anonimização (Spec F1), salvo D11/D12 | E-mail: provedor de e-mail. CPF: gateway (quando exigido para cobrança/antifraude) | CPF e e-mail cifrados em coluna (AES-256-GCM) com hash HMAC para busca (ADR-0012) |
| D2 | CNPJ, razão social, CNAE, situação cadastral | PJ (CNPJ de **MEI** = dado pessoal do empresário, PRD §4.1) | Verificar CNPJ ATIVO (ADR-0008), habilitar venda e lance | EC; LI (prevenção a fraude) | Ativa + revalidação a cada 30 d; histórico de verificações por 5 anos | BrasilAPI, ReceitaWS (só o CNPJ) | CNPJ cifrado e hash HMAC |
| D3 | Identificador OAuth Google (`sub`), foto de perfil (opcional) | PF/PJ | Login social (RF01.2) | EC | Enquanto vinculado | Google (o titular inicia o fluxo) | — |
| D4 | Pseudônimo (`Bolhista#4F2A`), apelido | Todos | Exibição pública no canvas e nos lances (RF01.3) | EC | Enquanto a conta existir. Na exclusão, desvinculado da conta | Público (canvas) | **Continua dado pessoal** (§5) |
| D5 | Sessões e refresh tokens (hash), IP, user agent, timestamps | Todos | Segurança da sessão, detecção de reuso e de abuso | EC; LI | Refresh: 30 d. Registros de acesso: **6 meses** (Marco Civil, art. 15) | Observabilidade (sem PII: só `account_id` pseudônimo interno) | Tokens só como hash |
| D6 | Consentimentos (termos, privacidade, marketing) com versão, data e canal | Todos | Prova de aceite (art. 8º, §2º) | OL; ED | Vigência da conta + 5 anos | — | Imutável (histórico) |
| D7 | Participação em bolhas: cotas, bolhas criadas, lances, valores | Todos | Executar a compra e venda coletiva | EC | 5 anos após o encerramento (ver D11) | Contraparte do negócio (pseudônimo até a captura ou seleção) | — |
| D8 | Dados de pagamento: token do cartão (sem PAN), bandeira e final, id da cobrança Pix, status, valores | Comprador | Pré-autorização, captura, estorno (RF07) | EC; OL | 5 anos (registros financeiros) | Pagar.me. Os dados do cartão vão direto do navegador ao gateway (PCI SAQ-A) | Nada de PAN/CVV na plataforma |
| D9 | Dados de recebedor: dados bancários ou chave, documentos de KYC | Vendedor PJ e PF C2C | Repasse via recebedor/split (ADR-0003; Spec §2, nota 1) | EC; OL | Enquanto vendedor + 5 anos | Pagar.me (KYC do recebedor) | Preferencialmente custodiados **só no gateway** (a plataforma guarda o id do recebedor) |
| D10 | Endereço de entrega, nome do destinatário, código de rastreio, datas de envio e recebimento | Comprador | Entrega, prazos de triagem, arrependimento (F9) | EC | Endereço **oculto para o vendedor após a conclusão** (API §6.1); retido 5 anos para defesa (CDC art. 27) | Vendedor do item (controlador independente) | Visível só às partes, só a partir da captura |
| D11 | Registros fiscais e transacionais (capturas, estornos, repasses, taxa) | Todos | Obrigações fiscais e contábeis; defesa em disputas | OL; ED | **5 anos** (prazo tributário). Exceção ao direito de eliminação (art. 16, I) | Contabilidade (operador) | — |
| D12 | Score, eventos de score, contestações (justificativa, anexos), decisões | Todos | Reputação transparente (RF05.3, F10) | EC; LI (confiança do marketplace) | Eventos: 5 anos, com peso decaindo (meia-vida de 180 d). Anexos de contestação: 1 ano após a decisão | Público: só faixa e valor junto ao pseudônimo | **Decisão automatizada** (art. 20): direito de revisão (§6) |
| D13 | Casos de triagem e denúncias (texto, evidências) | Denunciante, denunciado, partes | Moderação (F12, RF09) e defesa | LI; ED | 5 anos após o encerramento do caso | — | Acesso só do moderador do caso |
| D14 | Trilha de auditoria (`audit_log`) | Usuários e moderadores | Responsabilização, segurança, prova | LI; OL; ED | 5 anos, *append-only* | — | Imutável (threat model TM-17) |
| D15 | Notificações (in-app e e-mail) e preferências | Todos | Comunicação transacional (F11) | EC | 1 ano | Provedor de e-mail | — |
| D16 | Marketing (e-mails não transacionais) | Quem optar | Comunicação promocional | **CS** (granular, revogável em `POST /me/consents`) | Até a revogação | Provedor de e-mail | Revogar é tão fácil quanto aceitar |
| D17 | Telemetria técnica (traces, métricas, erros) | Todos (indiretamente) | Desempenho, disponibilidade, depuração | LI | 30 d (traces), 90 d (logs), 13 meses (métricas agregadas) | Grafana/SigNoz, Sentry | **Sem PII** (RNF03): allowlist de atributos, scrubbing (CT-049) |
| D18 | Cookies e armazenamento local | Todos | Estritamente necessários (sessão, CSRF, preferências) | LI | Sessão / 30 d | — | Analytics ou marketing só com **CS** (orientação ANPD) |

**Dados sensíveis (art. 11):** **não** são coletados. A moderação deve remover conteúdo sensível enviado espontaneamente em descrições ou anexos. **Crianças e adolescentes:** o cadastro exige ≥ 18 anos, declarado e verificado pela data de nascimento do CPF quando disponível no provedor ⚖️.

---

## 3. RIPD / DPIA

### 3.1 Descrição do tratamento

Plataforma de compra e venda coletiva com pagamento intermediado por gateway, exibição pública por pseudônimo, score reputacional automatizado e moderação humana. **Por que há RIPD:** tratamento em larga escala de identificadores (CPF/CNPJ), dados financeiros, **avaliação automatizada de comportamento** (score) e transferência internacional.

### 3.2 Matriz de riscos ao titular

Probabilidade (P) e impacto (I) de 1 a 3. Risco = P × I (1–2 baixo, 3–4 médio, 6–9 alto).

| # | Risco ao titular | P | I | Risco inicial | Medidas | Risco residual |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| R-T1 | Vazamento de CPF, e-mail e endereço, com fraude de identidade e phishing | 2 | 3 | **6** | Cifragem em coluna + HMAC (ADR-0012), KMS, menor privilégio, logs sem PII, endereço oculto após a conclusão, pentest, plano de incidente (§7) | 3 |
| R-T2 | Reidentificação pelo pseudônimo (cruzar pseudônimo, horário de adesão e bolhas de nicho) e exposição de hábitos de consumo | 2 | 2 | 4 | Pseudônimo não derivado de dados pessoais. Lista "participantes" só com contagem no canvas. O apelido é editável. Não expor histórico de participação de terceiros | 2 |
| R-T3 | Score incorreto ou injusto afetando a reputação (decisão automatizada) | 2 | 2 | 4 | Pesos publicados. "Meu score" explica cada evento. Contestação com revisão humana (F10). Evento em revisão não conta. Score só informativo no R1. Direito de revisão (art. 20) também após os 5 dias, pelo canal do DPO (§6) | 2 |
| R-T4 | Cobrança indevida ou estorno não realizado | 2 | 3 | **6** | Idempotência, conciliação diária, estorno automático de 100% (RF07.3), CT-043 | 2 |
| R-T5 | Retenção excessiva | 2 | 2 | 4 | Tabela de retenção (§2) com jobs de expurgo e anonimização auditáveis | 2 |
| R-T6 | Transferência internacional sem salvaguarda | 2 | 2 | 4 | Cláusulas-padrão (Res. CD/ANPD nº 19/2024) nos DPAs; região Brasil quando houver; informar na Política (§8) | 1 |
| R-T7 | Acesso indevido por moderador ou funcionário | 2 | 3 | **6** | MFA, minimização por caso, auditoria imutável, segregação, dupla aprovação (TM-17) | 3 |
| R-T8 | Enumeração de cadastro (saber se alguém usa a plataforma) | 2 | 1 | 2 | Respostas genéricas e rate limit (TM-06, SEC-22) | 1 |
| R-T9 | Exposição do endereço do comprador a vendedor mal-intencionado | 2 | 2 | 4 | Endereço só a partir da captura, só para o item e oculto após a conclusão. Vendedor como controlador independente nos Termos. Denúncia e suspensão | 2 |
| R-T10 | Impossibilidade de exercer direitos (exclusão bloqueada) | 1 | 2 | 2 | Bloqueio só enquanto houver obrigação (cota ativa, triagem, repasse), com explicação e prazo (Spec v1.1 §6, B15) | 1 |
| R-T11 | Dados em telemetria de terceiros (Sentry, Grafana) | 2 | 2 | 4 | Scrubbing, allowlist e CT-049 no CI | 1 |

**Parecer técnico:** com as medidas implementadas, nenhum risco residual fica alto. Os riscos R-T1, R-T4 e R-T7 exigem evidência de controle funcionando (não apenas documentado) no Gate E: "documento existir não é o mesmo que controle funcionando" (`juridico-contratos`, Skill).

---

## 4. Direitos do titular (art. 18) e como são atendidos

Canal: área "Privacidade" na conta, mais o e-mail do encarregado (para quem não consegue acessar a conta). A identidade é verificada pela sessão autenticada ou, fora dela, por desafio no e-mail cadastrado.

| Direito (art. 18) | Como | Endpoint / processo | Prazo |
| :--- | :--- | :--- | :--- |
| I — Confirmação da existência de tratamento | Automática na área de privacidade | `GET /me` | Imediato (art. 19, I) |
| II — Acesso | Exportação completa | `POST /me/data-exports` → `GET /me/data-exports/{id}` (JSON + CSV, URL assinada de 24 h) | **Até 15 dias** (art. 19, II; Spec F1). SLO interno: 24 h |
| III — Correção | Edição do perfil. O CPF só se corrige via suporte, com prova | `PATCH /me`; suporte | Imediato / 5 dias úteis |
| IV — Anonimização, bloqueio ou eliminação de dados desnecessários | Solicitação ao DPO | Processo do DPO | 15 dias |
| V — Portabilidade | Mesmo arquivo da exportação, em formato estruturado | `POST /me/data-exports` | 15 dias ⚖️ (aguarda regulamentação da ANPD) |
| VI — Eliminação | Exclusão da conta | `POST /me/deletion-request` → `SCHEDULED` com 7 dias para desistir (`DELETE /me/deletion-request`). **Bloqueada** com cota ativa, triagem aberta ou repasse pendente (`409 DELETION_BLOCKED_OBLIGATIONS`, Spec v1.1 §6 B15). Depois: anonimização dos dados pessoais; D11, D13 e D14 retidos (art. 16, I e II) | Efetiva em 7 dias após a liberação |
| VII — Informação sobre compartilhamentos | Lista de operadores e terceiros na Política e sob demanda | Política de Privacidade | Imediato |
| VIII — Informação sobre não consentir | Telas de consentimento de marketing e cookies | UI | — |
| IX — Revogação do consentimento | Toggle de marketing e cookies | `POST /me/consents` (`granted: false`) | Imediato |
| Art. 20 — Revisão de decisão automatizada (score) | Contestação em 5 dias (F10) **e**, depois disso, pedido de revisão pelo DPO, com explicação dos critérios | `POST /score-events/{id}/disputes`; canal do DPO | Decisão em 5 dias úteis por moderador diferente do caso original, sem segunda instância no R1 (F10) |

> ⚖️ **Ponto de atenção:** o prazo de 5 dias para contestar o score é regra de produto e não pode limitar o direito de revisão do art. 20. Por isso o pedido via DPO continua possível depois dos 5 dias.

---

## 5. Pseudonimização × anonimização

| | Pseudonimização | Anonimização |
| :--- | :--- | :--- |
| Definição | Troca do identificador direto por um substituto, **reversível** com informação adicional mantida à parte | Processo **irreversível**: o titular não pode mais ser identificado, nem cruzando bases |
| Status na LGPD | **Continua dado pessoal**: exige base legal e está sujeito a todos os direitos | Deixa de ser dado pessoal (art. 12), salvo reversão com esforço razoável |
| No Bolha Venda | Pseudônimo público (D4); `account_id` interno nos logs; hash HMAC de CPF/CNPJ/e-mail (há chave no KMS, portanto é reversível por comparação); score junto ao pseudônimo | Métricas agregadas de produto (taxa de sucesso, tempo até a explosão) com limiar mínimo de agregação (k ≥ 10); contas excluídas após o expurgo (substituição por valores nulos ou genéricos, sem tabela de mapeamento) |

O PRD v2.0 (§4.1) falava em participantes "anonimizados/pseudonimizados" no canvas. O PRD v2.1 corrigiu: o pseudônimo **não** equivale a anonimização. Tratar dado pseudonimizado como anônimo é erro de governança que gera passivo jurídico (`juridico-contratos`, Q03 e Skill Fase 4). Teste de classificação: se existe "chaveiro" (tabela de mapeamento ou segredo de hash), é pseudonimização.

**Anonimização na exclusão de conta:** nome, e-mail, CPF, telefone e endereço são apagados ou substituídos. O pseudônimo é desvinculado e passa a "Conta removida". Os registros de D11 ficam vinculados a um identificador sem mapeamento para a pessoa, **exceto** onde a obrigação legal exige identificação (dados fiscais). Nesses casos o dado continua pessoal, retido sob OL e com acesso restrito ⚖️.

---

## 6. Transferência internacional (arts. 33–36; Res. CD/ANPD nº 19/2024)

| Operador | Localização provável | Mecanismo | Ação |
| :--- | :--- | :--- | :--- |
| Vercel (web/SSR) | EUA (edge global) | Cláusulas-padrão contratuais (SCCs brasileiras) no DPA | A web não deve persistir PII. Verificar o DPA |
| Railway **ou** Google Cloud Run (API/workers, decisão na S1) | Railway: EUA/UE. Cloud Run: `southamerica-east1` (São Paulo) disponível | Região Brasil elimina a transferência no núcleo; senão, SCCs | **Critério de decisão da S1:** preferir região Brasil para API, Postgres e Redis |
| Postgres e Redis gerenciados | Conforme o provedor escolhido | Idem | Idem |
| Provedor de e-mail | Provavelmente EUA | SCCs | Mínimo de dados por mensagem |
| Sentry, Grafana Cloud/SigNoz Cloud | EUA/UE | SCCs; scrubbing de PII | Considerar SigNoz self-hosted no Brasil |
| Pagar.me | Brasil | — | — |

As SCCs da Resolução 19/2024 já são exigíveis: o prazo de adequação de contratos existentes terminou em agosto de 2025 (`juridico-contratos`). Cada operador entra no ROPA com o mecanismo de transferência, e a transferência é informada na Política de Privacidade.

---

## 7. Plano de resposta a incidente de segurança com dados pessoais

**Prazo legal: até 3 dias úteis.** A comunicação à ANPD e aos titulares afetados deve ser feita **em até 3 dias úteis** a partir do conhecimento de incidente que possa acarretar risco ou dano relevante. A regra está na **Resolução CD/ANPD nº 15/2024** (Regulamento de Comunicação de Incidente de Segurança), que regulamenta o art. 48 da LGPD (`seguranca-informacao`, *Notas de Estudo*, lições "LGPD/GDPR" §7.2 e "Leis e ética" §4.6). **Correção de fontes:** o plano de projeto (R6, E9) e parte do corpus `juridico-contratos` falam em "72 h". Esse prazo é do GDPR (art. 33) e **não** é o prazo brasileiro. O plano deve ser corrigido para "3 dias úteis".

| Fase (NIST SP 800-61) | Ações | Responsável | Tempo |
| :--- | :--- | :--- | :--- |
| 1. Preparação | Este plano, runbook (09-operacao), contatos (DPO, jurídico, Pagar.me, provedor de nuvem, ANPD, CERT.br), simulação (*tabletop*) semestral, backups testados (RNF04) | Tech Lead + DPO | Contínuo |
| 2. Detecção e análise | Alerta (Sentry, OTel, gateway, denúncia). Abrir caso. Classificar a severidade. **Triar se há dado pessoal envolvido** e quais categorias (§2) | On-call | ≤ 4 h |
| 3. Contenção | Revogar credenciais e segredos (§7 do threat model), isolar o serviço, bloquear contas, rotacionar chaves KMS se necessário. Preservar evidências | On-call + Tech Lead | ≤ 24 h |
| 4. Avaliação de risco relevante | Critérios da Res. 15/2024: dados financeiros ou de autenticação, volume, possibilidade de fraude ou discriminação, dados de crianças. Decisão documentada de comunicar ou não | DPO + jurídico | ≤ 48 h |
| 5. Comunicação | **ANPD:** formulário com natureza, categorias e número de titulares, medidas de segurança, riscos, motivo de eventual atraso, medidas de mitigação e contato do encarregado. **Titulares:** linguagem clara, riscos e o que fazer (ex.: atenção a phishing). Gateway e parceiros quando aplicável | DPO | **≤ 3 dias úteis** (Res. CD/ANPD nº 15/2024) |
| 6. Erradicação e recuperação | Corrigir a causa, restaurar, monitorar com mais atenção | Engenharia | — |
| 7. Pós-incidente | Lições aprendidas (24–72 h após o fim), atualizar o threat model e este RIPD. **Registro do incidente**, mesmo quando não for comunicado ⚖️ (a Res. 15/2024 exige manter o registro; confirmar o prazo mínimo com o jurídico) | DPO + Tech Lead | — |

---

## 8. Checklist LGPD (Gate E / Spec §8, item 5)

- [ ] ROPA (§2) validado pelo jurídico e pelo DPO
- [ ] RIPD (§3) aprovado e datado
- [ ] Encarregado designado e publicado
- [ ] DPAs com SCCs assinados com todos os operadores (§6)
- [ ] Política de Privacidade e Termos publicados e versionados ([matriz](matriz-clausulas-termos.md)), com aceite registrado (D6)
- [ ] Exportação (CT-052) e exclusão (CT-051) funcionando E2E
- [ ] Jobs de retenção e expurgo implementados e testados
- [ ] Cifragem em coluna e HMAC ativos; logs e telemetria sem PII (CT-049)
- [ ] Plano de incidente com simulação realizada
- [ ] LIA documentado para as finalidades de legítimo interesse (D2, D5, D12, D13, D14, D17)

---

## Fontes consultadas (AlterEgo)

- **juridico-contratos** — Q03 "Anonimização × pseudonimização" (pseudonimizado continua dado pessoal; transferência exige SCCs); 00-SKILL Fases 3–6 (escolha de base legal; teste do "chaveiro"; quando acionar advogado; DPO as a service; evidência de controle funcionando); Q02 "Bases legais"; Q01 "Tratamento de dados pessoais"; Q23 (DPO as a service; ROPA e SCCs); *Privacidade, LGPD e Consent Mode — Fundamentos* (ROPA, direitos do titular com SLA de 15 dias, encarregado; Resolução CD/ANPD nº 19/2024 e SCCs exigíveis desde ago/2025; cookies de analytics e marketing exigem consentimento); *Privacidade* (asias): governança do ciclo de vida e DPIA.
- **seguranca-informacao** — *Notas de Estudo — Segurança da Informação*, lição "LGPD/GDPR" §7.2–7.5 e lição "Leis e ética" §4.4–4.6: **Resolução CD/ANPD nº 15/2024: comunicação em 3 dias úteis**, conteúdo mínimo da comunicação, critérios de risco relevante, registro de incidentes não comunicáveis, direitos do art. 18, encarregado (art. 41); lição "Incident Response" (NIST SP 800-61: preparação, detecção, contenção, pós-incidente, tabletop).
