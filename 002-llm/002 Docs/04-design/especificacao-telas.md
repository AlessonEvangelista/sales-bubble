# Especificação de Telas — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · [Style guide](../style-guide.md) · [Arquitetura de informação e fluxos](arquitetura-informacao-fluxos.md) · [API REST](../05-arquitetura/api-rest.md)

> Para cada tela: objetivo, componentes, dados, ações, **todos os estados** (vazio, carregando, erro, sucesso, sem permissão, offline), microcopy e comportamento responsivo. Wireframes ASCII low-fi para canvas, detalhe, criação e triagem. IDs de tela (`T01`…) vêm do [inventário](arquitetura-informacao-fluxos.md#3-inventário-de-telas). Requisitos de acessibilidade em [acessibilidade.md](acessibilidade.md). Em conflito, **a Spec prevalece**.

---

## 1. Convenções globais

### 1.1 Codificação visual da bolha (coerente com o style-guide)

O style-guide define gradientes por **tipo** e um gradiente de "próxima da explosão". Como `NEAR_FULL` e `EXPIRING` são **flags** (ADR-0009, proposto) e podem coexistir com qualquer tipo, a cor do tipo **nunca é substituída**: as flags são camadas sobrepostas, sempre com ícone e texto (Spec F2, RNF05).

| Elemento | Cor (style-guide) | Canal não cromático obrigatório |
| :--- | :--- | :--- |
| Bolha de **Venda** (`SALE`) | Gradiente `#3B82F6 → #8B5CF6` | Ícone de etiqueta de preço + preenchimento sólido + rótulo "Venda" (LOD ≥ médio e lista) |
| Bolha de **Compra** (`PURCHASE`) | Gradiente `#10B981 → #06B6D4` | Ícone de carrinho + contorno **tracejado** + rótulo "Compra" |
| Flag **Quase cheia** (`is_near_full`) | Borda âmbar `#F59E0B` (início do gradiente "próxima da explosão") | Ícone de "quase cheia" (anel quase completo) + texto "Quase cheia" |
| Flag **Expirando** (`is_expiring`) | Contador em `#EF4444` sobre fundo escuro | Ícone de relógio + contador em destaque + pulso (estático com movimento reduzido) + texto "Termina em 42 min" |
| **Encerrada** (explodida, 24 h) | `#64748B → #475569`, opacidade 60% | Ícone ✓ (sucesso) ou ✕ (não atingiu a meta) + texto "Encerrada" |
| Anel de progresso | Branco 90% sobre o gradiente | Fração textual "65/100" (LOD alto) e marcador da **meta** no anel |
| Reservas Pix pendentes | Trecho do anel hachurado | Tooltip/lista: "2 cotas reservadas aguardando Pix" |

Regras:
- Texto sobre gradiente usa branco com sombra/sobreposição escura para manter contraste ≥ 4,5:1 (o gradiente `#10B981 → #06B6D4` com texto branco não atinge 4,5:1 sem sobreposição — ver [acessibilidade.md](acessibilidade.md)).
- Tamanho da bolha ∝ log(`max_quotas`) com raio mínimo e máximo (`radius` da API).
- Tipografia: títulos `Inter` 16/600; preço `Inter` 20/700; contadores e números `JetBrains Mono` 14/500 (tabular); rótulos 12/400. O style-guide lista alternativas (`Roboto`, `Outfit`, `Space Grotesk`) — este documento fixa **Inter + JetBrains Mono** para o R1.
- Glassmorphism só em painéis (drawer, toolbar), com fundo mínimo 85% opaco para garantir contraste.

### 1.2 Breakpoints e entrada

| Faixa | Largura | Padrões |
| :--- | :--- | :--- |
| Mobile | < 640 px | Canvas tela cheia; barra inferior (Explorar, Minhas, **Criar**, Notificações, Conta); detalhe em **bottom sheet** (50% → 100% ao arrastar); formulários em tela cheia |
| Tablet | 640–1023 px | Canvas + detalhe em sheet lateral de 420 px; barra superior |
| Desktop | ≥ 1024 px | Canvas + **drawer** lateral direito de 440 px; barra superior; atalhos de teclado |

- Alvos de toque ≥ 44 × 44 px (botões de ação, bolhas em LOD baixo têm área de toque mínima de 44 px mesmo se o círculo for menor).
- Hover nunca é o único caminho: todo tooltip de hover também aparece no foco e no toque longo.
- Gestos (arrastar, pinça) sempre têm alternativa de um ponteiro/teclado: botões `+`/`−`/"centralizar" na toolbar.

### 1.3 Tempo de resposta e feedback

| Duração da ação | Feedback |
| :--- | :--- |
| < 0,1 s | Só o resultado (sem spinner) |
| 0,1–1 s | Botão em estado "processando" (rótulo mantido, spinner inline, desabilitado contra duplo clique) |
| 1–10 s | Skeleton/indicador com texto do que está acontecendo ("Autorizando pagamento…") |
| > 10 s | Progresso + liberar o usuário (ex.: exportação de dados: "Avisaremos quando estiver pronto") |

### 1.4 Estados padrão (aplicam-se a todas as telas, salvo indicação)

| Estado | Padrão |
| :--- | :--- |
| **Carregando** | Skeleton com a forma do conteúdo (nunca tela branca); em listas, 3–5 linhas fantasmas; `aria-busy="true"` |
| **Vazio** | Ilustração leve + 1 frase que explica + 1 ação primária ("Criar bolha", "Explorar o canvas") |
| **Erro de carregamento** | "Não foi possível carregar. Verifique sua conexão e tente novamente." + botão "Tentar de novo"; mantém dados antigos visíveis quando houver |
| **Erro de negócio** | Mensagem do catálogo §3 próxima ao controle que causou o erro; foco movido para a mensagem quando bloqueia o fluxo |
| **Sucesso** | Toast (5 s, pausável, `role="status"`) ou tela de confirmação para ações financeiras |
| **Sem permissão** | Visitante: "Entre para continuar" + Entrar/Criar conta. Logado sem papel: explica o motivo e o caminho ("Conclua a verificação do CNPJ para participar.") |
| **Offline / WS caído** | Banner fixo no topo: "Sem conexão. Os dados podem estar desatualizados." (REST fora) ou "Reconectando…" (só WS); ações financeiras desabilitadas quando a REST está offline |
| **Sessão expirada** | Renovação silenciosa; se falhar: "Sua sessão expirou. Entre novamente para continuar." preservando o formulário |

---

## 2. Microcopy-chave

Voz: direta, em 2ª pessoa ("você"), sem jargão ("cota" e "bolha" são termos do produto e ficam; "pré-autorização" vira "reserva"). Valores sempre com centavos (`R$ 80,00`). Datas relativas até 24 h ("em 42 min"), absolutas depois ("10/12, 18h").

| Contexto | Texto |
| :--- | :--- |
| Botão principal (venda/compra ativa) | "Entrar na bolha" |
| Explicação da reserva (venda) | "Reservamos R$ 100,00 agora (preço inicial). Você paga o preço final da bolha, que pode ser menor. A diferença é liberada." |
| Explicação da reserva (compra) | "Reservamos até R$ 890,00 (preço-alvo). Você paga o valor do lance escolhido. A diferença é liberada." |
| Preço atual | "Se fechar agora: R$ 90,00 por cota" |
| Próximo degrau | "Faltam 5 cotas para R$ 80,00" |
| Meta | "Meta: 40 cotas · 65 já entraram" |
| Meta não atingida (ativa) | "Faltam 12 cotas para a bolha fechar negócio" |
| Sucesso ao entrar | "Você está na bolha!" |
| Reserva Pix | "Sua cota fica reservada por 15:00. Pague o Pix para confirmar." (contador = `min(15 min, tempo restante da bolha)`) |
| Pix indisponível no fim | "Faltam menos de 5 minutos: use cartão para entrar." |
| Lotada só com reservas | "Cotas esgotadas — N reservas aguardando pagamento" **(Spec F5)** |
| Item atrasado (comprador) | "O vendedor ainda não enviou. Você pode aguardar até 06/12 ou cancelar com estorno integral." |
| Cadastro enviado | "Se os dados forem válidos, enviaremos a confirmação por e-mail." |
| Pix expirado | "O tempo do Pix acabou e a reserva foi liberada. Nenhum valor foi cobrado." |
| Sair (confirmação) | "Sair da bolha? A reserva de R$ 100,00 será liberada e o preço será recalculado para todos." |
| Saída bloqueada | "Saídas são bloqueadas na última hora para proteger o grupo" |
| Explosão com sucesso | "A bolha fechou a R$ 80,00 por cota. R$ 20,00 liberados." |
| Explosão sem meta | "A bolha não atingiu a meta. Todo o valor reservado foi devolvido." |
| Rascunho | "Rascunho salvo automaticamente" |
| Oferta vinculante | "Depois de publicar, preço, cotas e prazo não podem ser alterados." |
| Seleção de lance | "Escolha o lance vencedor até 27/11, 09h41. Se você não escolher, vence o menor preço." |
| Arrependimento | "Você pode desistir da compra até 10/12, sem precisar justificar." |
| Contestação | "Discorda deste evento? Você pode contestar até 09/12." |
| Score em revisão | "Em revisão — este evento não conta no seu score até a decisão." |

---

## 3. Catálogo de erros de negócio → microcopy

Códigos da [API REST §1.4.1](../05-arquitetura/api-rest.md). Linhas marcadas **Spec** usam o texto normativo da Spec (F1, F5, F8) — não alterar sem alterar a Spec.

| `code` | Mensagem | Onde aparece / ação oferecida |
| :--- | :--- | :--- |
| `QUOTA_SOLD_OUT` | "As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado." **(Spec)** | Modal T12 → "Ver bolhas parecidas" |
| `PF_QUOTA_LIMIT` | "Você já participa desta bolha (limite de 1 cota por pessoa)." **(Spec)** | Modal T12 → "Ver minha cota" |
| `PJ_SHARE_EXCEEDED` | "Sua empresa pode ocupar no máximo N cotas nesta bolha." **(Spec)** | Junto ao seletor de quantidade; ajusta o máximo |
| `BUBBLE_NOT_ACTIVE` | "Esta bolha já foi encerrada." **(Spec)** | Modal/detalhe → "Ver resultado" |
| `CREATOR_CANNOT_JOIN` | "Você não pode participar da própria bolha." **(Spec)** | Detalhe (acesso via URL) |
| `PAYMENT_DECLINED` | "O pagamento não foi autorizado. Tente outra forma de pagamento." **(Spec)** | Passo de pagamento, foco no seletor de forma de pagamento |
| `ACCOUNT_NOT_VERIFIED` | "Conclua a verificação do CNPJ para participar." **(Spec)** | Qualquer ação de PJ → "Verificar agora" (T23) |
| `BID_ABOVE_TARGET` | "O lance precisa ser igual ou menor que o preço-alvo de R$ 890,00" **(Spec)** | Inline no campo de preço |
| `CNPJ_NOT_ACTIVE` | "CNPJ com situação cadastral irregular" **(Spec F1)** + "Regularize na Receita Federal e tente novamente." | Campo CNPJ (T06) |
| `BUBBLE_EXIT_LOCKED` | "Saídas são bloqueadas na última hora para proteger o grupo" **(Spec)** | Botão "Sair" desabilitado + texto visível abaixo dele |
| `QUOTA_EXCEEDS_AVAILABLE` | "Restam só N cotas disponíveis." | Seletor de quantidade |
| `PIX_RESERVATION_EXPIRED` | "O tempo do Pix acabou e a reserva foi liberada. Nenhum valor foi cobrado." | T12p → "Tentar de novo" |
| `PAYMENT_PROVIDER_UNAVAILABLE` | "O pagamento está temporariamente indisponível. Nada foi cobrado. Tente em alguns minutos." | Modal T12 |
| `RECIPIENT_NOT_REGISTERED` | "Para vender, cadastre a conta que vai receber os repasses." | T10 → "Cadastrar conta" (T24) |
| `INVALID_PRICE_TIERS` | Por regra: "O preço não pode subir de um degrau para o seguinte." · "Cada degrau precisa de mais cotas que o anterior." · "O preço mínimo por cota é R$ 1,00." · "Use no máximo 10 degraus." · "O último degrau não pode passar da capacidade (100 cotas)." | Inline no degrau |
| `INVALID_DURATION` | "A bolha precisa durar entre 1 hora e 5 dias." | Passo Prazos |
| `INVALID_QUOTA_RANGE` | "A capacidade vai de 2 a 10.000 cotas, e a meta não pode passar da capacidade." | Passo Cotas |
| `INVALID_PJ_SHARE` | "O limite por empresa deve ficar entre 10% e 100%." | Passo Cotas |
| `INVALID_SHIPPING_DAYS` | "O prazo de envio deve ficar entre 1 e 30 dias." | Passo Prazos |
| `FIELD_LOCKED_AFTER_PUBLISH` | "Depois de publicar, só a descrição e as imagens podem ser alteradas." | Edição da bolha ativa |
| `BUBBLE_HAS_QUOTAS` | "Não é possível cancelar: já há participantes nesta bolha." | Painel do criador |
| (substituição de lance — não é erro) | "Este lance substitui o seu lance anterior de R$ 820,00." | Aviso no T16a antes de enviar |
| `BID_WITHDRAW_NOT_ALLOWED` | "A bolha já encerrou. Não é mais possível alterar o lance." | T16a |
| `BID_SELECTION_WINDOW_CLOSED` | "O prazo terminou e o menor lance foi selecionado automaticamente." | T16 |
| `SHIPPING_DEADLINE_PASSED` | "O prazo de envio terminou e este item foi cancelado. O comprador recebeu o estorno." | T17 |
| `WITHDRAWAL_WINDOW_CLOSED` | "O prazo de arrependimento terminou em 10/12." | T18/T19 |
| `TRIAGE_CASE_ALREADY_OPEN` | "Já existe um caso aberto para este item. Acompanhe por aqui." | T25 |
| `DISPUTE_WINDOW_CLOSED` | "O prazo de contestação deste evento terminou em 09/12." | T20/T21 |
| `DISPUTE_ALREADY_OPEN` | "Este evento já está em revisão." | T21 |
| `REPORT_ALREADY_SUBMITTED` | "Você já denunciou esta bolha. Obrigado!" | T03c |
| `DELETION_BLOCKED_OBLIGATIONS` | "Você ainda tem cotas ativas ou triagens abertas. A exclusão fica disponível quando elas terminarem." + lista | T23 |
| (cadastro com dados já existentes — não é erro, anti-enumeração) | "Se os dados forem válidos, enviaremos a confirmação por e-mail." | T05a/T06; o titular recebe por e-mail "Você já tem uma conta" |
| `PIX_UNAVAILABLE_LATE` | "Faltam menos de 5 minutos: use cartão para entrar." | T12 — opção Pix desabilitada com o texto |
| `PIX_TEMPORARILY_BLOCKED` | "Pix temporariamente indisponível para sua conta. Use cartão ou tente mais tarde." | T12 |
| `CREATOR_QUOTA_NOT_AUTHORIZED` | "Não foi possível autorizar sua cota. A bolha não foi publicada." **(Spec F4)** | Revisão de T11 → trocar cartão |
| `TRIAGE_NOT_LATE` | "O cancelamento só fica disponível se o vendedor atrasar o envio." | T18 |
| `TRIAGE_CASE_WINDOW_CLOSED` | "Não é mais possível abrir um caso: o prazo terminou em 10/12." | T25 |
| `CPF_INVALID` / `CNPJ_INVALID` | "Confira o CPF: os números não conferem." / "Confira o CNPJ: os números não conferem." | Campo |
| `INVALID_CREDENTIALS` | "E-mail ou senha incorretos." | T04 |
| `RATE_LIMITED` | "Muitas tentativas seguidas. Tente de novo em N segundos." | Onde ocorreu |
| `CAPTCHA_REQUIRED` | "Confirme que você é uma pessoa para continuar." | Modal de verificação |
| `INTERNAL_ERROR` / `SERVICE_UNAVAILABLE` | "Algo deu errado do nosso lado. Nada foi cobrado. Tente novamente." (+ código de suporte = `trace_id` curto) | Onde ocorreu |

---

## 4. Telas

### T01 — Canvas

**Objetivo:** descobrir bolhas e perceber, de relance, tipo, progresso, preço e urgência.

**Componentes:** superfície PixiJS (WebGL); toolbar flutuante (busca, filtros, `+`, `−`, centralizar, alternância **Canvas | Lista**); minimapa (desktop); botão "Criar"; banner de conexão; região `aria-live` (ver acessibilidade); camada DOM de foco sincronizada.

**Dados por LOD (Spec F2):**

| Zoom | Exibe |
| :--- | :--- |
| < 0,4× | Círculo por tipo + anel de progresso (+ ícones de flag) |
| 0,4×–1× | + título curto, preço atual, tempo restante |
| > 1× | + meta, próximo degrau ("faltam 5 cotas para R$ 80,00"), flags com texto, avatar/pseudônimo do criador |

**Ações:** pan (arrastar/um dedo, inércia), zoom (roda/trackpad/pinça/botões), filtrar (tipo, categoria, faixa de preço, "só as que participo"), buscar, abrir bolha (clique/toque/Enter), alternar para lista, criar.

**Wireframe (desktop, zoom ≈ 1,2×):**

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◉ Bolha Venda   [🔍 Buscar bolhas…        ]  [Venda][Compra][Categoria▾][R$▾][Participo]│
│                                                       [Canvas | Lista]   🔔3   (Carlos ▾)│
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·   │
│        ╭───────────╮                                   ┌ ─ ─ ─ ─ ─ ┐                    │
│       ╱  🏷 VENDA   ╲      ╭─────╮                       🛒 COMPRA                        │
│      │ Fone XT-500   │    │ 🏷   │                     │ 30 cadeiras │                    │
│      │ R$ 90,00      │    │R$ 45 │                       até R$ 890                       │
│      │ ◔ 65/100      │    ╰─────╯                      │ ◑ 18/30     │                    │
│      │ ⏱ 2d 04h      │                                   ⏱ 42 min ⚠                      │
│       ╲ faltam 5→R$80╱          ╭═══════════╮           └ ─ ─ ─ ─ ─ ┘                    │
│        ╰───────────╯           ║ 🏷 VENDA  ◕║  ← borda âmbar + "Quase cheia"            │
│                                ║ Kit café   ║                                           │
│                                ║ ◕ 84/100   ║                                           │
│                                ╰═══════════╯                                           │
│                                                                    ┌────────┐            │
│  ┌──────────┐                                                      │ minimap│  [ + ]     │
│  │ + Criar  │                                                      │  ▪ ▫   │  [ − ]     │
│  └──────────┘                                                      └────────┘  [ ⌖ ]     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Estados:**

| Estado | Comportamento |
| :--- | :--- |
| Carregando | Grade do canvas + bolhas-fantasma (círculos cinza pulsando suavemente; estáticos com movimento reduzido) |
| Vazio (área sem bolhas) | Card central: "Nenhuma bolha por aqui." + "Ir para a bolha mais próxima" + "Criar bolha" |
| Vazio (filtros) | "Nenhuma bolha com esses filtros." + "Limpar filtros" |
| Erro de carregamento | Mantém o que já estava; toast "Não foi possível atualizar esta área. Tentar de novo" |
| WebGL indisponível | Abre automaticamente a **Lista** com aviso "Seu navegador não suporta o mapa. Mostrando a lista." |
| Offline / WS caído | Banner; bolhas mantêm o último estado; contadores seguem localmente; ao chegar a 0 sem confirmação: "Encerrando…" |
| Sem permissão | Não se aplica (público); ações pedem login |
| Sucesso | Bolha nova publicada aparece com animação de entrada (fade com movimento reduzido) |
| Truncado (> 500 bolhas) | Aviso discreto "Aproxime para ver todas as bolhas desta área" |

**Responsivo:** mobile — toolbar recolhe em ícone de filtro (sheet de filtros), minimapa oculto, botão "Criar" na barra inferior; toque simples abre o detalhe, toque longo mostra tooltip; dois dedos = pinça. Desktop — atalhos: setas (pan), `+`/`−` (zoom), `L` (lista), `/` (busca), `Esc` (fecha detalhe).

---

### T02 — Lista (alternativa ao canvas)

**Objetivo:** mesmo conteúdo da área visível em formato linear, acessível e ordenável.

**Componentes:** cabeçalho "N bolhas nesta área"; ordenação (Termina antes · Menor preço · Mais perto da meta); filtros iguais ao canvas; lista de cartões (`<ul>`), cada cartão com: tipo (ícone + texto), título, preço atual, "faltam N para R$ X", progresso "65 de 100 cotas (meta 40)", tempo restante, flags em texto, criador (pseudônimo + faixa de score); paginação "Carregar mais" (cursor).

**Estados:** carregando (5 cartões skeleton); vazio ("Nenhuma bolha nesta área. Afaste o zoom ou limpe os filtros."); erro (padrão); offline (banner); atualização em tempo real **sem reordenar** a lista sob o foco do usuário — itens alterados recebem marca "atualizado" e a reordenação só ocorre com "Atualizar ordem (3 mudanças)".

**Responsivo:** 1 coluna (mobile), 2 colunas (tablet), lista lateral de 400 px ao lado do canvas reduzido ou tela cheia (desktop, preferência do usuário).

---

### T03 — Detalhe da bolha

**Objetivo:** entender a oferta/demanda e agir com confiança (entrar, sair, dar lance, compartilhar, denunciar).

**Componentes:** cabeçalho (tipo, título, criador por pseudônimo + faixa de score, fechar); galeria (até 5 imagens com `alt`); bloco de preço; **escada de degraus** (venda) ou **lances** (compra); progresso com marcador de meta; contador regressivo; regras resumidas (prazo de envio, teto por empresa, como funciona a reserva); participantes (pseudônimos, máx. 10 + "e mais N"); botão de ação principal fixo no rodapé; menu "⋯" (compartilhar, denunciar).

**Wireframe (drawer desktop, bolha de venda, PF logado, não participante):**

```text
                                        ┌──────────────────────────────────────────┐
                                        │ 🏷 VENDA                            [ ✕ ] │
                                        │ Fone Bluetooth XT-500                    │
                                        │ por TecnoLotes#9C1D · Score Bom (702)    │
                                        │ ┌──────────────────────────────────────┐ │
                                        │ │            [ imagem 1/3 ]   ‹  ›     │ │
                                        │ └──────────────────────────────────────┘ │
                                        │ Se fechar agora                          │
                                        │ R$ 90,00 por cota                        │
                                        │ Faltam 5 cotas para R$ 80,00             │
                                        │                                          │
                                        │ Degraus                                  │
                                        │  ✓  0 cotas ............ R$ 100,00       │
                                        │  ✓ 40 cotas (meta) ..... R$  90,00  ◀ atual
                                        │  ○ 70 cotas ............ R$  80,00       │
                                        │  ○ 100 cotas ........... R$  75,00       │
                                        │                                          │
                                        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  65 de 100 cotas    │
                                        │             ▲ meta 40 (atingida ✓)       │
                                        │ ⏱ Termina em 2d 04h 12m (26/11, 09h)     │
                                        │                                          │
                                        │ ▸ Como funciona o pagamento              │
                                        │ ▸ Envio em até 7 dias após o fechamento  │
                                        │ ▸ Participantes (65)                     │
                                        │──────────────────────────────────────────│
                                        │ Reserva: R$ 100,00 · paga o preço final  │
                                        │ [        Entrar na bolha         ]  ⋯    │
                                        └──────────────────────────────────────────┘
```

**Variações por papel/estado (`allowed_actions`):**

| Situação | Rodapé |
| :--- | :--- |
| Visitante | "Entrar na bolha" → onboarding |
| PF/PJ elegível | "Entrar na bolha" (PJ: "Entrar com cotas") |
| Participante, fora da última hora | Selo "Você participa (1 cota)" + "Sair da bolha" (secundário) |
| Participante, última hora | "Sair da bolha" desabilitado + "Saídas são bloqueadas na última hora para proteger o grupo" |
| Reserva Pix pendente | "Pague o Pix para confirmar sua cota — 12:34" + "Ver QR Code" |
| Criador | "Compartilhar" + "Editar descrição e imagens" + "Cancelar bolha" (só com 0 cotas) |
| PJ em bolha de compra | "Enviar lance" ou "Substituir meu lance" |
| Encerrada com sucesso | "A bolha fechou a R$ 80,00 por cota" + (participante) "Ver minha triagem" |
| Encerrada sem meta | "A bolha não atingiu a meta. Todo o valor reservado foi devolvido." |

**Bolha de compra:** troca a escada por "Preço-alvo: até R$ 890,00 por cota" + aba **Lances** (T03b): lista ordenada por preço — pseudônimo, faixa de score, preço, prazo, condições (expansível), "Seu lance" destacado. Vazio: "Ainda não há lances. Empresas convidadas e interessadas podem enviar até o fim da bolha."

**Estados:** carregando (skeleton do drawer, cabeçalho já com título se vindo do canvas); não encontrada ("Esta bolha não existe ou foi removida." + "Voltar ao canvas"); erro (padrão); offline (banner + ações financeiras desabilitadas); atualização ao vivo (preço e progresso animam; mudança de degrau anunciada: "Novo preço: R$ 80,00 por cota").

**Responsivo:** mobile — bottom sheet com alça; meio aberto mostra título, preço, progresso e botão; arrastar para cima abre o restante; botão de ação sempre visível. Desktop — drawer 440 px; foco vai para o título ao abrir e volta à bolha ao fechar.

---

### T12 / T12p / T12b — Entrar na bolha, Pix, Sair

**T12 — Objetivo:** confirmar a participação entendendo reserva × preço final.

**Componentes:** resumo (venda: preço atual, degrau atingido, próximos degraus, meta, prazo de envio · compra: preço-alvo, lances até agora); quantidade (PF: "1 cota" fixo com explicação "limite de 1 cota por pessoa"; PJ: stepper 1…limite, com "máx. N para sua empresa"); forma de pagamento (cartão via SDK do gateway / Pix); total reservado; texto da reserva (§2); checkbox não pré-marcado "Li e concordo com as regras desta bolha" (link); botão "Confirmar e reservar R$ 100,00".

**Estados:** processando ("Autorizando pagamento…", botão desabilitado, sem fechar com clique fora); sucesso (tela "Você está na bolha!" com preço atual, próximo degrau e "Acompanhar em Minhas cotas"); erros por código (§3) exibidos no topo do modal com foco; sem permissão (visitante → onboarding; PJ não verificada → `ACCOUNT_NOT_VERIFIED`); offline (botão desabilitado: "Sem conexão. Conecte-se para confirmar."); timeout (reenvio automático 1× com a mesma chave; depois "Não conseguimos confirmar. Verifique em Minhas cotas antes de tentar de novo." — evita cobrança duplicada).

**T12p — Pix:** QR Code + "Copiar código Pix"; contador `min(15:00, tempo restante)` (`role="timer"`); Pix não aparece como opção nos últimos 5 min da bolha nem quando a conta está bloqueada para Pix; "Sua cota fica reservada por 15:00. Pague o Pix para confirmar."; atualização automática ao confirmar (WS/notificação; polling a cada 5 s como fallback); expirado → mensagem de `PIX_RESERVATION_EXPIRED` + "Tentar de novo".

**T12b — Sair:** diálogo de confirmação (§2); botões "Continuar na bolha" (padrão/foco) e "Sair da bolha" (destrutivo); sucesso: "Você saiu da bolha. O valor reservado foi liberado." (prazo de liberação depende do banco).

**Responsivo:** mobile em tela cheia com botão fixo no rodapé; desktop em modal 520 px.

---

### T10 — Criar bolha de venda (4 passos)

**Objetivo:** publicar uma oferta coletiva correta, sem surpresas depois (oferta vinculante).

**Componentes:** indicador de passos (1 Produto · 2 Cotas · 3 Preço · 4 Prazos) + Revisão; "Rascunho salvo automaticamente às 14h03"; navegação Voltar/Continuar; prévia da bolha (desktop: coluna à direita; mobile: botão "Ver prévia").

| Passo | Campos e limites (Spec F3) |
| :--- | :--- |
| 1 Produto | Título 5–80 (contador), descrição até 2.000, categoria, até 5 imagens (texto alternativo sugerido e editável) |
| 2 Cotas | Capacidade 2–10.000; meta 1–capacidade (padrão 50%); teto por empresa 10–100% (padrão 50%) com explicação "Impede que uma única empresa compre a maior parte do lote" |
| 3 Preço | Editor de degraus (1–10): linha 1 fixa em 0 cotas (= preço inicial); "+ Adicionar degrau"; último = preço-alvo; gráfico "cotas × preço por cota"; frase-exemplo |
| 4 Prazos | Duração 1 h–5 dias (presets 24 h, 3 dias, 5 dias + personalizado); prazo de envio 1–30 dias (padrão 7) |
| Revisão | Prévia no canvas; resumo; taxa estimada 6% e repasse líquido por cota; aviso de oferta vinculante; "Publicar" |

**Wireframe (passo 3, desktop):**

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Criar bolha de venda                                   Rascunho salvo às 14h03 ✓   │
│ (1) Produto ─ (2) Cotas ─ (●3) Preço ─ (4) Prazos ─ ( ) Revisão                    │
├───────────────────────────────────────────────┬────────────────────────────────────┤
│ Degraus de preço                              │ Prévia                             │
│ Quanto mais cotas, menor o preço para todos.  │  R$                                │
│                                               │ 100 ┤████                          │
│  A partir de     Preço por cota               │  90 ┤    ██████                    │
│  [   0 ] cotas   [ R$ 100,00 ]  (inicial)     │  80 ┤          ██████              │
│  [  40 ] cotas   [ R$  90,00 ]        [🗑]    │  75 ┤                ████          │
│  [  70 ] cotas   [ R$  80,00 ]        [🗑]    │     └──┬─────┬──────┬────┬─ cotas  │
│  [ 100 ] cotas   [ R$  75,00 ]  (alvo)[🗑]    │        0    40     70  100         │
│                                               │                                    │
│  [ + Adicionar degrau ]   (4 de 10)           │ "Com 70 cotas, cada uma sai por    │
│                                               │  R$ 80,00."                        │
│  ⚠ O preço não pode subir de um degrau        │ Capacidade: 100 · Meta: 40         │
│    para o seguinte.   ← erro inline exemplo   │                                    │
├───────────────────────────────────────────────┴────────────────────────────────────┤
│ [ ← Voltar ]                                                      [ Continuar → ]  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Estados:** carregando rascunho (skeleton do passo); vazio (passo 1 com dicas "Fotos reais aumentam a confiança"); erro de validação (inline por campo, resumo no topo ao tentar continuar, foco no primeiro erro); erro de salvamento automático ("Não foi possível salvar o rascunho. Tentaremos de novo." — não bloqueia); sem permissão (`ACCOUNT_NOT_VERIFIED` / `RECIPIENT_NOT_REGISTERED` antes do passo 1, com CTA); offline (edição local continua, "Salvaremos quando a conexão voltar", "Publicar" desabilitado); sucesso ("Sua bolha está no ar!" + canvas centralizado + "Compartilhar"); limite de upload ("Imagem acima de 5 MB. Escolha uma menor.").

**Responsivo:** mobile — um passo por tela, gráfico abaixo do editor, degraus em cartões empilhados com teclado numérico (`inputmode="decimal"`); desktop — duas colunas.

### T11 — Criar bolha de compra (5 passos)

Passos (Spec F4): **Item desejado** (título, especificação, categoria, imagens opcionais) · **Cotas** (mesmas regras) · **Preço-alvo** ("O máximo que cada participante aceita pagar por cota") · **Fornecedores sugeridos** (até 5 CNPJs ou e-mails, opcional, "Convidaremos por e-mail quando a bolha for publicada") · **Duração**. Revisão com "Você ocupa automaticamente a 1ª cota" + pagamento da cota **só com cartão** (sem Pix). Recusa → "Não foi possível autorizar sua cota. A bolha não foi publicada." e a bolha continua rascunho. Estados iguais a T10.

---

### T16a — Enviar / substituir lance (PJ)

**Componentes:** preço por cota (com "Preço-alvo: até R$ 890,00 · Melhor lance atual: R$ 799,00"); prazo de entrega (dias); condições (até 1.000, contador); "Válido até o fim da bolha (26/11, 23h)"; total estimado para a capacidade atual; botão "Enviar lance" / "Substituir lance".
**Estados:** erro inline `BID_ABOVE_TARGET`; substituição pede confirmação ("Seu lance anterior de R$ 820,00 será retirado."); sucesso ("Lance enviado. Você será avisado quando a bolha encerrar."); sem permissão (`ACCOUNT_NOT_VERIFIED`; criadora não vê o botão); bolha encerrada (`BUBBLE_NOT_ACTIVE`).

### T16 — Seleção de lance (criador)

**Componentes:** contador "Escolha até 27/11, 09h41 (faltam 18 h)"; tabela/cartões de lances: pseudônimo, faixa de score, preço por cota, economia vs. preço-alvo, prazo, condições; ordenação (preço, prazo, score); botão "Escolher este lance" por item; confirmação com consequências (§2).
**Estados:** vazio ("Nenhuma empresa enviou lance. Os valores foram devolvidos a todos."); aviso T−2 h (banner âmbar com ícone + texto); janela encerrada (`BID_SELECTION_WINDOW_CLOSED`, mostra vencedor automático); sucesso ("Lance escolhido. Fornecedora ABC Ltda vai enviar os itens." — nome revelado).
**Responsivo:** cartões empilhados (mobile); tabela comparativa com cabeçalhos fixos (desktop).

---

### T17 — Triagem do vendedor

**Objetivo:** cumprir os envios no prazo e acompanhar entregas, devoluções e casos.

**Componentes:** cabeçalho (bolha, preço final, prazo de envio); contadores por status (abas/filtros): Aguardando envio · **Atrasados** (flag `is_late`, tolerância de +3 dias; "Envie até 06/12 — o comprador já pode cancelar") · Enviados · Entregues · Arrependimento · Casos · Concluídos · Cancelados; busca por pseudônimo/nome; tabela com seleção múltipla; ações: "Registrar envio", "Envio em lote (CSV)", "Ver endereço", "Confirmar devolução"; resumo de repasse ("Previsto: R$ 4.512,00 líquidos após as janelas de arrependimento").

**Wireframe (desktop):**

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Triagem · Fone Bluetooth XT-500 · fechou a R$ 80,00 · 72 compradores                 │
│ ⏱ Envie até 03/12, 12h (faltam 4 dias)                  Repasse previsto: R$ 5.414,40│
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [Aguardando 52] [Atrasados 0 ⏰] [Enviados 14] [Entregues 6] [Arrep. 0] [Casos 1 ⚑]   │
│ [🔍 Buscar comprador ]                     [ Registrar envio ] [ ⬆ Envio em lote CSV ] │
├───┬──────────────────┬──────────┬────────┬──────────────────┬────────────────────────┤
│ ☐ │ Comprador        │ Cotas    │ Valor  │ Status           │ Ação                   │
├───┼──────────────────┼──────────┼────────┼──────────────────┼────────────────────────┤
│ ☐ │ Carlos Silva     │ 1        │ 80,00  │ ◷ Aguardando env.│ [Registrar envio] [📍] │
│   │ Bolhista#4F2A    │          │        │                  │                        │
│ ☐ │ Mercadão Ltda    │ 10       │ 800,00 │ ◷ Aguardando env.│ [Registrar envio] [📍] │
│ ☐ │ Ana P.           │ 1        │ 80,00  │ 🚚 Enviado QB12… │ Previsão 04/12         │
│ ☐ │ Bolhista#77B0    │ 1        │ 80,00  │ ⚑ Caso: Não rec. │ [Ver caso]             │
├───┴──────────────────┴──────────┴────────┴──────────────────┴────────────────────────┤
│ 3 selecionados  [ Registrar envio dos selecionados ]                 ‹ 1 2 3 … ›     │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Estados:** carregando (tabela skeleton); vazio por aba ("Nenhum item aguardando envio. Tudo em dia!"); aviso de prazo (24 h antes: banner "12 envios vencem amanhã" com ícone e texto); erro de lote (`207`: "45 envios registrados. 3 linhas com erro." + linhas destacadas e editáveis); `SHIPPING_DEADLINE_PASSED` na linha; sem permissão (não é vendedor → 404 amigável); offline (banner, ações desabilitadas); sucesso ("Envio registrado. O comprador foi avisado.").
**Privacidade:** nome e endereço aparecem só a partir da captura e somem após a conclusão; botão "Ver endereço" abre painel sem copiar para a URL.
**Responsivo:** mobile — lista de cartões por comprador, ação principal no cartão, envio em lote disponível só no desktop (mensagem "Use um computador para envio em lote").

### T18 / T19 / T25 — Item de triagem do comprador, Arrependimento, Caso

**T18 componentes:** linha do tempo vertical (Pago → Aguardando envio → Enviado → Entregue → Janela de arrependimento → Concluído) com datas e prazos; valores ("Reservado R$ 100,00 · Pago R$ 80,00 · Liberado R$ 20,00"); vendedor (nome a partir da captura + pseudônimo + score); rastreio; ações conforme status: "Confirmar recebimento", "Não recebi", "Produto diferente", "Produto com defeito" (casos só em Enviado/Entregue, até o fim da janela de arrependimento), "Desistir da compra"; com o item **atrasado**: banner âmbar com ícone de relógio + "O vendedor ainda não enviou. Você pode aguardar até 06/12 ou cancelar com estorno integral." e botão "Cancelar com estorno integral".
**Estados:** captura falhou ("Não conseguimos confirmar seu pagamento e este item foi cancelado. Nenhum valor foi cobrado."); vendedor atrasou (item cancelado + estorno); caso aberto ("Caso em análise. O repasse ao vendedor está suspenso."); concluído ("Compra concluída. Obrigado!").
**T19:** texto de direito ("Você pode desistir da compra até 10/12, sem precisar justificar."), motivo opcional, instruções de devolução, confirmação; após confirmar, campo de rastreio da devolução; janela encerrada → `WITHDRAWAL_WINDOW_CLOSED`.
**T25:** tipo do caso, descrição, anexos (até 5, 5 MB cada, JPG/PNG/PDF), "O caso pausa os prazos e o repasse ao vendedor até a decisão da moderação."; sucesso "Caso aberto. Responderemos em até 5 dias úteis."; decisão exibida como: "Estorno total" (item cancelado), "Estorno parcial de R$ X" (item concluído com valor reduzido) ou "Caso improcedente — os prazos foram retomados".

### T20 / T21 — Meu score e Contestação

**T20:** valor + faixa com rótulo textual (Risco/Regular/Bom/Excelente — cor nunca sozinha) e posição numa régua 0–1000; "Como o score é calculado" (eventos, pesos, meia-vida de 180 dias, versão do modelo); lista de eventos: data, descrição, pontos (+/−), peso atual, status (Conta / Em revisão / Revertido), "Contestar" quando elegível com prazo. Vazio: "Você ainda não tem eventos. Seu score começa em 500."
**T21:** evento contestado (resumo), justificativa (obrigatória, até 2.000), anexos, aviso "Enquanto estiver em revisão, este evento não conta no seu score."; sucesso "Contestação enviada. Decisão em até 5 dias úteis."; erros `DISPUTE_WINDOW_CLOSED`/`DISPUTE_ALREADY_OPEN`.

### T22 — Notificações

Painel (desktop: popover 380 px; mobile: tela) com lista agrupada (Hoje, Esta semana); item = ícone por tipo + título + corpo + tempo + link; "Marcar todas como lidas". Vazio: "Nada por aqui ainda." Badge com contagem (texto acessível "3 notificações não lidas").

### T04 / T05 / T05a / T06 — Entrar e cadastro

- **T04:** e-mail, senha (mostrar/ocultar), "Entrar com Google", "Esqueci minha senha"; erro `INVALID_CREDENTIALS`; após 3 falhas, CAPTCHA.
- **T05:** dois cartões grandes: "Pessoa física — entre com 1 cota por bolha e crie bolhas de compra" · "Empresa — compre várias cotas, venda em lote e dê lances".
- **T05a:** nome, e-mail, senha (regras visíveis), CPF com máscara, aceite de termos/privacidade (não pré-marcados), marketing opcional.
- **T06:** dados da PF responsável + CNPJ; ao sair do campo CNPJ: "Consultando a Receita…" → razão social e CNAE para confirmar; `CNPJ_NOT_ACTIVE` bloqueia; provedor fora → "Não conseguimos consultar o CNPJ agora. Sua conta será criada e verificaremos automaticamente nas próximas 24 h. Enquanto isso, você pode navegar."
- **Envio do cadastro (T05a/T06):** sempre a mesma tela, exista ou não conta com aqueles dados: "Se os dados forem válidos, enviaremos a confirmação por e-mail." + "Reenviar e-mail" (após 60 s). A conta só é ativada pelo link de confirmação.
- Boas-vindas: "Seu nome público é **Bolhista#4F2A**. É só ele que aparece para os outros." + "Trocar apelido".

### T13 / T14 / T15 — Minhas bolhas, cotas, lances

Listas com abas por status e cartões com a próxima ação em destaque ("Escolha o lance até 27/11", "12 envios pendentes", "Pague o Pix — 12:34"). Vazios: T13 "Você ainda não criou bolhas." + "Criar bolha" · T14 "Você ainda não entrou em nenhuma bolha." + "Explorar o canvas" · T15 "Nenhum lance enviado." + "Ver bolhas de compra".

### T23 — Conta e privacidade

Seções: Dados e apelido (sufixo fixo explicado) · Endereço de entrega · Empresa e CNPJ (status, última verificação, próxima revalidação, "Verificar agora") · Consentimentos (histórico com versões) · Preferências (e-mails não transacionais; **"Reduzir animações"**) · Exportar meus dados ("Prepararemos um arquivo JSON e avisaremos quando estiver pronto — em até 15 dias.") · Excluir conta (bloqueio explicado com lista de pendências; confirmação com senha; "Seus dados pessoais serão anonimizados. Registros fiscais ficam guardados pelo prazo legal.").

### T24 — Recebimentos

Cadastro de recebedor (status Pendente/Aprovado/Recusado); lista de repasses com bruto, taxa da plataforma (6%), taxa do gateway, líquido, data prevista e status (Previsto, Retido por caso, Liberado). Vazio: "Seus repasses aparecerão aqui depois das primeiras vendas."

### A1 — Fila de moderação (admin)

Tabela única com tipo (Denúncia, Caso de triagem, Contestação, Devolução sem confirmação), prioridade, prazo (SLA de 5 dias úteis para contestações), valor envolvido; painel de detalhe com evidências e histórico; ações com **motivo obrigatório** (Suspender bolha — estorno 100% · Suspender conta · Decidir caso — estorno total/parcial/liberar repasse · Decidir contestação — procedente/improcedente · Arquivar). Confirmação dupla para ações financeiras. Desktop-first; mobile somente leitura.

---

## Fontes consultadas (AlterEgo)

- **ux-ui-design** — *Introdução e boas práticas em UX Design* (Casa do Código), cap. 3, p. 64–67: o wireframe documenta "variações e estados diferentes do sistema" (logado/deslogado, listagem com zero, um ou duzentos itens) e não mostra layout final nem identidade visual → tabela de estados por tela e wireframes low-fi.
- **ux-ui-design** — *Theming — shadcn/ui*: papéis de tokens (`muted` para estados vazios e texto auxiliar, `destructive` para ações destrutivas e estados inválidos, `ring` para foco) → padrões de §1.4 e botões destrutivos (Sair, Excluir).
- **asias-design-interacao** — *Skill*, tabela de decisão "Feedback/Response Time" (< 0,1 s sem spinner; 0,1–1 s; > 10 s com progresso e liberar o usuário) → §1.3; slip × mistake (confirmação + desfazer para ações destrutivas; esclarecer o modelo mental da reserva × preço final).
- **asias-design-interacao** — *10 Usability Heuristics for User Interface Design* (Jakob Nielsen, NN/g, rev. 2024): visibilidade do status, linguagem do usuário ("reserva" em vez de "pré-autorização"), saída de emergência clara, mensagens de erro que oferecem a correção → §2 e §3.
- **frontend-dev** — *Client-side data fetching: SWR | Next.js*: dados otimistas com rollback e revalidação ao reconectar → estados offline/timeout de T01 e T12 (reenvio com a mesma chave, verificação antes de nova tentativa).
