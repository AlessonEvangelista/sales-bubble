# SLOs e Observabilidade — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) (§7 RNF01–RNF04, §10 métricas e guardrails) · [Spec do Produto](../../SPEC.md) (§5 parâmetros, §6 casos de borda) · [Plano de Projeto v2](../planing-project.md) (§9, E9, R1, R3, R5, R7)

> SLIs e SLOs derivados das jornadas críticas do produto, política de error budget, instrumentação OpenTelemetry, métricas de negócio, logs sem PII, dashboards e alertas. Os valores são **metas iniciais**: serão revisados mensalmente durante o beta e congelados no fim do hipercuidado ([plano-release.md](plano-release.md)). Stack: OpenTelemetry → Collector → Grafana/SigNoz (decisão final na S1) + Sentry para erros e RUM.

---

## 1. Jornadas críticas → SLIs

| Jornada | O que o usuário sente quando falha | SLI | Requisito |
| :--- | :--- | :--- | :--- |
| J1 — Navegar no canvas | Canvas travando, bolhas não carregam | Disponibilidade de `GET /bubbles?bbox`; frame time no cliente (RUM) | RF02, RNF01 |
| J2 — Adquirir cota | Erro ou demora ao entrar na bolha; overbooking | Sucesso e latência de `POST /bubbles/{id}/quotas`; contagem de overbooking | RF03, RNF02 |
| J3 — Ver a bolha mudar em tempo real | Contador/preço desatualizado | Latência servidor → cliente de `bubble.updated`/`bubble.exploded` | RF02.1, RNF01 |
| J4 — Bolha explodir no horário | Bolha "vencida" ainda aceitando cotas; notificação atrasada | Atraso `exploded_at − expires_at` | RF05.1, ADR-0011 |
| J5 — Pagamento e estorno | Cobrança sem confirmação; Pix reservado preso; captura falhando; estorno não chega | Sucesso de webhooks; liberação de reservas Pix em 15 min; sucesso de captura; idade de estornos pendentes | RF07, ADR-0003, Spec F5/F7 |
| J6 — Triagem e score | Prazos não avançam; score não atualiza | Atraso de jobs `triage-deadline`; lag do outbox | RF05.2, RF05.3 |

---

## 2. SLOs

Janela padrão: **mês civil** (RNF04: "SLO de 99,5% mensal"), com visão móvel de 30 dias para alertas. "Requisição válida" exclui 4xx causados pelo cliente (400, 401, 403, 404, 409 de regra de negócio, 422, 429).

| ID | SLI (definição) | Onde se mede | SLO | Error budget (mês) |
| :--- | :--- | :--- | :--- | :--- |
| **SLO-01** Disponibilidade da API (RNF04) | `respostas não-5xx / requisições válidas` em `/api/v1/*` (exceto `/health`, `/rum`) | Métrica `http.server.request.duration` do OTel no load balancer/API + sonda sintética externa a cada 1 min | **99,5% mensal** (aspiracional 99,9% após o R1) | 0,5% ≈ 3 h 36 min/mês (30 d) |
| **SLO-01b** Disponibilidade do WebSocket (RNF04) | `minutos em que a sonda sintética conecta, entra na room e recebe ack em < 2 s / minutos do mês` | Sonda sintética (2 regiões) | **99,5% mensal** | ≈ 3 h 36 min/mês |
| **SLO-02** Latência de aquisição de cota | % de `POST /bubbles/{id}/quotas` válidos concluídos abaixo do limite (inclui a pré-autorização no gateway) | Histograma `http.server.request.duration{route}` | **95% < 1 s** e **99% < 2 s** (proposta; o PRD não fixa) | 5% / 1% das requisições |
| **SLO-02b** Reserva da cota (interno) | Duração da transação de reserva (UPDATE condicional + insert + outbox) | Span `quota.reserve` | 99% < 100 ms | não pagina; indicador de diagnóstico |
| **SLO-03** Integridade de cotas (RNF02) | Bolhas com `filled_quotas > max_quotas`, PF com > 1 cota ativa, PJ acima de `max_pj_share`, ou cobrança dupla para a mesma `Idempotency-Key` | Query de verificação a cada 5 min | **0 ocorrências** (invariante) | Sem budget: qualquer ocorrência é **S1** |
| **SLO-04** Latência de tempo real (RNF01, PRD §10) | **Commit no servidor → renderização no cliente** do update de cota: o evento carrega `committed_at`; o cliente registra o frame que aplicou a mudança, corrigido pelo offset de relógio estimado no handshake do socket (5 trocas, estilo NTP), e reporta em amostra de 5% dos clientes | Histograma `bolha.realtime.commit_to_render` (RUM) | **p99 < 200 ms** | 1% das atualizações amostradas |
| **SLO-04a** RTT do canal | `emit` → `ack` do cliente (não depende do relógio do cliente) | Histograma `bolha.ws.ack_rtt` | p99 < 150 ms | diagnóstico; separa rede de renderização |
| **SLO-04b** Pipeline de eventos | Commit da transação → `emit` no gateway (lag do outbox + fan-out) | Histograma `bolha.outbox.publish_lag` | 99% < 100 ms | diagnóstico |
| **SLO-05** Pontualidade da explosão (RNF02, PRD §10) | p99 de `exploded_at − expires_at` nas explosões por tempo | Histograma `bolha.bubble.explosion_delay` | **p99 ≤ 2 s** e **100% ≤ 70 s** (limite do reconciliador de 1 min, Spec §6) | 1% das explosões por tempo |
| **SLO-06** Webhooks de pagamento | % de webhooks recebidos processados com sucesso em até 5 min (inclui retentativas internas); duplicados tratados sem efeito colateral | `bolha.webhooks.processed{result}` + `webhook_events` | **99,9%** em ≤ 5 min; **100%** de duplicados idempotentes | 0,1% |
| **SLO-07** Estornos (RF07.3) | % de estornos solicitados confirmados pelo gateway em ≤ 24 h | `refunds` (status, timestamps) | **99%** ≤ 24 h; 100% ≤ 72 h | 1% |
| **SLO-07b** Liberação de reservas Pix (Spec F5, §5) | % de reservas Pix não pagas liberadas (cota de volta à capacidade) em ≤ 16 min após a criação (15 min + 1 min de tolerância) | `bolha.pix.reservation_release_delay` + query de reservas vencidas | **99,9%**; 100% ≤ 20 min | 0,1% |
| **SLO-07c** Capturas na explosão (Spec F7) | % de capturas do preço final bem-sucedidas em ≤ 15 min após `EXPIRED_SUCCESS`, excluindo recusas legítimas do emissor | `bolha.payments.capture{result}` | **99,5%**; falhas por pré-autorização expirada = 0 enquanto a duração máxima respeitar a validade (R5, Spec Q1) | 0,5% |
| **SLO-08** Frame time do canvas (RNF01, RUM) | % de sessões de canvas, nas classes dos 2 dispositivos de referência (notebook com GPU integrada; Android de gama média), com **frame time p95 ≤ 16,7 ms** durante pan/zoom | RUM no `apps/web` | **90% das sessões** (o benchmark de CI exige 100%) | 10% das sessões |

Notas:
- **SLO-04** segue a definição do RNF01 do PRD v2.1 (commit → renderização). Como depende do relógio do cliente, a correção de offset é obrigatória e amostras com incerteza de offset > 20 ms são descartadas; o SLO-04a (RTT) é o indicador de apoio sem essa dependência.
- **SLO-05** materializa o RNF02: "explode em ≤ 2 s após `expires_at`, mesmo com reinício de worker".
- **RNF04** fixa também **RPO ≤ 15 min** e **RTO ≤ 4 h**. Não são SLIs contínuos: são verificados por **teste de restauração mensal** (PITR do Postgres em ambiente isolado, cronometrado) e pelo alerta AL-24 (backup/WAL atrasado). Um teste acima de 4 h abre item de confiabilidade prioritário.
- Pré-autorização e Pix seguem a Spec §5 (reserva Pix de 15 min; duração máxima de 5 dias limitada pela validade da pré-autorização, questão Q1 da Spec).
- **SLO-08** complementa o benchmark de CI (500 bolhas com frame time p95 ≤ 16,7 ms nos 2 dispositivos de referência, RNF01/R1). O CI prova capacidade; o RUM prova experiência real. Os dados do RUM não contêm PII (apenas classe de dispositivo, navegador, contagem de bolhas visíveis e zoom).
- Métricas de produto e guardrails do PRD §10 **não são SLOs**: ficam no dashboard de negócio (seção 6, D6) com as metas do PRD (taxa de sucesso > 65%, mediana até o sucesso < 48 h, conclusão da triagem > 90%, estorno por cancelamento na triagem < 5%, contestações procedentes < 2%), recalibradas com 60 dias de dados reais.

---

## 3. Error budget e política

**Cálculo:** `budget consumido = (1 − SLI medido) / (1 − SLO)` no mês civil, por SLO. Alertas por **taxa de consumo** (burn rate) em duas janelas.

| Consumo do budget (mês) | Ação | Quem decide |
| :--- | :--- | :--- |
| < 50% | Operação normal | — |
| 50–75% | Revisão no Daily; itens de confiabilidade entram no topo do backlog da próxima sprint | Tech Lead |
| 75–100% | Deploys em produção só com correções e itens de confiabilidade; feature nova exige aprovação do PO + TL | Tech Lead + PO |
| **≥ 100% (esgotado)** | **Freeze** de features em produção até a virada do mês e até a visão móvel de 30 dias voltar abaixo de 100%; time dedica a sprint corrente a confiabilidade; postmortem obrigatório dos incidentes que mais consumiram | PO + Tech Lead |
| Um incidente consumiu > 20% sozinho | Postmortem obrigatório, mesmo que o SLO não tenha sido violado | Tech Lead |

Exceções: correções de segurança e de incidentes S1/S2 nunca são bloqueadas pelo freeze. Discordância sobre o cálculo ou a aplicação da política escala para PO + Tech Lead, que registram a decisão no log de `002-llm/001 log/`.

Documentação dos SLOs: autores (Tech Lead + DevOps/SRE), revisores (Backend sênior, QA), aprovadores (PO + Tech Lead). Aprovação no Gate E; **revisão mensal** durante o beta e o primeiro trimestre, depois trimestral. Os números iniciais são *ad hoc* (sem histórico); isso fica registrado aqui para que ninguém os trate como dado observado.

---

## 4. Instrumentação OpenTelemetry

### 4.1 Configuração
- `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` (HTTP, NestJS, `pg`, `ioredis`, Socket.io) carregados por `--import ./otel.mjs` no processo da api e do worker; instrumentação do Prisma (`@prisma/instrumentation`); BullMQ com propagação de contexto pelos dados do job (`traceparent` no `job.data._otel`).
- Atributos de recurso: `service.name` (`bolha-api` | `bolha-worker` | `bolha-web`), `service.version` (= `APP_VERSION`), `deployment.environment`, `service.instance.id`.
- Exportação OTLP para um **OpenTelemetry Collector** (processadores: `batch`, `memory_limiter`, `attributes/delete` para remover PII que escape, `tail_sampling`). Métricas com temporalidade **delta** quando o backend for SigNoz.
- Amostragem de traces: 100% em staging; em produção `parentbased_traceidratio` 10% + tail sampling que mantém **100% dos traces com erro** e dos de `POST /quotas`, `POST /webhooks/*`, `bubble-expire` acima de 1 s.
- Front: `instrumentation-client.ts` do Next.js inicializa Sentry (erros + traces de navegação) e o coletor de RUM; envio por `navigator.sendBeacon` para `POST /api/v1/rum`.

### 4.2 Spans customizados obrigatórios

| Span | Atributos (sem PII) |
| :--- | :--- |
| `quota.acquire` (caso de uso) / `quota.reserve` (transação) | `bubble.id`, `bubble.type`, `account.type`, `quota.quantity`, `result` |
| `payment.authorize` / `payment.capture` / `payment.refund` | `payment.method`, `provider`, `result`, `http.status_code` |
| `bubble.explode` | `bubble.id`, `outcome`, `reason`, `delay_ms`, `trigger` (`job` \| `reconciler` \| `last_quota`) |
| `outbox.relay.batch` | `batch.size`, `oldest_lag_ms` |
| `ws.broadcast` | `event`, `room.kind` (`tile`/`bubble`), `recipients` |
| `webhook.process` | `provider`, `event.type`, `duplicate` (bool) |
| `reconciler.run` | `recovered.count` |

### 4.3 Métricas técnicas
- HTTP: `http.server.request.duration` (histograma, por `http.route`, `http.response.status_code`).
- Banco: `db.client.connections.usage`, duração de queries (instrumentação `pg`), `pg_stat_statements` via exporter.
- Redis: memória usada, `connected_clients`, `aof_last_bgrewrite_status`, latência de comando.
- BullMQ (por fila): `bolha.queue.waiting`, `bolha.queue.delayed`, `bolha.queue.active`, `bolha.queue.failed`, `bolha.queue.job_duration`, `bolha.queue.oldest_waiting_age`.
- WS: `bolha.ws.connections` (gauge por instância), `bolha.ws.connects` / `disconnects` (contadores com `reason`), `bolha.ws.ack_rtt` (histograma), `bolha.realtime.commit_to_render` (histograma reportado pelo RUM), `bolha.ws.rooms`, `bolha.ws.throttled_updates` (atualizações agregadas pelo limite de 1 a cada 100 ms por bolha, Spec §5).
- Outbox: `bolha.outbox.pending` (gauge), `bolha.outbox.publish_lag` (histograma), `bolha.outbox.failed`.
- Runtime Node: event loop lag, heap, GC.

### 4.4 Métricas de negócio

| Métrica (OTel) | Tipo | Atributos | Origem |
| :--- | :--- | :--- | :--- |
| `bolha.bubbles.active` | Gauge observável | `type` (SALE/PURCHASE), `is_near_full`, `is_expiring` | Query a cada 60 s |
| `bolha.bubbles.published` | Contador | `type`, `creator.account_type` | Evento `BubblePublished` |
| `bolha.quotas.acquired` | Contador (soma de `quantity`) | `bubble.type`, `account.type`, `payment.method` | `QuotaAcquired` |
| `bolha.quotas.rejected` | Contador | `reason` (SOLD_OUT, PF_LIMIT, PJ_SHARE, NOT_ACTIVE, PAYMENT_DECLINED) | caso de uso |
| `bolha.quotas.released` | Contador | `bubble.type` | `QuotaReleased` |
| `bolha.bubble.explosions` | Contador | `outcome` (SUCCESS/FAILED), `reason` (TIME/FULL), `type` | `BubbleExploded` |
| `bolha.bubble.explosion_delay` | Histograma (s) | `trigger` | `bubble.explode` |
| `bolha.bubble.time_to_success` | Histograma (h) | `type`, `reason` | `t(EXPIRED_SUCCESS) − t(ACTIVE)` (PRD §10, mediana) |
| `bolha.gmv.captured` | Contador (centavos) | `bubble.type`, `payment.method` | `PaymentCaptured` |
| `bolha.refunds` / `bolha.refunds.amount` | Contadores | `reason` (BUBBLE_FAILED, PRICE_DIFF_PIX, WITHDRAWAL, CANCELLED, MODERATION) | `PaymentRefunded` |
| `bolha.refunds.pending_age` | Gauge (máx. idade, s) | — | Query a cada 5 min |
| `bolha.pix.reservations` | Contador | `result` (PAID, EXPIRED_RELEASED, LATE_PAYMENT_REFUNDED) | reservas Pix |
| `bolha.pix.reservation_release_delay` | Histograma (s) | — | criação → liberação da reserva vencida |
| `bolha.pix.reservations_overdue` | Gauge | — | Query a cada 1 min: reservas não pagas com mais de 16 min ainda ocupando capacidade |
| `bolha.payments.capture` | Contador | `result` (OK, DECLINED, AUTH_EXPIRED, ERROR), `payment.method` | captura pós-explosão |
| `bolha.payouts.released` | Contador (centavos) | — | `PayoutReleased` |
| `bolha.bids.submitted` / `bolha.bids.selected` | Contadores | `selection` (CREATOR/AUTO_LOWEST) | `BidSubmitted`, `BidSelected` |
| `bolha.triage.items` | Contador | `result` (COMPLETED/CANCELLED/WITHDRAWN), `cancel_reason` (NO_SHIPMENT, CAPTURE_FAILED, WITHDRAWAL, MODERATION) | eventos de triagem |
| `bolha.score.disputes` | Contador | `status`, `outcome` (UPHELD/REJECTED) | `ScoreDisputeOpened/Resolved` |
| `bolha.score.events` | Contador | `kind` | `ScoreChanged` (denominador do guardrail de contestações) |
| `bolha.reconciliation.diff` | Gauge (centavos) | `kind` (CAPTURE/REFUND/PAYOUT) | Conciliação diária |
| `bolha.overbooking.violations` | Gauge | — | Query de invariante (SLO-03) |

Regra: atributos de métrica têm **cardinalidade baixa**. `bubble.id` e `account.id` só em spans, nunca em métricas.

---

## 5. Logs estruturados sem PII

- `pino` JSON em stdout; o coletor da plataforma envia ao backend de logs. Campos fixos: `time` (UTC ISO 8601), `level`, `service`, `env`, `version`, `trace_id`, `span_id`, `request_id`, `module` (bounded context), `event` (nome estável, ex.: `quota.acquire.rejected`), `msg`.
- **Permitido**: IDs técnicos (UUID de conta, bolha, pagamento), pseudônimo público, códigos de erro, estados, valores em centavos, IDs do gateway.
- **Proibido**: CPF, CNPJ, nome, e-mail, telefone, endereço, IP completo (truncar para /24 em IPv4 e /48 em IPv6), user-agent completo em logs de auth, tokens (JWT, refresh, Idempotency-Key em claro), corpo de webhook bruto, dados de cartão, código de rastreio completo.
- Defesa em camadas: `redact` do pino (`req.headers.authorization`, `req.headers.cookie`, `*.cpf`, `*.cnpj`, `*.email`, `*.document`, `*.password`, `*.card*`, `body` de rotas `/auth/*` e `/webhooks/*`) → processador do Collector que remove atributos com nomes sensíveis → **teste de contrato** no CI que exercita cadastro, login e webhook e falha se algum padrão de CPF/CNPJ/e-mail aparecer na saída de log.
- Níveis: `error` (ação necessária), `warn` (degradação tratada), `info` (eventos de negócio e de ciclo de vida), `debug` só fora de produção. Retenção: 30 dias quente, 180 dias frio para logs de auditoria técnica; `audit_log` (banco) segue a política de retenção do plano LGPD.
- Sentry: `sendDefaultPii: false`, `beforeSend` remove `request.data` e cookies.

---

## 6. Dashboards

| ID | Painel | Conteúdo principal | Exemplo de query (PromQL) |
| :--- | :--- | :--- | :--- |
| D1 | **SLOs e error budget** | SLI × SLO de cada SLO, budget restante, burn rate 1 h/6 h/3 d | `1 - (sum(rate(http_server_request_duration_seconds_count{route=~"/api/v1/.*",status_code=~"5.."}[30d])) / sum(rate(http_server_request_duration_seconds_count{route=~"/api/v1/.*"}[30d])))` |
| D2 | **API (golden signals)** | Tráfego por rota, taxa de 5xx, p50/p95/p99, saturação (CPU, memória, event loop lag, pool do Prisma) | `histogram_quantile(0.99, sum by (le, route) (rate(http_server_request_duration_seconds_bucket[5m])))` |
| D3 | **Cotas e concorrência** | Cotas/min por tipo de conta, rejeições por motivo, p99 de `quota.reserve`, violações de invariante | `sum by (reason) (rate(bolha_quotas_rejected_total[5m]))` |
| D4 | **Timers e filas** | Waiting/delayed/active/failed por fila, idade do job mais antigo, atraso de explosão (p50/p99/máx.), recuperações do reconciliador | `histogram_quantile(0.99, sum by (le) (rate(bolha_bubble_explosion_delay_seconds_bucket[15m])))` |
| D5 | **Tempo real** | Conexões por instância, connects/disconnects, **commit → renderização p99** (SLO-04), RTT de ack p99, lag do outbox, mensagens/s por tipo de room, sonda sintética | `histogram_quantile(0.99, sum by (le) (rate(bolha_realtime_commit_to_render_milliseconds_bucket[5m])))` |
| D6 | **Negócio (PRD §10)** | Bolhas ativas e publicadas/dia; **taxa de sucesso** `EXPIRED_SUCCESS ÷ publicadas` (coorte mensal, > 65%); **mediana até o sucesso** (< 48 h); **conclusão da triagem** `COMPLETED ÷ IN_TRIAGE` (> 90%); guardrails **estorno por cancelamento na triagem** (< 5%) e **contestações procedentes** (< 2%); explosões por outcome/reason; GMV capturado; take rate estimado (6%) | Coortes em SQL (abaixo); série rápida: `sum(increase(bolha_bubble_explosions_total{outcome="SUCCESS"}[30d])) / sum(increase(bolha_bubbles_published_total[30d]))` |
| D7 | **Pagamentos** | Autorizações/capturas/estornos por resultado, **capturas com `AUTH_EXPIRED`**, reservas Pix (pagas/expiradas/vencidas presas), webhooks por tipo e resultado, duplicados, estornos pendentes por idade, divergência de conciliação | `max(bolha_refunds_pending_age_seconds)`; `bolha_pix_reservations_overdue` |
| D8 | **Infra de dados** | Postgres: conexões, locks em espera, transações longas, top queries (`pg_stat_statements`), replicação/backup; Redis: memória, AOF, clientes, latência | `max(pg_stat_activity_max_tx_duration{state="active"})` |
| D9 | **Cliente (RUM)** | Frame time p95 por classe de dispositivo (SLO-08), distribuição de frame time, Web Vitals (LCP, INP, CLS), erros JS, versão do web | consulta ao backend de RUM/Sentry |
| D10 | **Release** | Anotações de deploy (`service.version`), comparação antes/depois de 5xx e p99, flags alteradas | anotações a partir do workflow de deploy |

As métricas do PRD §10 são calculadas por coorte mensal em SQL (fonte da verdade) e exibidas em D6. A taxa de sucesso usa o registro persistido do evento `BubbleExploded{outcome}` (no `audit_log`), para não inferir o resultado a partir do status final:

```sql
-- Taxa de sucesso e mediana até o sucesso (coorte = mês de publicação)
WITH exp AS (
  SELECT (payload->>'bubbleId')::uuid AS bubble_id, payload->>'outcome' AS outcome, occurred_at
  FROM audit_log WHERE action = 'BubbleExploded'
)
SELECT date_trunc('month', b.starts_at) AS coorte,
       count(*) FILTER (WHERE e.outcome = 'SUCCESS')::numeric / count(*) AS taxa_sucesso,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY e.occurred_at - b.starts_at)
         FILTER (WHERE e.outcome = 'SUCCESS') AS mediana_ate_sucesso
FROM bubbles b LEFT JOIN exp e ON e.bubble_id = b.id
WHERE b.starts_at IS NOT NULL          -- publicadas (passaram por ACTIVE)
GROUP BY 1 ORDER BY 1;

-- Guardrail: estorno por cancelamento na triagem (coorte = mês de abertura do item)
SELECT date_trunc('month', created_at) AS coorte,
       count(*) FILTER (WHERE status = 'CANCELLED')::numeric / count(*) AS estorno_por_cancelamento
FROM triage_items GROUP BY 1 ORDER BY 1;
```

A conclusão da triagem do PRD (`COMPLETED ÷ IN_TRIAGE`) é contada por **bolha** que entrou em `IN_TRIAGE` no mês; o painel mostra também a visão por item. As colunas de `audit_log` usadas acima (`action`, `payload`, `occurred_at`) são propostas e devem ser confirmadas no modelo de dados.

---

## 7. Alertas

Princípios: paginar só por **sintoma** que afeta usuário agora ou em breve, e só quando houver ação humana; causas viram painel ou ticket. Todo alerta tem runbook. Severidades de alerta: **P1** (pagina 24×7), **P2** (pagina em horário estendido 8h–22h, senão ticket), **P3** (ticket/canal). A severidade de **incidente** (S1–S4) é declarada pelo IC ([resposta-incidentes.md](resposta-incidentes.md)).

| ID | Condição | Sev. | Destino | Runbook |
| :--- | :--- | :--- | :--- | :--- |
| AL-01 | SLO-01: burn rate > 14,4× em 1 h **e** > 14,4× em 5 min | P1 | On-call primário (pager) + `#incidentes` | [RB-09](runbooks.md#rb-09--deploy-com-falha--rollback), [RB-04](runbooks.md#rb-04--postgres-com-locks-ou-latência-alta) |
| AL-02 | SLO-01: burn rate > 6× em 6 h e > 6× em 30 min | P2 | On-call | RB-04 |
| AL-03 | SLO-01/02: burn rate > 1× em 3 dias | P3 | Ticket para o Tech Lead | — |
| AL-04 | SLO-02: p99 de `POST /quotas` > 2 s por 10 min | P2 | On-call | RB-04, RB-03 |
| AL-05 | **SLO-03: `bolha_overbooking_violations > 0`** | **P1** | On-call + Tech Lead | [RB-04](runbooks.md#rb-04--postgres-com-locks-ou-latência-alta) + incidente S1 |
| AL-06 | Bolhas `ACTIVE` com `expires_at < now() - 70s` > 0 | P1 | On-call | [RB-02](runbooks.md#rb-02--bolhas-vencidas-não-explodidas) |
| AL-07 | SLO-05: p99 do atraso de explosão > 2 s por 15 min | P2 | On-call | RB-01, RB-02 |
| AL-08 | Fila `bubble-expire`/`triage-deadline`: `oldest_waiting_age > 60 s` ou `active = 0` com `waiting > 0` por 5 min | P1 | On-call | [RB-01](runbooks.md#rb-01--fila-bullmq-parada-ou-atrasada) |
| AL-09 | Jobs `failed` > 10 em 15 min em qualquer fila | P2 | On-call | RB-01 |
| AL-10 | Redis indisponível (health check falha 3× em 1 min) ou memória > 85% | P1 / P2 | On-call | [RB-03](runbooks.md#rb-03--redis-indisponível) |
| AL-11 | Postgres: transação ativa > 60 s, ou locks em espera > 20 por 5 min, ou conexões > 85% | P2 | On-call | RB-04 |
| AL-12 | SLO-04: p99 commit → renderização > 200 ms por 15 min (ou SLO-04a: RTT p99 > 150 ms) | P2 | On-call | [RB-08](runbooks.md#rb-08--pico-de-conexões-websocket) |
| AL-13 | Conexões WS > 80% da capacidade testada em carga, ou connects/s > 5× a média de 1 h | P2 | On-call | RB-08 |
| AL-14 | `bolha.outbox.pending` > 1.000 ou lag p99 > 5 s por 5 min | P1 | On-call | RB-01 |
| AL-15 | SLO-06: falhas de webhook > 1% em 30 min, **ou** zero webhooks em 2 h com pagamentos criados no período | P1 | On-call + responsável por pagamentos | [RB-05](runbooks.md#rb-05--webhooks-do-gateway-falhando-ou-duplicados) |
| AL-16 | Assinatura HMAC inválida > 20 em 10 min | P2 | On-call + Tech Lead (possível ataque) | RB-05, [RB-10](runbooks.md#rb-10--vazamento-suspeito-de-dados) |
| AL-17 | Conciliação diária com divergência ≠ 0 | P2 | Responsável por pagamentos + PO | [RB-06](runbooks.md#rb-06--divergência-de-conciliação-financeira) |
| AL-18 | Estorno `PENDING` há > 24 h (qualquer) | P2 | Responsável por pagamentos | [RB-07](runbooks.md#rb-07--estorno-travado) |
| AL-18b | `bolha_pix_reservations_overdue > 0` por 5 min (reserva Pix não liberada após 16 min) | P1 se a bolha está `ACTIVE` (bloqueia capacidade); P2 caso contrário | On-call | [RB-11](runbooks.md#rb-11--reserva-pix-não-liberada-após-15-min) |
| AL-18c | Capturas com `AUTH_EXPIRED` > 0 em 1 h, ou falha de captura > 2% em 1 h | P2 (P1 se > 10% de uma bolha) | On-call + responsável por pagamentos | [RB-12](runbooks.md#rb-12--capturas-falhando-por-pré-autorização-expirada) |
| AL-19 | Reconciliador recuperou > 0 bolhas em 3 execuções seguidas | P3 | Ticket backend | RB-02 |
| AL-20 | SLO-08: sessões com frame time p95 ≤ 16,7 ms < 85% em 24 h, ou erro JS > 2% das sessões | P3 | Ticket front | — |
| AL-21 | Detector de PII em logs (regex CPF/CNPJ/e-mail no pipeline de logs) > 0 | P1 | On-call + Tech Lead + DPO | RB-10 |
| AL-22 | Pico anômalo de leitura de dados pessoais (exportações, consultas admin, 4xx de auth em massa) | P1 | On-call + Tech Lead + DPO | RB-10 |
| AL-23 | Error budget de qualquer SLO ≥ 100% | P3 | PO + Tech Lead (aplica política) | — |
| AL-24 | Certificado TLS expira em < 14 dias; backup diário ausente; arquivamento de WAL atrasado > 10 min (risco ao RPO ≤ 15 min) | P3 (WAL atrasado: P2) | DevOps | [RB-04](runbooks.md#rb-04--postgres-com-locks-ou-latência-alta) |
| AL-25 | Sonda sintética do WebSocket falha 3 minutos seguidos (SLO-01b) | P1 | On-call | RB-08, RB-09 |
| AL-26 | Guardrails do PRD §10 fora da meta na coorte corrente (estorno por cancelamento na triagem ≥ 5% ou contestações procedentes ≥ 2%) | P3 | PO + Tech Lead | — |

Destinos: pager (PagerDuty/Opsgenie ou equivalente a definir na S1) para P1/P2; canal `#incidentes` para todos; e-mail não é usado como canal de alerta.

---

## 8. Checklist de observabilidade por funcionalidade (DoD)

- [ ] Spans nos casos de uso e chamadas externas, com atributos da seção 4.2.
- [ ] Métrica de negócio correspondente (se o fluxo gera evento de domínio).
- [ ] Logs com `event` estável, sem PII (teste de contrato verde).
- [ ] Painel atualizado e, se cria novo modo de falha, alerta + runbook.

---

## Fontes consultadas (AlterEgo)

- **sre** — Google, *The Site Reliability Workbook*, cap. "Implementing SLOs" (coleção *Postmortem Culture Web Docs*): política de error budget aprovada por produto, dev e SRE; ações em caso de esgotamento (prioridade a confiabilidade, freeze); o que documentar no SLO (autores, revisores, aprovadores, data de revisão, justificativa dos números, inclusive quando *ad hoc*); revisão mensal no início (seção 3).
- **devops-sre-cloud** — mesmo capítulo: SLO aspiracional, medir mais perto do usuário (cliente/load balancer), escala do incidente pela fração do budget consumida (seções 2 e 3).
- **asias-observabilidade** (trecho do *Google SRE Book*, cap. 6 "Monitoring Distributed Systems"): quatro sinais de ouro, sintoma × causa, paginar só o que é urgente e acionável, e-mail como canal de alerta de pouco valor (seções 6 e 7).
- **signoz-observabilidade** — SigNoz Docs, *Send Metrics from Node.js application* (auto-instrumentations-node, métricas customizadas com `getMeter`, temporalidade delta) e *OpenTelemetry Node.js — Getting Started* (atributos de recurso consistentes, correlação trace–log, instrumentar apenas o que tem valor) (seção 4).
- **frontend-dev** — Next.js Docs, *Guides: Analytics* (`instrumentation-client.ts`, `useReportWebVitals`, envio com `navigator.sendBeacon`) (seções 4.1 e 6, D9).
