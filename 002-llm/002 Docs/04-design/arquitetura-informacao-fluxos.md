# Arquitetura de Informação e Fluxos de Interação — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · [Plano v2](../planing-project.md) · [Style guide](../style-guide.md) · [Use flows](../../003%20diagrams/use-flows.md) · [Casos de uso](../../003%20diagrams/use-case.md)

> Entregável do épico E0 ("protótipo navegável do canvas, detalhe da bolha, criação, triagem"). Serve de roteiro para o protótipo Figma testado no Gate A ([plano-pesquisa-usuario.md](plano-pesquisa-usuario.md)) e para a [especificação de telas](especificacao-telas.md). Contratos: [API REST](../05-arquitetura/api-rest.md) e [WebSocket](../05-arquitetura/api-websocket.md). Em conflito, **a Spec prevalece**.
> Assume a máquina de estados **ADR-0009 (proposto)**: `DRAFT → ACTIVE → EXPIRED_SUCCESS | EXPIRED_FAILED → IN_TRIAGE → COMPLETED | CANCELLED`; `NEAR_FULL`/`EXPIRING` são **flags**, não estados.

---

## 1. Princípios de organização

1. **O canvas é a home.** A navegação primária é espacial (pan/zoom 0,1×–4×). Tudo o que se abre a partir de uma bolha abre **sobre** o canvas (drawer no desktop, bottom sheet no mobile), preservando o contexto — o usuário nunca perde o lugar no mapa.
2. **Toda bolha tem URL própria** (`/b/{id}`): compartilhável; abre o canvas centrado na bolha com o detalhe aberto. Sem WebGL, a mesma URL renderiza a página de detalhe completa (SSR).
3. **Alternância "Canvas | Lista"** sempre visível: a lista mostra as mesmas bolhas da área visível, ordenáveis e navegáveis por teclado (Spec F2, RF02.3).
4. **Ações dependem do papel, não da tela:** o detalhe da bolha é um só; os botões vêm de `allowed_actions`/`blocked_actions` da API (visitante, PF, PJ, criador, participante).
5. **"Minha área" reúne o que exige ação** — cotas, bolhas criadas, lances, triagem, score, recebimentos — com contadores de pendência.
6. Navegação global: barra superior (desktop) / barra inferior com 4 itens + botão central "Criar" (mobile).
7. **Visitante navega livremente**; qualquer ação (entrar, criar, dar lance, denunciar) pede login e devolve o usuário ao ponto de origem.

---

## 2. Mapa do site

```mermaid
flowchart TD
    ROOT(("bolhavenda.com.br"))

    ROOT --> PUB["Área pública"]
    PUB --> T01["T01 Canvas /"]
    PUB --> T02["T02 Lista - mesma área visível"]
    T01 --> T03["T03 Detalhe da bolha /b/:id"]
    T02 --> T03
    T03 --> T03b["T03b Aba Lances - bolha de compra"]
    T03 --> T03c["T03c Denunciar bolha"]
    PUB --> T07["T07 Perfil público e score /u/:pseudonimo"]
    PUB --> T08["T08 Termos, Privacidade, Como funciona"]
    PUB --> T09["T09 Ajuda / FAQ"]

    ROOT --> AUTH["Autenticação"]
    AUTH --> T04["T04 Entrar /entrar"]
    AUTH --> T05["T05 Cadastro: PF ou PJ /cadastro"]
    T05 --> T05a["T05a Cadastro PF"]
    T05 --> T06["T06 Cadastro PJ + verificação CNPJ"]
    AUTH --> T04b["T04b Recuperar senha"]

    ROOT --> ACT["Ações transacionais - modais/sheets"]
    ACT --> T12["T12 Entrar na bolha - resumo + pagamento"]
    ACT --> T12p["T12p Pix: QR Code + reserva 15 min"]
    ACT --> T12b["T12b Sair da bolha - confirmação"]
    ACT --> T16a["T16a Enviar / substituir lance"]

    ROOT --> CRIAR["Criar /criar"]
    CRIAR --> T10["T10 Bolha de venda - 4 passos"]
    CRIAR --> T11["T11 Bolha de compra - 5 passos"]

    ROOT --> ME["Minha área /eu"]
    ME --> T13["T13 Minhas bolhas"]
    T13 --> T16["T16 Seleção de lance"]
    T13 --> T17["T17 Triagem do vendedor"]
    ME --> T14["T14 Minhas cotas"]
    T14 --> T18["T18 Item de triagem do comprador"]
    T18 --> T19["T19 Arrependimento"]
    T18 --> T25["T25 Caso de triagem: Não recebi / Produto diferente"]
    ME --> T15["T15 Meus lances - PJ"]
    ME --> T20["T20 Meu score"]
    T20 --> T21["T21 Contestação"]
    ME --> T22["T22 Notificações"]
    ME --> T24["T24 Recebimentos e recebedor"]
    ME --> T23["T23 Conta e privacidade"]
    T23 --> T23a["Dados, apelido e endereço"]
    T23 --> T23b["Empresa e CNPJ - PJ"]
    T23 --> T23c["Consentimentos"]
    T23 --> T23d["Exportar meus dados"]
    T23 --> T23e["Excluir conta"]
    T23 --> T23f["Notificações e acessibilidade - reduzir animações"]

    ROOT --> ADM["Admin /admin"]
    ADM --> A1["A1 Fila de moderação"]
    A1 --> A2["A2 Denúncias de bolha"]
    A1 --> A3["A3 Casos de triagem"]
    A1 --> A4["A4 Contestações de score"]
    ADM --> A5["A5 Contas"]
    ADM --> A6["A6 Saúde de timers e filas"]
    ADM --> A7["A7 Trilha de auditoria"]
```

---

## 3. Inventário de telas

| ID | Tela | Rota | Acesso | Propósito | Endpoints principais |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T01 | Canvas | `/` | público | Explorar bolhas no espaço; progresso, preço e tempo ao vivo; LOD por zoom | `GET /bubbles?bbox`, WS `viewport.set` |
| T02 | Lista | `/?vista=lista` | público | Mesmas bolhas da área visível, ordenáveis por tempo, preço, progresso; `aria-live` | `GET /bubbles?view=list&bbox` |
| T03 | Detalhe da bolha | `/b/{id}` | público (ações exigem login) | Entender oferta/demanda, degraus, meta, prazo; agir | `GET /bubbles/{id}`, WS `bubble:{id}` |
| T03b | Aba Lances | `/b/{id}/lances` | público | Lances em bolha de compra (pseudônimo, preço, prazo, score) | `GET /bubbles/{id}/bids` |
| T03c | Denunciar | sheet sobre T03 | autenticado | Categoria (proibido, enganoso, fraude, outro) + detalhes | `POST /bubbles/{id}/reports` |
| T04 | Entrar | `/entrar` | anônimo | E-mail/senha ou Google | `POST /auth/login` |
| T04b | Recuperar senha | `/senha` | anônimo | Redefinir senha | `POST /auth/password/*` |
| T05 | Cadastro — escolha | `/cadastro` | anônimo | PF ou PJ, explicando 1 cota × N cotas e lances | — |
| T05a | Cadastro PF | `/cadastro/pf` | anônimo | Conta CPF | `POST /auth/register` |
| T06 | Cadastro PJ | `/cadastro/pj` | anônimo | PF responsável + CNPJ com verificação | `POST /auth/register` |
| T07 | Perfil público | `/u/{pseudonimo}` | público | Score, faixa, transações concluídas (sem PII) | `GET /accounts/{id}/score` |
| T08 | Institucional | `/termos`, `/privacidade`, `/como-funciona` | público | Termos versionados, política LGPD, explicação de cotas/explosão/triagem | — |
| T09 | Ajuda | `/ajuda` | público | FAQ por tarefa | — |
| T10 | Criar bolha de venda | `/criar/venda` | PJ verificada ou PF recebedora | Produto → Cotas → Preço (degraus) → Prazos; rascunho automático | `POST /bubbles`, `PATCH`, `POST /publish` |
| T11 | Criar bolha de compra | `/criar/compra` | PF ou PJ verificada | Item → Cotas → Preço-alvo → Fornecedores → Duração + pagamento da cota do criador | `POST /bubbles`, `POST /publish` |
| T12 | Entrar na bolha | modal sobre T03 | autenticado | Resumo, quantidade (PJ), forma de pagamento, reserva × preço final | `POST /bubbles/{id}/quotas` |
| T12p | Pix | modal | autenticado | QR Code, copia-e-cola, contador da reserva `min(15 min, tempo restante)` | `GET /payments/{id}` |
| T12b | Sair da bolha | diálogo | participante | Confirmar saída e liberação | `DELETE /bubbles/{id}/quotas/me` |
| T13 | Minhas bolhas | `/eu/bolhas` | autenticado | Rascunhos, ativas, seleção de lance, envios pendentes | `GET /me/bubbles` |
| T14 | Minhas cotas | `/eu/cotas` | autenticado | Participações, reservas, pagamentos, itens de triagem | `GET /me/quotas` |
| T15 | Meus lances | `/eu/lances` | PJ | Lances ativos, substituídos, selecionados, não selecionados | `GET /me/bids` |
| T16 | Seleção de lance | `/eu/bolhas/{id}/lances` | criador (compra) | Comparar e escolher em 24 h | `POST …/bids/{bidId}/select` |
| T16a | Enviar/substituir lance | sheet sobre T03 | PJ verificada | Preço ≤ preço-alvo, prazo, condições (≤ 1.000 car.) | `POST …/bids` (novo lance substitui o anterior) |
| T17 | Triagem do vendedor | `/eu/bolhas/{id}/triagem` | vendedor | Envios (individual/lote), entregas, devoluções, casos | `GET /triage/items?role=seller`, `POST …/shipment` |
| T18 | Item de triagem | `/eu/cotas/{id}` | comprador | Valor pago e liberado, rastreio, confirmar recebimento | `GET /triage/items/{id}`, `POST …/delivery-confirmation` |
| T19 | Arrependimento | sheet sobre T18 | comprador | Direito de 7 dias, instruções de devolução | `POST …/withdrawal`, `POST …/return-shipment` |
| T25 | Caso de triagem | sheet sobre T18 | comprador (vendedor anexa evidências) | "Não recebi", "Produto diferente", "Produto com defeito" — em `SHIPPED`/`DELIVERED` até o fim da janela de arrependimento | `POST /triage/items/{id}/cases` |
| T20 | Meu score | `/eu/score` | autenticado | Score, faixa, eventos com pontos, motivo e versão do modelo | `GET /me/score/events` |
| T21 | Contestação | `/eu/score/{eventId}/contestar` | dono | Contestar em até 5 dias com anexos | `POST /score-events/{id}/disputes` |
| T22 | Notificações | painel + `/eu/notificacoes` | autenticado | Central (F11) | `GET /me/notifications`, WS `notification.created` |
| T23 | Conta e privacidade | `/eu/conta` | autenticado | Dados, apelido, endereço, CNPJ, consentimentos, exportar/excluir, preferências | `/me`, `/me/consents`, `/me/data-exports`, `/me/deletion-request` |
| T24 | Recebimentos | `/eu/recebimentos` | vendedor | Cadastro de recebedor; repasses (bruto, taxa 6%, líquido, retidos por caso) | `/me/payout-recipient`, `GET /me/payouts` |
| A1–A7 | Admin | `/admin/*` | moderator/admin | Fila única (denúncias, casos, contestações), contas, operação, auditoria | `/admin/*` |

---

## 4. Fluxos de interação

Convenção: retângulos = telas/estados de UI; losangos = decisões; `⚠ CÓDIGO` = erro de negócio da [API REST §1.4.1](../05-arquitetura/api-rest.md) (mensagens exatas em [especificacao-telas.md §3](especificacao-telas.md)).

### 4.1 Onboarding PF / PJ (com verificação de CNPJ)

```mermaid
flowchart TD
    S([Visitante tenta agir: entrar, criar, dar lance, denunciar]) --> GATE["Sheet: 'Entre ou crie sua conta para continuar'"]
    GATE -->|Já tenho conta| LOGIN[T04 Entrar] --> BACK
    GATE -->|Criar conta| T05{T05 Como você vai usar?}
    T05 -->|Pessoa física| PF[T05a Nome, e-mail, senha ou Google, CPF]
    T05 -->|Empresa| PJ[T06 Dados da PF responsável + CNPJ]
    PJ --> CNPJQ[Consulta BrasilAPI → fallback ReceitaWS]
    CNPJQ --> SIT{Situação cadastral}
    SIT -->|ATIVA| PREF[Mostra razão social e CNAE para confirmar]
    SIT -->|Inativa, suspensa ou baixada| ERRC["⚠ CNPJ_NOT_ACTIVE: 'CNPJ com situação cadastral irregular' - cadastro bloqueado"]
    SIT -->|Provedores fora| PEND["Conta criada 'Verificação pendente' - navega, mas não cria bolha, não entra em cota, não dá lance - nova tentativa a cada 15 min por 24 h"]
    PF --> TERMS
    PREF --> TERMS[Aceite de Termos e Política de Privacidade - versões exibidas - marketing opcional desmarcado]
    PEND --> TERMS
    TERMS --> SUBMIT{POST /auth/register}
    SUBMIT -->|202 sempre - anti-enumeração| MAIL["'Se os dados forem válidos, enviaremos a confirmação por e-mail.'"]
    MAIL -->|Dados novos: link de confirmação| CONFM{POST /auth/email/confirm}
    MAIL -->|E-mail ou documento já cadastrado| DUP["E-mail ao titular: 'Você já tem uma conta - entre ou recupere a senha'"]
    CONFM -->|201| PSEUDO["Boas-vindas: 'Seu nome público é Bolhista#4F2A' - pode trocar o apelido - o sufixo é fixo"]
    SUBMIT -->|⚠ CPF_INVALID / CNPJ_INVALID| FIX[Erro no campo, foco no campo] --> T05
    PSEUDO --> TOUR{Tour de 3 passos? cotas, preço por degraus, explosão}
    TOUR -->|Sim| TOURS[Tour pulável, não bloqueante] --> BACK
    TOUR -->|Pular| BACK([Volta à ação original com contexto preservado])
```

### 4.2 Navegar no canvas

```mermaid
flowchart TD
    A([Abrir /]) --> L[Shell + snapshot da viewport inicial]
    L --> WS{WebSocket conectado?}
    WS -->|Sim| LIVE[Canvas ao vivo]
    WS -->|Não| STALE["Banner 'Reconectando… os dados podem estar desatualizados'"] --> LIVE
    LIVE --> ACT{Ação do usuário}
    ACT -->|Arrastar / um dedo| PAN[Pan com inércia]
    ACT -->|Roda, trackpad, pinça, botões + e −| ZOOM["Zoom 0,1×–4× → troca LOD: <0,4× círculo + anel - 0,4–1× + título, preço, tempo - >1× + meta, próximo degrau, flags, criador"]
    PAN --> VP[viewport.set com debounce 250 ms → tiles novos → snapshot só dos novos] --> LIVE
    ZOOM --> VP
    ACT -->|Filtros: tipo, categoria, faixa de preço, só as que participo| FIL[Aplica filtro + query] --> LIVE
    ACT -->|Alternar Canvas / Lista| LIST[T02 - mesma área e filtros] --> LIVE
    ACT -->|Hover ou foco numa bolha| TIP[Tooltip: título, preço atual, cotas, tempo] --> LIVE
    ACT -->|Clique, toque ou Enter| DET([T03 Detalhe - URL /b/:id])
    LIVE -->|bubble.updated - máx. 1 a cada 100 ms por bolha| PULSE[Anima o anel e atualiza o preço - descarta version antiga] --> LIVE
    LIVE -->|bubble.exploded| EXP[Explosão - ou fade com movimento reduzido → bolha esmaecida por 24 h] --> LIVE
    LIVE -->|Área sem bolhas| EMPTY["'Nenhuma bolha por aqui' + 'Ir para a bolha mais próxima' + 'Criar bolha'"]
```

### 4.3 Detalhe da bolha

```mermaid
flowchart TD
    O([T03 aberto]) --> SUB[bubble.subscribe + GET /bubbles/:id]
    SUB --> ST{status}
    ST -->|ACTIVE| ACTV["Venda: preço atual, degrau atingido, próximos degraus, meta, prazo de envio. Compra: preço-alvo e lances recebidos"]
    ST -->|EXPIRED_SUCCESS / IN_TRIAGE / COMPLETED| CLOSED[Resultado: preço final, motivo - tempo ou lotação - link para minha triagem]
    ST -->|EXPIRED_FAILED / CANCELLED| FAILED["'Não atingiu a meta - valores 100% devolvidos'"]
    ACTV --> ROLE{allowed_actions / blocked_actions}
    ROLE -->|JOIN_QUOTA| JOIN["'Entrar na bolha'"] --> F44([Fluxo 4.4])
    ROLE -->|LEAVE_QUOTA| LEAVE["Selo 'Você participa' + 'Sair da bolha'"] --> F44
    ROLE -->|BUBBLE_EXIT_LOCKED| LOCK["'Sair da bolha' desabilitado: 'Saídas são bloqueadas na última hora para proteger o grupo'"]
    ROLE -->|SUBMIT_BID / REPLACE_BID| BID["'Enviar lance' ou 'Substituir meu lance'"] --> F47([Fluxo 4.7])
    ROLE -->|visitante| LOGIN([Onboarding 4.1])
    ROLE -->|criador| OWN["Painel do criador: compartilhar, editar descrição/imagens, cancelar se 0 cotas"]
    ACTV -->|Compartilhar| SH[Copiar link /b/:id]
    ACTV -->|Denunciar| REP["T03c: categoria + detalhes → 'Denúncia recebida'"]
    ACTV -->|Fechar - Esc, X, voltar| CL[bubble.unsubscribe - foco volta à bolha de origem]
```

### 4.4 Entrar e sair de cota com pagamento

```mermaid
flowchart TD
    A([Clique em 'Entrar na bolha']) --> AUTH{Logado?}
    AUTH -->|Não| ONB([Onboarding 4.1, volta aqui])
    AUTH -->|Sim| CR{É o criador?}
    CR -->|Sim| NOJ["⚠ CREATOR_CANNOT_JOIN - botão nem aparece - mensagem se via URL"]
    CR -->|Não| RES["T12 Resumo: Venda = preço atual, degrau, próximos degraus, meta, prazo de envio. Compra = preço-alvo, lances até agora"]
    RES --> QTY{PF ou PJ?}
    QTY -->|PF| Q1[Quantidade fixa 1]
    QTY -->|PJ| QN["Seletor 1…limite disponível - mostra 'máx. N cotas para sua empresa'"]
    Q1 --> EXPL
    QN --> EXPL["'Reservamos R$ X por cota agora - preço inicial / preço-alvo. Você paga o preço final, que pode ser menor - a diferença é liberada.'"]
    EXPL --> PM{Forma de pagamento}
    PM -->|Cartão| CARD[SDK do gateway → card_token]
    PM -->|Pix| PIX[Pix]
    CARD --> CONF[Confirmar - gera Idempotency-Key]
    PIX --> CONF
    CONF --> POST{POST /bubbles/:id/quotas}
    POST -->|201 cartão AUTHORIZED| OK["'Você está na bolha!' + preço atual + próximo degrau"]
    PM -->|Pix com menos de 5 min para o fim| NOPIX["Pix indisponível: ⚠ PIX_UNAVAILABLE_LATE - 'Faltam menos de 5 minutos: use cartão para entrar.'"] --> CARD
    PM -->|Pix bloqueado: 3 reservas expiradas em 24 h ou 3 abertas| BLKPIX["⚠ PIX_TEMPORARILY_BLOCKED - só cartão"] --> CARD
    POST -->|201 Pix RESERVED| QR["T12p: QR Code + copia-e-cola + 'Sua cota fica reservada por MM:SS' - prazo = min 15 min e tempo restante"]
    QR -->|Pago - webhook| OK
    QR -->|Prazo sem pagamento| EXPQ["⚠ PIX_RESERVATION_EXPIRED: reserva liberada, sem penalidade"] --> RES
    POST -->|⚠ QUOTA_SOLD_OUT| SOLD["'As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.'"]
    POST -->|⚠ QUOTA_SOLD_OUT com reservas pendentes| SOLDR["'Cotas esgotadas — N reservas aguardando pagamento' + 'Avise-me se uma vaga reabrir'"]
    POST -->|⚠ PF_QUOTA_LIMIT| ALR["'Você já participa desta bolha (limite de 1 cota por pessoa).'"]
    POST -->|⚠ PJ_SHARE_EXCEEDED| ADJ["'Sua empresa pode ocupar no máximo N cotas nesta bolha.'"] --> QN
    POST -->|⚠ PAYMENT_DECLINED| DEC["'O pagamento não foi autorizado. Tente outra forma de pagamento.'"] --> PM
    POST -->|⚠ ACCOUNT_NOT_VERIFIED| VER["'Conclua a verificação do CNPJ para participar.'"]
    POST -->|⚠ BUBBLE_NOT_ACTIVE| FIM["'Esta bolha já foi encerrada.'"]
    POST -->|Rede caiu / timeout| RETRY[Reenvia com a MESMA Idempotency-Key] --> POST
    OK --> WAIT([Acompanha em T14 Minhas cotas])

    WAIT --> L1([Quer sair]) --> CHK{ACTIVE e fora da última hora?}
    CHK -->|Sim| DLG["T12b: 'Sair da bolha? A reserva de R$ X será liberada e o preço recalculado para todos.'"]
    DLG -->|Sair| DEL{DELETE /bubbles/:id/quotas/me}
    DEL -->|200| REL["'Você saiu da bolha. O valor reservado foi liberado.'"]
    CHK -->|Última hora| LOCKED["⚠ BUBBLE_EXIT_LOCKED: botão desabilitado com 'Saídas são bloqueadas na última hora para proteger o grupo'"]
```

### 4.5 Criar bolha de venda (com degraus)

```mermaid
flowchart TD
    S([Criar → 'Vender em grupo']) --> V{Pode vender?}
    V -->|PJ não verificada| BLK["⚠ ACCOUNT_NOT_VERIFIED → T23 Empresa e CNPJ"]
    V -->|PF sem recebedor| RCV["⚠ RECIPIENT_NOT_REGISTERED: 'Cadastre a conta para receber os repasses' → T24"]
    V -->|OK| P1["1 Produto: título 5–80, descrição até 2.000, categoria, até 5 imagens"]
    P1 --> P2["2 Cotas: capacidade 2–10.000 - meta 1–capacidade, padrão 50% - teto por empresa 10–100%, padrão 50%"]
    P2 --> P3["3 Preço: editor de degraus - 1º em 0 cotas = preço inicial - último = preço-alvo - 1 a 10 degraus"]
    P3 --> VAL{Validação ao vivo}
    VAL -->|Limite não crescente / preço que sobe / < R$ 1,00 / > 10 degraus| ERRT["⚠ INVALID_PRICE_TIERS inline no degrau"] --> P3
    VAL -->|OK| PREV["Gráfico 'cotas × preço por cota' + 'Com 70 cotas, cada uma sai por R$ 80,00'"]
    PREV --> P4["4 Prazos: duração 1 h–5 dias - prazo de envio 1–30 dias, padrão 7"]
    P4 --> REV["Revisão: prévia da bolha no canvas, regras, taxa estimada 6%, aviso 'preço, cotas e prazo não poderão ser alterados após publicar'"]
    REV -->|Sair a qualquer momento| DRAFT[Rascunho salvo automaticamente - só o criador vê - retoma em T13]
    REV -->|Publicar| PUB{POST /bubbles/:id/publish}
    PUB -->|200 ACTIVE| DONE["'Sua bolha está no ar!' → canvas centralizado na posição definida pelo sistema + compartilhar"]
    PUB -->|⚠ INVALID_DURATION / RATE_LIMITED| FIX[Explica e volta ao passo]
```

### 4.6 Criar bolha de compra

```mermaid
flowchart TD
    S([Criar → 'Comprar em grupo']) --> P1["1 Item desejado: título, descrição/especificação, categoria, imagens de referência opcionais"]
    P1 --> P2["2 Cotas: capacidade, meta, teto por empresa - mesmas regras da venda"]
    P2 --> P3["3 Preço-alvo: preço máximo aceitável por cota - é o valor que cada participante autoriza"]
    P3 --> P4["4 Fornecedores sugeridos: até 5 CNPJs ou e-mails - opcional"]
    P4 --> P5["5 Duração: 1 h–5 dias"]
    P5 --> REV["Revisão: 'Empresas darão lances até R$ 890,00. Você escolhe o vencedor em até 24 h após a explosão - sem escolha, vence o menor preço.'"]
    REV --> MYQ["'Você ocupa automaticamente a 1ª cota' - autorizar R$ 890,00 no cartão - só cartão"]
    MYQ --> PUB{POST /bubbles/:id/publish com pagamento}
    PUB -->|200| DONE["Bolha no ar → canvas + 'Avisaremos quando chegar o primeiro lance'"]
    PUB -->|⚠ CREATOR_QUOTA_NOT_AUTHORIZED| PAYERR["'Não foi possível autorizar sua cota. A bolha não foi publicada.' - continua rascunho - trocar cartão"] --> MYQ
    PUB -->|⚠ INVALID_DURATION / INVALID_QUOTA_RANGE| FIX[Volta ao passo com erro] --> P2
```

### 4.7 Enviar/substituir lance (PJ) e selecionar lance (criador)

```mermaid
flowchart TD
    subgraph PJ["Empresa - enviar lance"]
      B0([T03 de bolha de compra ACTIVE]) --> B1{PJ verificada e não é a criadora?}
      B1 -->|Não verificada| B1x["⚠ ACCOUNT_NOT_VERIFIED"]
      B1 -->|Sim| B2["T16a: preço por cota - mostra preço-alvo e melhor lance atual - prazo de entrega em dias - condições até 1.000 caracteres - validade = fim da bolha"]
      B2 --> B3{"unit_price ≤ preço-alvo?"}
      B3 -->|Não| B3x["⚠ BID_ABOVE_TARGET: 'O lance precisa ser igual ou menor que o preço-alvo de R$ X'"] --> B2
      B3 -->|Sim| B4{Já tenho lance ativo?}
      B4 -->|Não| B5{POST /bubbles/:id/bids}
      B4 -->|Sim| B6["Aviso: 'Este lance substitui o seu lance anterior de R$ Y'"] --> B5
      B5 -->|201| B8["'Lance enviado' - aparece como 'Seu lance' - anterior fica WITHDRAWN"]
      B8 --> B9([Após a explosão: notificação 'Seu lance foi selecionado' ou 'não foi selecionado'])
    end

    subgraph CR["Criador - selecionar lance"]
      C0(["Explosão com sucesso - 'Escolha o lance em até 24 h'"]) --> C1["T16: lances por preço - prazo, condições, score - contador de 24 h - aviso em T−2 h"]
      C1 --> C2{Há lances válidos?}
      C2 -->|Não| C3["'Nenhuma empresa enviou lance - valores devolvidos' → CANCELLED"]
      C2 -->|Sim| C4["Confirmar: 'Escolher Fornecedor#A31F por R$ 799,00 por cota? Todos pagarão este valor e a diferença para R$ 890,00 será liberada.'"]
      C4 --> C5{POST …/bids/:bidId/select}
      C5 -->|200| C6["IN_TRIAGE - nome da empresa vencedora revelado aos participantes"]
      C5 -->|⚠ BID_SELECTION_WINDOW_CLOSED| C7["'O prazo terminou e o menor lance foi selecionado automaticamente.'"]
      C1 -->|24 h sem escolha| C8[Menor preço - empate = mais antigo] --> C6
    end
```

### 4.8 Painel de triagem — vendedor

```mermaid
flowchart TD
    A([Explosão com sucesso → captura → IN_TRIAGE]) --> N["Notificação: 'Hora de enviar! Prazo: 7 dias'"]
    N --> T17["T17: contadores por status - aguardando envio, enviados, entregues, casos - prazo - compradores com nome e endereço só deste negócio"]
    T17 --> F{Ação}
    F -->|Envio individual| S1[Transportadora + código de rastreio] --> P1{POST …/shipment}
    F -->|Envio em lote| S2[Colar/importar CSV: item + código] --> P2{POST /triage/shipments:batch}
    P2 -->|207 parcial| S3[Linhas com erro para corrigir]
    P1 -->|200| SH["SHIPPED - +5 no prazo, −15 se enviado na tolerância"]
    P1 -->|⚠ SHIPPING_DEADLINE_PASSED| LATE["Tolerância esgotada: item já cancelado, comprador estornado, −60 no score"]
    T17 -->|shipping_days vencido sem envio| LTS["Aba 'Atrasados': 'Envie até 06/12 - tolerância de 3 dias. O comprador já pode cancelar.'"] --> S1
    LTS -->|Comprador cancelou| CAN["Item cancelado: estorno integral, −60"]
    SH --> DLV{Comprador confirmou ou auto em 7 dias após a entrega?}
    DLV -->|Sim| WIN[DELIVERED: janela de arrependimento de 7 dias]
    WIN -->|Sem arrependimento| DONE["COMPLETED → repasse em T24 - +30"]
    WIN -->|Arrependimento| RET["Devolução a caminho → 'Confirmar recebimento da devolução'"] --> REF[Estorno → CANCELLED]
    RET -->|10 dias sem confirmação| MOD[Moderação decide]
    DLV -->|Caso aberto| ISS["Prazos e repasse do item pausados - aguarda moderação - pode enviar evidências"]
    ISS -->|Estorno total / parcial / improcedente| DEC2[Item cancelado / concluído com valor reduzido e −30 / prazos retomados]
    T17 -->|24 h antes do prazo| WARN["Aviso: '12 envios vencem amanhã'"]
```

### 4.9 Painel de triagem — comprador

```mermaid
flowchart TD
    A(["Notificação: 'A bolha fechou a R$ 80,00 - R$ 20,00 liberados'"]) --> T18[T18: valor pago, valor liberado, status, prazo do vendedor, nome do vendedor]
    T18 --> P{Captura ok?}
    P -->|Falhou - ex.: pré-autorização expirada| PF["Item cancelado: 'Não conseguimos confirmar seu pagamento - nenhum valor foi cobrado' - sem efeito no score"]
    P -->|Ok| W[PENDING_SHIPMENT - mostra prazo do vendedor]
    W -->|Vendedor enviou| TR[SHIPPED - rastreio e previsão]
    W -->|Prazo de envio vencido| LT["Item atrasado: 'O vendedor ainda não enviou. Você pode aguardar até 06/12 ou cancelar com estorno integral.'"]
    LT -->|Cancelar| CX["POST …/cancellation → item cancelado, estorno integral"]
    LT -->|Vendedor envia na tolerância| TR
    LT -->|+3 dias sem envio| CX
    TR --> RC{Recebeu?}
    RC -->|Sim| CF[Confirmar recebimento → DELIVERED]
    RC -->|Não chegou| NR["T25 Caso 'Não recebi'"]
    RC -->|Diferente ou com defeito| DIF["T25 Caso 'Produto diferente' / 'Produto com defeito' + fotos"]
    NR --> DEC{Moderação decide}
    DIF --> DEC
    DEC -->|Estorno total| CXT[Item cancelado]
    DEC -->|Estorno parcial| CMP[Item concluído com valor reduzido]
    DEC -->|Improcedente| RES2[Prazos retomados de onde pararam]
    RC -->|Sem ação| AUTO[Confirmação automática 7 dias após a entrega rastreada / prazo estimado]
    CF --> WD["'Você pode desistir até 10/12' - janela de 7 dias"]
    AUTO --> WD
    WD -->|Desistir| F410([Fluxo 4.10])
    WD -->|Janela encerrada| FIM[COMPLETED - +20 no score]
```

### 4.10 Arrependimento (CDC art. 49)

```mermaid
flowchart TD
    A([T18 com status DELIVERED]) --> B{Dentro de 7 dias do recebimento?}
    B -->|Não| X["'Prazo de arrependimento encerrado em 10/12'"]
    B -->|Sim| C["T19: 'Você pode desistir da compra sem justificar' + motivo opcional"]
    C --> D[Como devolver, prazo e quando o estorno acontece]
    D --> E{Confirmar - Idempotency-Key}
    E -->|200| F[WITHDRAWAL_REQUESTED + instruções de postagem]
    E -->|⚠ WITHDRAWAL_WINDOW_CLOSED| X
    F --> G[Comprador posta e informa o rastreio da devolução]
    G --> H{Vendedor confirma em até 10 dias?}
    H -->|Sim| I["Estorno integral → CANCELLED - 'Estorno de R$ 80,00 solicitado'"]
    H -->|Não| J[Moderação decide - A3]
```

### 4.11 Score e contestação

```mermaid
flowchart TD
    A(["Notificação: 'Seu score mudou: −15'"]) --> B[T20: score, faixa, eventos com data, pontos, motivo e versão do modelo]
    B --> C["Evento: 'Envio atrasado - Fone XT-500 - −15' + 'Por que isso conta?'"]
    C --> D{Contestável? negativo, próprio, até 5 dias}
    D -->|Não| E["'Prazo de contestação encerrado em 09/12'"]
    D -->|Sim| F[T21: justificativa + anexos]
    F --> G{POST /score-events/:id/disputes}
    G -->|201| H["Evento 'Em revisão' - não conta no score até a decisão - decisão em até 5 dias úteis"]
    G -->|⚠ DISPUTE_ALREADY_OPEN| H
    G -->|⚠ DISPUTE_WINDOW_CLOSED| E
    H --> I{Moderação decide - A4}
    I -->|Procedente| J[Evento revertido - notificação com motivo]
    I -->|Improcedente| K[Evento volta a contar - motivo visível]
```

### 4.12 Denúncia e moderação

```mermaid
flowchart TD
    U([Usuário logado em T03]) --> R["T03c: Proibido, Enganoso, Fraude, Outro + detalhes"]
    R --> P{POST /bubbles/:id/reports}
    P -->|201| OK["'Denúncia recebida. Obrigado por ajudar a manter a plataforma segura.'"]
    P -->|⚠ REPORT_ALREADY_SUBMITTED| DUP["'Você já denunciou esta bolha.'"]
    OK --> Q[A1 Fila de moderação: denúncias, casos de triagem, contestações]
    Q --> M{Moderador decide - motivo obrigatório}
    M -->|Suspender bolha| S["Bolha CANCELLED + estorno 100% + notificação aos participantes"]
    M -->|Suspender conta| C[Sessões revogadas]
    M -->|Arquivar| D[Denúncia improcedente]
    S --> AUD[Registro imutável na trilha de auditoria]
    C --> AUD
    D --> AUD
```

---

## 5. Lacunas a fechar no Gate A

| Tema | Pergunta aberta | Proposta usada aqui |
| :--- | :--- | :--- |
| Criador PJ de bolha de compra | Ocupa só 1 cota ou pode N? | 1 cota (Spec F4) |
| Categorias proibidas | Lista fechada (Spec Q3) | Lista nos Termos, refletida em `GET /categories` |
| UC10 "Gerenciar estoque de lotes" e "avaliação recíproca" (`mvp.md`) | Entram no R1? | Fora do R1: score por eventos (ADR-0007), sem avaliação manual |

---

## Fontes consultadas (AlterEgo)

- **ux-ui-design** — *Introdução e boas práticas em UX Design* (Casa do Código), cap. 3 "Wireframes, protótipos e rabiscoframes", p. 58–62: definir conteúdo, método de navegação (menus fixos × fluxo linear) e interações antes do layout → princípios §1 e mapa §2.
- **ux-ui-design** — *Desenvolvimento Web com HTML, CSS e JavaScript* (Caelum, WD-43), cap. 3: o trabalho de UX/IxD produz a navegação (mapa do site) e o esboço de cada visão, inclusive diálogos de alerta e confirmação → o inventário §3 trata modais/sheets como telas.
- **asias-design-interacao** — *Skill* (tabela das 10 Heurísticas) e *10 Usability Heuristics for User Interface Design* (Jakob Nielsen, NN/g, rev. 2024): visibilidade do status (banner de reconexão, contadores, reserva Pix), controle e liberdade (sair da bolha, substituir lance, rascunho automático), prevenção de erro (validação ao vivo de degraus e lance, aviso de oferta vinculante), reconhecer/diagnosticar/recuperar de erros (cada `⚠` oferece a correção).
