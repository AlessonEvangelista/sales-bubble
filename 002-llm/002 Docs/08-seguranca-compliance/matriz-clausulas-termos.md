# Matriz de Cláusulas Obrigatórias — Termos de Uso, Política de Privacidade e Termos do Vendedor

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto v1.1](../../SPEC.md) · [Viabilidade jurídica](../judicial-viability.md) · [LGPD/RIPD](lgpd-ripd.md)

> ⚠️ **AVISO — RASCUNHO TÉCNICO PARA REVISÃO POR ADVOGADO.** Este documento **não** contém os termos redigidos nem constitui parecer jurídico. É uma matriz técnica que lista **o que cada documento precisa cobrir** para refletir o comportamento real do produto (Spec F1–F12) e **onde** cada cláusula aparece na interface. A redação final, as bases legais citadas e os pontos marcados ⚖️ precisam ser validados por advogado antes do Gate A (PRD §4.1). Consultor técnico não assina parecer jurídico (`juridico-contratos`, Skill Fase 5).

---

## 1. Princípios de redação (exigências transversais)

| Exigência | Base legal | Onde no produto |
| :--- | :--- | :--- |
| Informação clara, adequada e em português, destacando as cláusulas que limitam direitos | CDC arts. 6º, III; 31; 46; 54, §§ 3º e 4º | Todos os documentos; resumo em destaque no checkout da cota |
| Versionamento, data de vigência e registro do aceite (quem, quando, qual versão, canal) | LGPD art. 8º, §2º (ônus da prova do consentimento) e art. 9º; CC art. 427 | Cadastro (F1); `POST /me/consents`; novo aceite obrigatório em mudança material (`CONSENT_REQUIRED`) |
| Linguagem acessível e documento navegável (âncoras, sumário) | CDC art. 6º, III; RNF05 (WCAG 2.1 AA) | Páginas `/termos`, `/privacidade`, `/termos-vendedor` |
| Resumo das condições essenciais antes da contratação, confirmação imediata e canal de atendimento | ⚖️ Decreto nº 7.962/2013 (comércio eletrônico), arts. 2º a 4º, complementar ao CDC | Tela de confirmação de cota (F5), e-mail de confirmação, rodapé |

---

## 2. Termos de Uso (todos os usuários)

| # | Tema | Conteúdo mínimo | Base legal | Onde aparece no produto |
| :--- | :--- | :--- | :--- | :--- |
| TU-01 | Identificação da plataforma e papel de intermediadora | Razão social, CNPJ, endereço e contato. A plataforma é **provedora de aplicação intermediadora**, não vendedora: o vendedor é o criador da bolha (ou a PJ vencedora do lance) | Marco Civil art. 19; ⚖️ Decreto 7.962/2013 art. 2º | Rodapé; página "Sobre"; cabeçalho dos Termos |
| TU-02 | ⚖️ Limites de responsabilidade | O que a plataforma garante (funcionamento, estorno automático, intermediação do pagamento) e o que não garante (qualidade do produto do vendedor). **Ressalva:** em relação de consumo a plataforma pode ser considerada parte da cadeia de fornecimento (PRD §4.1). Não redigir cláusula de exoneração total (nula: CDC arts. 25 e 51, I) | Marco Civil art. 19; CDC arts. 7º, parágrafo único, 18, 25 e 51 | Termos; FAQ |
| TU-03 | Elegibilidade e cadastro | Maior de 18 anos e capaz. PF com CPF válido e único. PJ com CNPJ **ATIVO**, revalidado a cada 30 dias; o que acontece se ficar irregular (Spec F1). Veracidade dos dados. Uma conta por CPF | CC arts. 3º–5º; LGPD art. 14 (não tratar dados de crianças) | Cadastro (F1); `ACCOUNT_NOT_VERIFIED` |
| TU-04 | Conta, segurança e sessão | Responsabilidade pela credencial. Login social. Logout e revogação de sessões | CC art. 422 (boa-fé) | Cadastro; configurações |
| TU-05 | Pseudônimo e exibição pública | No canvas e nos lances aparece só o pseudônimo (e a faixa de score). O sufixo é fixo e o apelido é editável. O nome e o endereço só aparecem para a contraparte do mesmo negócio, a partir da captura | LGPD arts. 6º, III (necessidade) e 9º | Perfil; F2; F8; F9 |
| TU-06 | **Natureza jurídica da bolha e da adesão** | Bolha de venda = **oferta pública** que vincula o vendedor. Adesão à cota = **aceitação sob condição suspensiva** (atingir `min_quotas` até `expires_at`). Bolha de compra = convite a propostas (os lances são as propostas) | **CC arts. 427–435** (proposta e aceitação; art. 429: oferta ao público); CDC art. 30 | Tela "Entrar na bolha" (F5); detalhe da bolha |
| TU-07 | **Momento do fechamento** | Explosão por tempo ou lotação. Sucesso gera captura automática e triagem; falha gera estorno de 100%. O encerramento vincula a transação financeira (recomendação de `judicial-viability.md` §4.1) | CC arts. 427–435; CDC arts. 30 e 31 | Detalhe da bolha; e-mail de explosão (F11) |
| TU-08 | **Preço em degraus e preço final único** | Como o preço cai por degrau. O preço final é o do degrau atingido na explosão e é **igual para todos**. "Preço atual se fechar agora" é informativo. Exemplo numérico (Spec F6) | CDC arts. 30, 31 e 6º, III | Pré-visualização de degraus (F3); resumo da cota (F5); bolha (F2, LOD > 1×) |
| TU-09 | **Reserva de valores (pré-autorização e Pix)** | Cartão: pré-autoriza `valor_reserva × cotas` e captura o preço final. Pix: cobra o valor e devolve a diferença. **Reserva Pix**: prazo de `min(15 min, tempo restante)`; Pix indisponível nos últimos 5 min. A reserva ocupa a vaga, mas não conta para a meta nem para o preço. Sem pagamento, a vaga é liberada sem penalidade. Pix pago após o fim da bolha é estornado automaticamente. Limites de uso: máx. 3 reservas abertas por conta; 3 expiradas em 24 h suspendem o Pix por 24 h. Prazos de liberação e estorno dependem do emissor ou banco | CDC arts. 31 e 39, V; ⚖️ regras do arranjo de pagamento | Checkout da cota (F5); QR Code com contador |
| TU-10 | **Estorno de 100%** | Bolha que falha, é cancelada, suspensa pela moderação ou sem lance válido: 100% devolvido, sem retenção nem taxa | CDC arts. 6º, III, e 51, II; PRD §4.1 | Resumo da cota; e-mail de estorno (F11) |
| TU-11 | Regras de cotas | PF: 1 cota por bolha. PJ: até `max_pj_share` (10–100%, padrão 50%). O criador não participa da própria bolha (exceto como comprador na bolha de compra que criou). Mensagens de recusa (Spec F5) | CDC art. 39, I (vedação de limites quantitativos sem justa causa: ⚖️ justificar o limite como prevenção de monopólio); CC art. 422 | Resumo da cota; mensagens `PF_QUOTA_LIMIT`, `PJ_SHARE_EXCEEDED`, `CREATOR_CANNOT_JOIN` |
| TU-12 | **Saída da bolha** | Permitida enquanto ativa, **exceto na última hora**, com liberação integral do valor. Justificativa: proteger o grupo | CDC art. 51, IV (⚖️ verificar razoabilidade); CC art. 422 | Botão "Sair da bolha" desabilitado com explicação (F5) |
| TU-13 | Lances (bolha de compra) | Quem pode dar lance (PJ verificada). Lance ≤ preço-alvo. 1 lance ativo por empresa, substituível. Visibilidade por pseudônimo. Seleção pelo criador em 24 h; fallback pelo menor preço (empate: o mais antigo). Revelação do vencedor | CC arts. 427–435; CDC art. 30 | F8; tela de lances; e-mails de seleção |
| TU-14 | **Triagem e prazos** | Etapas e prazos: envio em `shipping_days` com **tolerância de +3 dias** (o comprador pode cancelar durante o atraso, com estorno de 100%), confirmação automática em 7 d, arrependimento, devolução em 10 d (sem confirmação, decide a moderação) e repasse. O que acontece se cada parte não agir. Caso de triagem ("Não recebi", "Produto diferente", "Produto com defeito") até o fim da janela de arrependimento, com decisões de estorno total, estorno parcial ou improcedente | CDC arts. 18, 26 e 49; CC art. 422 | Painel de triagem (F9) com linha do tempo e prazos |
| TU-15 | **Direito de arrependimento** | 7 dias contados do **recebimento**, sem justificativa, com devolução integral dos valores pagos. Procedimento de devolução e quem paga o frete de retorno ⚖️. No R1 a regra vale para **todas as modalidades**, inclusive B2B e C2C, até parecer jurídico (Spec Q7 ⚖️). Frete da devolução pago pelo vendedor (Spec Q8 ⚖️) | **CDC art. 49** e parágrafo único; ⚖️ Decreto 7.962/2013 art. 5º | Botão "Desistir da compra" no item (F9); e-mail de recebimento |
| TU-16 | **Score de reputação** | Critérios objetivos e **pesos publicados** (tabela da Spec F10), fórmula com decaimento, faixas e versão do modelo. Uso no R1 só informativo. O que **não** penaliza (reserva Pix expirada, saída de cota, arrependimento, falha de captura). Como contestar: 5 dias, efeito "em revisão", decisão em 5 dias úteis por moderador diferente do caso original, sem segunda instância no R1 ⚖️. Direito de revisão de decisão automatizada | LGPD art. 20; CDC art. 43 (por analogia: ⚖️ avaliar); `judicial-viability.md` §3 | "Meu score" (F10); faixa junto ao pseudônimo |
| TU-17 | Conduta proibida e conteúdo | Itens e categorias proibidos (lista fechada, Spec Q3 ⚖️). Fraude, manipulação de score, conluio, bots, contas múltiplas, abuso de denúncia e de reserva Pix | CC arts. 186–187; Marco Civil art. 19 | Criação de bolha (F3/F4); denúncia (F12) |
| TU-18 | **Moderação e denúncia** | Quem modera, motivos de suspensão de bolha ou conta, efeito (estorno de 100%), registro do motivo, notificação ao afetado e **canal de recurso** ⚖️. Como denunciar e categorias | Marco Civil arts. 19–20 (⚖️ notificação ao responsável pelo conteúdo removido); CC art. 422 | Botão "Denunciar"; notificação de suspensão; F12 |
| TU-19 | Notificações e comunicações | Notificações transacionais (não desligáveis) × não transacionais (desligáveis) | CDC art. 6º, III; LGPD art. 7º, I e V | Preferências (F11) |
| TU-20 | Taxas | Comprador PF não paga taxa. A taxa da plataforma é cobrada do vendedor: hipótese de 6% sobre o **GMV concluído**, ou seja, itens `COMPLETED` já descontados estornos e arrependimentos (Spec F6). A plataforma absorve as tarifas do gateway quando a bolha falha (Spec Q9). Frete incluso no preço da cota (Spec Q6 ⚖️) | CDC arts. 6º, III, e 31 | Resumo da cota; Termos do Vendedor |
| TU-21 | Disponibilidade e manutenção | Meta de disponibilidade (RNF04) sem garantia absoluta. O que acontece com bolhas em caso de indisponibilidade (o reconciliador explode as vencidas; prazos de triagem prorrogados ⚖️) | CDC art. 14 | Página de status (proposta) |
| TU-22 | Alterações dos termos | Aviso prévio e novo aceite em mudança material. Bolhas ativas seguem as regras vigentes na publicação | CDC art. 51, XIII; CC art. 427 | Banner de novo aceite |
| TU-23 | Lei aplicável e foro | Lei brasileira. Foro do domicílio do consumidor nas relações de consumo | CDC arts. 6º, VIII, e 101, I; ⚖️ CPC | Termos |

---

## 3. Política de Privacidade

| # | Tema | Conteúdo mínimo | Base legal | Onde aparece no produto |
| :--- | :--- | :--- | :--- | :--- |
| PP-01 | Controlador e encarregado | Identificação do controlador; nome e contato do encarregado (DPO) | LGPD arts. 9º, III–IV, e 41, §1º | Rodapé; cabeçalho da Política |
| PP-02 | Dados coletados por categoria | Lista do inventário D1–D18 em linguagem simples ([LGPD/RIPD §2](lgpd-ripd.md)) | LGPD arts. 6º, VI, e 9º, I | Política; tela de cadastro (link) |
| PP-03 | Finalidades e bases legais | Para cada finalidade, a base legal (execução de contrato, obrigação legal, legítimo interesse, consentimento) | LGPD arts. 7º e 9º, I | Política |
| PP-04 | Pseudônimo e o que é público | O que aparece no canvas e nos lances (pseudônimo, faixa de score). **O pseudônimo é dado pessoal**, não anonimização | LGPD arts. 6º, VI, e 12–13 | Política; tooltip no perfil |
| PP-05 | Compartilhamento | Gateway (Pagar.me), provedores de CNPJ, e-mail, nuvem, observabilidade; vendedor como controlador independente dos dados de entrega | LGPD arts. 9º, V, e 18, VII | Política; resumo na triagem ("seu endereço será compartilhado com o vendedor deste item") |
| PP-06 | Transferência internacional | Países, operadores e mecanismo (cláusulas-padrão) | LGPD arts. 33–36; Res. CD/ANPD nº 19/2024 | Política |
| PP-07 | Retenção | Prazos por categoria (§2 do RIPD) e o que se mantém após a exclusão (registros fiscais e transacionais) | LGPD arts. 15–16 | Política; tela de exclusão de conta |
| PP-08 | Direitos do titular e como exercê-los | Os 9 direitos do art. 18 + art. 20; caminhos (exportação, exclusão, consentimentos, DPO); prazos (exportação em até 15 dias) | LGPD arts. 18–20 | Área "Privacidade" na conta |
| PP-09 | **Decisões automatizadas (score)** | Critérios, pesos, efeito no R1 (informativo), contestação em 5 dias e revisão pelo DPO após esse prazo | LGPD art. 20 | "Meu score"; Política |
| PP-10 | Segurança | Medidas em linguagem acessível (criptografia, controle de acesso, logs sem dados pessoais) | LGPD arts. 6º, VII, e 46 | Política |
| PP-11 | Incidentes | Compromisso de comunicar à ANPD e aos titulares conforme a Res. CD/ANPD nº 15/2024 | LGPD art. 48 | Política |
| PP-12 | Cookies e armazenamento local | Necessários (legítimo interesse) × analytics e marketing (consentimento, recusa com o mesmo destaque) | LGPD arts. 7º, I e IX; orientações da ANPD | Banner de cookies |
| PP-13 | Marketing | Opt-in separado, revogável a qualquer momento | LGPD arts. 7º, I, 8º, §5º | Cadastro (caixa desmarcada); preferências |
| PP-14 | Menores | Serviço destinado a maiores de 18 anos | LGPD art. 14 | Cadastro |
| PP-15 | Alterações da Política | Versão, data e aviso de mudança material | LGPD arts. 8º, §6º, e 9º, §2º | Banner de novo aceite |

---

## 4. Termos do Vendedor (PJ e PF em C2C)

| # | Tema | Conteúdo mínimo | Base legal | Onde aparece no produto |
| :--- | :--- | :--- | :--- | :--- |
| TV-01 | Habilitação | PJ com CNPJ ATIVO (revalidação de 30 d). PF em C2C só com **cadastro de recebedor aprovado** no gateway (Spec §2, nota 1). KYC do gateway | CC art. 966 (empresário); regras do gateway | Onboarding de vendedor; bloqueio de publicação |
| TV-02 | **Oferta vinculante** | Degraus, meta, capacidade, prazo de envio e descrição vinculam o vendedor. **Preço, cotas e prazo não podem ser alterados após publicar** (só descrição e imagens) | **CDC arts. 30, 31 e 35**; **CC arts. 427–435** | Passo de revisão da criação (F3); tela de edição com campos bloqueados |
| TV-03 | Anúncio verdadeiro | Descrição, imagens e categoria corretas; proibição de itens proibidos (lista fechada) | CDC arts. 31 e 37 (publicidade enganosa) | Criação de bolha; moderação |
| TV-04 | Obrigações na triagem | Registrar envio com rastreio em `shipping_days` (1–30, padrão 7); entrega; responder a casos; aceitar devoluções por arrependimento e confirmá-las | CDC arts. 18, 35 e 49 | Painel de triagem do vendedor (F9) |
| TV-05 | Consequências de atrasar ou não enviar | Após `shipping_days`, o item fica atrasado. Envio em até +3 dias vale −15. Fim da tolerância, ou cancelamento pelo comprador durante o atraso, leva a cancelamento do item, estorno de 100% e −60. Caso de triagem procedente contra o vendedor: −30 | CC arts. 389 e 475; CDC art. 35 | Aviso 24 h antes do prazo (F11); triagem |
| TV-06 | **Arrependimento do comprador** | O vendedor aceita a devolução em 7 dias do recebimento e o estorno integral. Prazo de 10 dias para confirmar a devolução; sem confirmação, decisão da moderação | **CDC art. 49** | Triagem do vendedor |
| TV-07 | Taxa, repasse e retenções | Taxa de 6% (hipótese) sobre o GMV concluído (Spec F6), com nota fiscal da taxa emitida pela plataforma (Spec Q10 ⚖️). **Repasse só após a janela de arrependimento** (`COMPLETED`). Casos abertos pausam o repasse. Chargeback e estornos: quem arca | CC arts. 421–422; contrato com o gateway | Painel de repasses (`GET /me/payouts`) |
| TV-08 | Obrigações fiscais | Emissão de nota fiscal quando aplicável; responsabilidade tributária do vendedor | ⚖️ legislação tributária | Triagem (campo opcional de NF, proposta) |
| TV-09 | **Dados dos compradores** | O vendedor recebe nome e endereço **só do próprio negócio, a partir da captura**, como **controlador independente** e só para entrega e obrigações legais. Proibido usar para marketing ou compartilhar. Segurança e descarte | **LGPD** arts. 6º, I e III, 7º, V, 37–39 e 46 | Aviso na triagem; aceite dos Termos do Vendedor |
| TV-10 | Lances (PJ em bolha de compra) | Lance vinculante enquanto ativo (preço, prazo, condições). Substituição. Obrigação de cumprir se selecionado. Consequência de desistir após a seleção (cancelamento por culpa −60) | CC arts. 427–428; CDC art. 30 | Formulário de lance (F8) |
| TV-11 | Teto de cotas e participação | Não participar da própria bolha (inclusive por contas ligadas); respeitar `max_pj_share` como comprador | CC art. 422; CDC art. 39 | Mensagens de recusa (F5) |
| TV-12 | Score do vendedor | Pesos que afetam o vendedor (+30, +5, −15, −60), contestação e revisão | LGPD art. 20 | "Meu score" |
| TV-13 | Moderação e suspensão | Hipóteses de suspensão de bolha ou conta. Efeitos da suspensão de conta (Spec §6): bolhas ativas canceladas com estorno de 100%, cotas liberadas, triagens em andamento sob acompanhamento e **repasse retido até a revisão**. Recurso ⚖️ e trilha de auditoria | Marco Civil arts. 19–20; CC art. 422 | Notificação de suspensão |
| TV-14 | Responsabilidade pelo produto | O vendedor responde por vícios e defeitos perante o comprador; regresso da plataforma ⚖️ | CDC arts. 12, 18 e 88 | Termos do Vendedor |

---

## 5. Pontos ⚖️ para o advogado (resumo)

1. Alcance do art. 19 do Marco Civil num marketplace de consumo (cadeia de fornecimento, CDC arts. 7º e 25) — TU-02.
2. Aplicabilidade do CDC em B2B (PJ destinatária final) e em C2C — TU-15.
3. Validade do bloqueio de saída na última hora e do limite de 1 cota por PF (CDC arts. 39, I, e 51) — TU-11, TU-12.
4. Enquadramento da reserva Pix e da pré-autorização (arranjo de pagamento, prazos de estorno) — TU-09.
5. Quem arca com o frete de devolução no arrependimento — TU-15.
6. Lista de categorias proibidas (Spec Q3) — TU-17.
7. Papel do Pagar.me (operador × controlador) — PP-05.
8. Redação da revisão de decisão automatizada além do prazo de 5 dias — TU-16, PP-09.
9. Aplicação do Decreto nº 7.962/2013 (informações obrigatórias de e-commerce) — §1.

---

## Fontes consultadas (AlterEgo)

- **juridico-contratos** — 00-SKILL Fase 3 (bases legais: consentimento × execução de contrato × legítimo interesse × obrigação legal) e Fase 5 (quando acionar advogado; consultor técnico não assina parecer); Q03 (pseudonimização continua dado pessoal); Q26 (registro de consentimento com timestamp e versão como prova; definição de papéis controlador × operador em contrato); *Privacidade, LGPD e Consent Mode — Fundamentos* (política de privacidade refletindo a stack real; transferência internacional e Res. CD/ANPD nº 19/2024; cookies de analytics e marketing exigem consentimento).
- **seguranca-informacao** — *Notas de Estudo*, lição "Leis e ética" §4.4–4.6 (direitos do art. 18, encarregado art. 41, incidentes art. 48 e Res. CD/ANPD nº 15/2024).
