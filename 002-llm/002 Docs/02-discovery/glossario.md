# Glossário — Linguagem Ubíqua do Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) (prevalece em conflito) · [Event Storming](event-storming.md)

> **Regras de uso**
> 1. O termo da coluna **Termo** é o único aceito em documentos, telas, histórias e código (pela coluna **Nome no código**).
> 2. **Sinônimos proibidos** não aparecem em código nem em critérios de aceite. Na UI, só se o style guide liberar explicitamente.
> 3. **Contexto** é o bounded context dono do significado (ver [Event Storming §3](event-storming.md)). Se um termo muda de sentido entre contextos, ele tem uma entrada por contexto.
> 4. Nomes de código marcados **(proposto)** não estão nos fatos canônicos. Eles saíram da Spec ou do Event Storming e precisam ser confirmados no Gate A.
> 5. Estados e decisões D1–D8 seguem com status Proposto (ADR-0002…0009).
>
> Contextos: `identity` · `bubble` · `bidding` · `payment` · `triage` · `reputation` · `notification` · `realtime` · `platform`.

---

## Glossário (ordem alfabética)

| Termo | Definição | Contexto | Sinônimos proibidos | Nome no código |
| :--- | :--- | :--- | :--- | :--- |
| **Arrependimento** | Desistência do comprador em até 7 dias após o recebimento (CDC art. 49). Leva o item a `WITHDRAWAL_REQUESTED` e, após a devolução confirmada, a estorno sem penalidade de score | triage | "devolução" (é a etapa seguinte), "cancelamento", "reembolso" | `WithdrawalRequested`; `POST /triage/items/{id}/withdrawal` |
| **Atraso de envio** | Evento de score (−15) do vendedor que envia após `shipping_days`. ⚠ A Spec F9 cancela o item no fim desse prazo, então a janela do atraso não existe hoje (HS-15) | reputation | "atraso de entrega" (entrega é da transportadora) | `ScoreEventType.SHIPMENT_LATE` (proposto) |
| **Auditoria (trilha de)** | Registro imutável de ações sensíveis: moderação, decisões, mudanças de estado, acessos a PII | platform | "log" (logs técnicos não têm PII nem valor de prova) | `audit_log` |
| **Bolha** | Oferta (venda) ou demanda (compra) coletiva com cotas, prazo e preço por cota | bubble | "anúncio", "campanha", "leilão", "grupo", "oferta" | `Bubble`; `bubbles` |
| **Bolha (projeção)** | A representação visual da bolha num tile do canvas: círculo, anel de progresso, flags. Não tem regras | realtime | — | `BubbleView` (proposto) |
| **Bolha de Compra** | Bolha criada por PF ou PJ para agregar demanda. Recebe lances de PJs (C2B/B2B). O criador ocupa 1 cota automaticamente | bubble | "bolha de pedido", "pedido coletivo", "cotação" | `BubbleType.PURCHASE` |
| **Bolha de Venda** | Bolha criada por PJ (B2C/B2B) ou PF com recebedor aprovado (C2C). Preço por degraus | bubble | "promoção", "lote", "oferta relâmpago" | `BubbleType.SALE` |
| **Cancelamento por culpa** | Evento de score (−60) do vendedor cujo item foi cancelado por não envio no prazo | reputation | "punição", "multa" | `ScoreEventType.CANCELLATION_AT_FAULT` (proposto) |
| **Canvas** | Espaço infinito navegável (pan/zoom) onde as bolhas ativas aparecem, com zoom de 0,1× a 4× e nível de detalhe (LOD). Tem como alternativa acessível a **lista** | realtime | "mapa", "mural", "feed" | `canvas`; `canvas_x`, `canvas_y` |
| **Capacidade** | Total de cotas da bolha (2–10.000) | bubble | "estoque", "lote total", "quantidade" | `max_quotas` |
| **Captura** | Cobrança efetiva no gateway do valor final (cartão: captura parcial da pré-autorização; Pix: o já cobrado menos o estorno da diferença) | payment | "débito", "cobrança final" | `PaymentCaptured`; `payments` |
| **Caso de triagem** | Problema aberto pelo comprador sobre um item ("Não recebi", "Produto diferente"). **Pausa o repasse** e vai para a fila de moderação. O moderador decide entre estorno total, estorno parcial ou liberar o repasse | triage | "reclamação", "disputa" (disputa é de score), "chamado", "ticket" | `TriageCase` (proposto); `TriageCaseOpened`, `TriageCaseResolved` (propostos) |
| **CNPJ ATIVO** | Situação cadastral exigida para a conta PJ agir, verificada via BrasilAPI (fallback ReceitaWS). Inativo, suspenso ou baixado bloqueia o cadastro; se ficar irregular depois, a conta não inicia novas ações | identity | "CNPJ válido" (validade de dígito ≠ situação cadastral) | `company_profiles.cnpj_status = 'ATIVA'` |
| **Comprador** | Na triagem, o titular de cota(s) de uma bolha que explodiu com sucesso | triage | "cliente", "cotista" | `buyer_id` |
| **Confirmação de recebimento** | Ato do comprador que leva o item a `DELIVERED`. É automática 7 dias após a entrega rastreada ou o prazo estimado | triage | "aceite", "baixa" | `DeliveryConfirmed`; `POST /triage/items/{id}/delivery-confirmation` |
| **Conta PF** | Conta de pessoa física (CPF): 1 cota por bolha | identity | "usuário" (ambíguo: PJ também é usuário), "cliente" | `Account { type: 'PF' }` |
| **Conta PJ** | Conta de pessoa jurídica (CNPJ) com PF responsável: N cotas até o teto, lances | identity | "empresa" (no código), "lojista", "fornecedor" (é um papel) | `Account { type: 'PJ' }` + `CompanyProfile` |
| **Contestação** | Pedido da conta afetada para revisar um evento de score, em até 5 dias. O evento fica "em revisão" e **não conta** até a decisão do moderador (≤ 5 dias úteis) | reputation | "recurso", "reclamação", "disputa de triagem" | `ScoreDispute`; `score_disputes`; `POST /score-events/{id}/disputes` |
| **Cota** | Unidade de participação numa bolha. PF: máx. 1. PJ: até `max_pj_share`. Só conta para a meta depois de paga ou autorizada | bubble | "vaga", "assento", "ticket", "pedido", "slot" | `Quota`; `quotas` |
| **Criador** | Conta que criou a bolha. Não participa da própria bolha de venda nem dá lance na própria bolha de compra | bubble | "dono", "anunciante", "organizador" (no código) | `creator_id` |
| **Degrau de preço** | Par (a partir de N cotas → preço por cota) definido pelo criador da bolha de venda: 1 a 10 degraus, limites crescentes, preços não crescentes, mínimo R$ 1,00 | bubble | "faixa de desconto", "desconto progressivo", "curva" (usar só para o conjunto) | `PriceTier { min_filled_quotas, unit_price }`; `price_tiers` |
| **Denúncia** | Sinalização de uma bolha por usuário logado, nas categorias proibido, enganoso, fraude ou outro. Vai para a fila de moderação | bubble | "reclamação", "report" (na UI), "flag" (flag é derivada) | `Report` (proposto); `BubbleReported`, `ReportDismissed` (propostos) |
| **Devolução** | Envio do produto de volta após o arrependimento, em até 10 dias. Se o vendedor não confirmar, decide a moderação | triage | "estorno" (o estorno é o dinheiro) | `ReturnShipment` (proposto) |
| **Estorno** | Devolução de dinheiro ao comprador: anulação da pré-autorização, devolução do Pix ou estorno após captura. É total na falha da bolha e parcial na diferença de preço | payment | "reembolso", "chargeback" (chargeback é disputa no emissor), "devolução" | `Refund`; `PaymentRefunded`; `refunds` |
| **Evento de score** | Fato ponderado que altera o score: transação concluída (+20/+30), envio no prazo (+5), atraso (−15), cancelamento por culpa (−60), não pagamento (−40). Decai com meia-vida de 180 dias | reputation | "avaliação", "nota", "review" | `ScoreEvent`; `score_events` |
| **Expirando (flag)** | Bolha `ACTIVE` com menos de 1 h para `expires_at`. Bloqueia a saída de cota. **Não é estado** | bubble | `EXPIRING` como status, "fechando" | `is_expiring` |
| **Explosão** | Encerramento da adesão por tempo (`expires_at`) ou por lotação (`filled_quotas = max_quotas`). Resulta em `EXPIRED_SUCCESS` ou `EXPIRED_FAILED` | bubble | "fechamento", "expiração" (sozinho), "estouro" | `BubbleExploded { outcome: SUCCESS\|FAILED, reason: TIME\|FULL }`; `exploded_at` |
| **Faixa de score** | Classificação exibida junto ao pseudônimo: 0–299 Risco · 300–599 Regular · 600–799 Bom · 800–1000 Excelente. Informativa na R1 | reputation | "nível", "selo", "estrelas" | `ScoreBand` (proposto) |
| **Fila de moderação** | Projeção que reúne denúncias, casos de triagem e contestações pendentes. A decisão volta ao contexto dono | platform | "backoffice", "SAC" | `ModerationQueue` (proposto) |
| **Flag derivada** | Indicador calculado, não persistido como estado: `is_near_full`, `is_expiring` | bubble | "status", "estado" | `is_near_full`, `is_expiring` |
| **Fornecedor sugerido** | Até 5 CNPJs ou e-mails indicados pelo criador da bolha de compra para receber convite de lance | bidding | "parceiro", "indicação" | `SuggestedSupplier` (proposto) |
| **Idempotency-Key** | Cabeçalho obrigatório nos POST de cota, lance e pagamento. Garante que a repetição não gera duas cotas nem duas cobranças | platform | "token de requisição" | `Idempotency-Key` |
| **Item de triagem** | Unidade da triagem: 1 por conta compradora numa bolha. Estados: `PENDING_SHIPMENT → SHIPPED → DELIVERED → COMPLETED`; desvios para `WITHDRAWAL_REQUESTED` e `CANCELLED` | triage | "pedido", "ordem", "entrega" | `TriageItem`; `triage_items.status` |
| **Item de triagem — `CANCELLED`** | Item encerrado sem venda: não envio no prazo, devolução após arrependimento, falha de captura ou decisão de caso. Implica estorno | triage | "falhou", "abortado" | `TriageItemCancelled` |
| **Item de triagem — `COMPLETED`** | Item concluído após a janela de arrependimento sem desistência (ou caso decidido a favor do repasse). Libera o repasse e os eventos +20/+30 | triage | "finalizado", "pago" | `TriageItemCompleted` |
| **Item de triagem — `DELIVERED`** | Recebimento confirmado (manual ou automático). Abre a janela de arrependimento | triage | "entregue" (no código) | `DeliveryConfirmed` |
| **Item de triagem — `PENDING_SHIPMENT`** | Estado inicial após a captura: aguarda o envio em até `shipping_days` | triage | "aguardando" | `TriageOpened` |
| **Item de triagem — `SHIPPED`** | Código de rastreio informado pelo vendedor | triage | "despachado" | `ShipmentRegistered` |
| **Item de triagem — `WITHDRAWAL_REQUESTED`** | Comprador exerceu o arrependimento; aguarda a devolução | triage | "devolvendo" | `WithdrawalRequested` |
| **Janela de arrependimento** | 7 dias corridos após o recebimento (fixo por lei). O repasse só sai depois dela | triage | "garantia", "período de teste" | `withdrawal_deadline` (proposto) |
| **Janela de seleção de lance** | 24 h após a explosão com sucesso de uma bolha de compra para o criador escolher o lance, com aviso em T−2 h. Sem escolha, vence o menor preço (empate: o mais antigo) | bidding | "prazo de leilão" | job `bid-selection-timeout` |
| **Lance** | Proposta de uma PJ verificada numa bolha de compra `ACTIVE`: preço por cota ≤ `target_price`, prazo de entrega, condições. Um lance ativo por empresa; substituir retira o anterior. Exibido por pseudônimo até a seleção | bidding | "oferta", "proposta", "cotação", "bid" (na UI) | `Bid`; `bids`; `BidSubmitted`, `BidWithdrawn` |
| **Lance vencedor** | Lance escolhido pelo criador ou pelo fallback. Revela o nome da empresa e a torna **vendedora** na triagem | bidding | "ganhador do leilão" | `BidSelected`; `bubbles.selected_bid_id` |
| **Lotação** | Motivo de explosão em que `filled_quotas = max_quotas`, processada na mesma transação da última cota | bubble | "esgotou", "sold out" (no código; na UI é o erro `QUOTA_SOLD_OUT`) | `reason: 'FULL'` |
| **Meia-vida** | Prazo (180 dias) em que o peso de um evento de score cai pela metade: `0,5^(idade/180)` | reputation | "expiração do score" | `SCORE_HALF_LIFE_DAYS` |
| **Meta mínima** | Cotas necessárias para a bolha ter sucesso (1 ≤ min ≤ max; padrão 50% da capacidade) | bubble | "mínimo de vendas", "objetivo", "alvo" | `min_quotas` |
| **Moderação** | Capacidade da plataforma de suspender bolha (estorno 100%) ou conta e de decidir contestações e casos de triagem. Toda ação exige motivo e gera auditoria | bubble · triage · reputation · identity | "administração", "suporte" | `moderation` (capacidade); ver Fila de moderação |
| **Moderador** | Papel interno que executa a moderação | identity | "admin" (no código), "atendente" | `Role.MODERATOR` (proposto) |
| **Modelo de score** | Versão das regras de peso e meia-vida usada no cálculo; permite recalcular | reputation | "algoritmo" (no código) | `score_model_version` |
| **Outbox** | Tabela onde os eventos são gravados na mesma transação do fato e depois publicados (WS, notificações). Evita evento sem commit e commit sem evento | platform | "fila", "log de eventos" | `outbox_events` |
| **Participante** | Conta que detém cota numa bolha `ACTIVE` | bubble | "membro", "cotista", "assinante" | `quotas.account_id` |
| **Prazo de envio** | Dias corridos (1–30; padrão 7) para o vendedor registrar o envio após a captura | bubble → triage | "SLA de entrega", "prazo de entrega" (é do lance) | `shipping_days` |
| **Pré-autorização** | Reserva do limite do cartão por `valor_reserva × cotas` na adesão, capturada parcialmente na explosão ou anulada | payment | "reserva" (sozinho: confunde com a reserva Pix), "bloqueio", "caução" | `PaymentAuthorized` (cartão) |
| **Preço atual** | Preço por cota do maior degrau cujo `min_filled_quotas ≤ filled_quotas` ("preço se fechar agora") | bubble | "preço com desconto", "preço do momento" | `current_price` (derivado) |
| **Preço final** | Preço atual no instante da explosão (venda) ou preço do lance vencedor (compra). É **único** para todos os participantes | bubble · bidding | "preço fechado", "preço de quem entrou primeiro" | `final_price` (derivado, proposto) |
| **Preço inicial** | Primeiro degrau (0 cotas) da bolha de venda e base da pré-autorização | bubble | "preço cheio", "preço de tabela" | `initial_price` |
| **Preço-alvo** | Venda: último degrau. Compra: preço máximo aceitável por cota, teto dos lances e base da autorização | bubble | "preço de interesse", "preço desejado", "preço mínimo" | `target_price` |
| **Pseudônimo** | Identificador público (ex.: `Bolhista#4F2A`) e o único dado de participante exibido no canvas e nos lances. Apelido editável, sufixo fixo. Continua sendo dado pessoal (LGPD) | identity | "nome de usuário", "anônimo" (pseudônimo ≠ anonimização) | `pseudonym` |
| **Quase cheia (flag)** | Bolha com ≥ 80% de `max_quotas` preenchidas. **Não é estado** | bubble | `NEAR_FULL` como status | `is_near_full` |
| **Recebedor** | Cadastro do vendedor no gateway para receber repasses via split. É obrigatório para PF vendedora (C2C) antes de publicar | payment | "conta bancária", "carteira" | `recipient_id` (proposto) |
| **Reconciliador** | Job que roda a cada 1 min e explode bolhas vencidas não processadas, usando o Postgres como fonte da verdade | platform | "cron de limpeza" | job `bubble-reconciler` (proposto) |
| **Repasse** | Transferência ao vendedor do valor capturado menos a taxa da plataforma, quando o item chega a `COMPLETED`. É pausado por caso de triagem aberto | payment | "pagamento ao vendedor", "saque" | `Payout`; `PayoutReleased`; `payouts` |
| **Reserva Pix** | Retenção de capacidade de 15 min enquanto o QR Pix não é pago. Pagou → cota adquirida; expirou → a capacidade volta a ficar livre. **Não conta** para a meta mínima na explosão | bubble · payment | "pré-autorização" (é do cartão), "cota pendente" (na UI) | `QuotaReserved`, `QuotaReservationExpired` (propostos); `Quota.status = 'RESERVED'` + `reserved_until` (proposto) |
| **Revalidação de CNPJ** | Nova consulta da situação cadastral a cada 30 dias. Na indisponibilidade do provedor no cadastro, há nova tentativa a cada 15 min por 24 h | identity | "renovação" | job (proposto) |
| **Room** | Canal do Socket.io por tile (`tile:{z}:{x}:{y}`) ou por bolha (`bubble:{id}`) | realtime | "sala", "canal" (no código) | `tile:{z}:{x}:{y}`, `bubble:{id}` |
| **Score** | Reputação 0–1000 de cada conta, começando em 500: `clamp(0, 1000, 500 + Σ pontos × 0,5^(idade/180))` | reputation | "nota", "rating", "avaliação", "pontuação de crédito" | `score`; `GET /accounts/{id}/score` |
| **Status da bolha** | `DRAFT`, `ACTIVE`, `EXPIRED_SUCCESS` (explodiu com meta), `EXPIRED_FAILED` (explodiu sem meta → `CANCELLED`), `IN_TRIAGE`, `COMPLETED`, `CANCELLED` | bubble | `EXPIRED` (sozinho), `NEAR_FULL`/`EXPIRING` como estados, "finalizada" | `BubbleStatus`; `bubbles.status` |
| **Suspensão** | Ação de moderação. Bolha: `ACTIVE → CANCELLED` com estorno de 100%. Conta: impede novas ações | bubble · identity | "banimento", "bloqueio" | `BubbleCancelled { reason: 'MODERATION' }` (proposto); `AccountSuspended` (proposto) |
| **Taxa da plataforma** | 6% do valor capturado, descontada do repasse ao vendedor (hipótese, Spec Q5). Comprador PF não paga | payment | "comissão" (no código), "take" (na UI) | `PLATFORM_FEE_BPS = 600` (proposto) |
| **Teto PJ** | Fração máxima da capacidade que uma única PJ pode ocupar (padrão 50%; 10–100%, definido pelo criador) | bubble | "limite de compra", "cota máxima" | `max_pj_share` |
| **Tile** | Recorte espacial do canvas (zoom z, coluna x, linha y) usado para carregar e assinar bolhas visíveis | realtime | "região", "quadrante" | `tile:{z}:{x}:{y}` |
| **Triagem** | Fase pós-explosão com sucesso: captura → envio → recebimento → arrependimento → repasse. A bolha fica `IN_TRIAGE` até todos os itens finalizarem | triage | "pós-venda", "checkout", "fechamento" | `triage`; `TriageOpened`, `TriageClosed` |
| **Valor de reserva** | Valor por cota autorizado na adesão: `initial_price` (venda) ou `target_price` (compra) | payment | "sinal", "entrada" | `hold_amount` (proposto) |
| **Vendedor** | Na triagem, quem entrega: o criador da bolha de venda ou a PJ do lance vencedor da bolha de compra | triage | "fornecedor" (no código), "loja" | `seller_id` |
| **Verificação pendente** | Status da conta PJ quando o provedor de CNPJ está indisponível no cadastro: navega, mas não cria bolha, não compra cota e não dá lance (`ACCOUNT_NOT_VERIFIED`) | identity | "conta bloqueada" | `AccountStatus.PENDING_VERIFICATION` |
| **Visitante** | Pessoa não autenticada: navega no canvas e vê detalhes públicos | identity | "anônimo" | — |

## Termos que mudam de sentido entre contextos

| Palavra | Em `bubble` | Em `triage` | Em `reputation` | Em `payment` |
| :--- | :--- | :--- | :--- | :--- |
| Cancelamento | Estado final da bolha (`CANCELLED`) | Estado final do item | Evento −60 (só por culpa do vendedor) | Gatilho de estorno |
| Reserva | Reserva Pix (retém capacidade por 15 min) | — | — | Pré-autorização (cartão) — usar sempre o termo completo |
| Disputa | — | **Caso de triagem** | **Contestação** | Chargeback (fora do domínio, via gateway) |
| Concluída | — | Item `COMPLETED` | Evento "transação concluída" | Libera o repasse |

## Lacunas

| ID | Lacuna |
| :--- | :--- |
| GL-01 | A lista canônica de tabelas (fatos §7) não tem `reports`, `triage_cases` nem um campo de reserva Pix em `quotas` |
| GL-02 | O "não pagamento" (−40) tem gatilho ambíguo: a Spec F10 inclui Pix não pago após a reserva; a Spec §6 diz que a reserva expirada não penaliza |
| GL-03 | A coluna `shipping_days` está na Spec, mas não nas colunas-chave canônicas de `bubbles` |

---

## Fontes consultadas (AlterEgo)

- **event-storming** — *Bounded Context Canvas* (ddd-crew): seção "Ubiquitous Language" (termos-chave e seus significados dentro de cada contexto) e a regra de que o contexto delimita o significado do termo.
- **event-storming** — *Board Pizzaria das Galáxias*: "constraint" em vez de "aggregate" como nome usado com o negócio (aplicado na nomenclatura deste glossário).
