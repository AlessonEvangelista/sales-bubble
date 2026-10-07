# Eventos de Domínio, Outbox e Filas — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · ADR-0010 e ADR-0011 (propostos) · [Máquinas de estado](maquina-estados.md) · [Modelo de dados](modelo-dados.md)

## Sumário

1. [Princípios e envelope](#1-princípios-e-envelope)
2. [Catálogo de eventos](#2-catálogo-de-eventos)
3. [Outbox transacional e relay](#3-outbox-transacional-e-relay)
4. [Filas BullMQ](#4-filas-bullmq)
5. [Reconciliador](#5-reconciliador)
6. [Diagramas de sequência](#6-diagramas-de-sequência)
7. [Fontes consultadas (AlterEgo)](#fontes-consultadas-alterego)

---

## 1. Princípios e envelope

1. **Todo evento de domínio nasce no outbox**, na mesma transação da mudança de estado. Nada é publicado "depois do commit" pelo código do request. Isso evita os dois bugs clássicos: evento sem commit (rollback depois do publish) e commit sem evento (crash entre commit e publish).
2. **Entrega *at-least-once*.** O relay pode publicar o mesmo evento mais de uma vez (crash entre publicar e marcar `published_at`). Todo consumidor é **idempotente** (§3.4). "Exactly-once" ponta a ponta não é prometido.
3. **Ordem:** o relay publica em ordem de `id` (UUID v7, ordenado no tempo) com **um único relay ativo**. A ordem por agregado vale até a entrada nas filas. Depois disso, os consumidores rodam com concorrência e precisam tolerar ordem trocada: toda transição usa a guarda de estado de origem ([maquina-estados.md §1](maquina-estados.md#1-princípios-de-implementação)), e o cliente WS descarta mensagens com `version` menor que a atual.
4. **Eventos carregam fatos, não comandos**, no passado (`QuotaAcquired`), com o mínimo para os consumidores agirem sem reler outros módulos. **Sem PII** no payload: ids, pseudônimos, valores e datas.
5. **Versionamento:** `event_version` inteiro. Campo novo opcional não muda a versão. Mudança incompatível: publicar `v2` em paralelo com `v1` até migrar todos os consumidores. Schemas em `packages/contracts/events/*.ts` (zod), validados no produtor (teste) e no consumidor (runtime).

**Envelope (coluna a coluna de `outbox_events`):**

```json
{
  "event_id": "01926f3a-7c1e-7b2a-9f00-3c5d1e2a4b10",
  "event_type": "QuotaAcquired",
  "event_version": 1,
  "aggregate_type": "bubble",
  "aggregate_id": "01926f2b-0000-7000-8000-00000000b001",
  "occurred_at": "2026-12-08T14:03:22.418Z",
  "trace_parent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "payload": { "...": "específico do evento" }
}
```

---

## 2. Catálogo de eventos

### 2.1 Visão geral

Garantia: **G1** = outbox, *at-least-once*, consumidor idempotente por `(consumer, event_id)`. **WS** = também emitido aos clientes como evento Socket.io derivado (*best-effort*; o cliente reconcilia por snapshot na reconexão).

| Evento | v | Produtor (módulo) | Consumidores (módulo → ação) | Garantia | WS derivado |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `BubblePublished` | 1 | bubble | bubble → agenda `bubble-expire` e `bubble-expiring`; notification → convites a fornecedores (PURCHASE); realtime | G1 | `bubble.state_changed` |
| `BubbleCancelled` | 1 | bubble | payment → anula/estorna 100% das cotas; bidding → rejeita lances; bubble → remove jobs; notification | G1 | `bubble.state_changed` |
| `QuotaReserved` *(proposto)* | 1 | bubble | bubble → agenda `quota-reservation-expire`; realtime | G1 | `bubble.updated` |
| `QuotaAcquired` | 1 | bubble | payment → vincula pagamento à cota; notification → "cota confirmada" e, se `tier_changed`, "mudou de degrau"; realtime | G1 | `bubble.updated` |
| `QuotaReleased` | 1 | bubble | payment → anula a pré-autorização / estorna o Pix (ou cancela a cobrança não paga); notification; realtime | G1 | `bubble.updated` |
| `BubbleExploded` | 1 | bubble | bubble → B8 se `FAILED`; payment → captura (SALE + `SUCCESS`); bidding → abre a janela de 24 h (PURCHASE + `SUCCESS`); bubble → remove jobs pendentes; notification | G1 | `bubble.exploded` |
| `BidSubmitted` | 1 | bidding | notification → criador; bubble → `supplier_invites.status`; realtime | G1 | `bid.submitted` |
| `BidWithdrawn` | 1 | bidding | realtime | G1 | `bid.submitted` (`status: WITHDRAWN`) |
| `BidSelected` | 1 | bidding | payment → captura no preço do lance; bidding → rejeita os demais; bubble → remove `bid-selection-timeout`; notification → participantes e licitantes | G1 | `bubble.state_changed` |
| `PaymentAuthorized` | 1 | payment | bubble → `ConfirmQuota` (Pix: `RESERVED → ACTIVE`) | G1 | — |
| `PaymentCaptured` | 1 | payment | triage → cria item `PENDING_SHIPMENT` e verifica B9; notification | G1 | — |
| `PaymentRefunded` | 1 | payment | notification → "estorno realizado"; platform → auditoria | G1 | `notification.created` |
| `PaymentFailed` | 1 | payment | triage → item `CANCELLED` (`CAPTURE_FAILED`, sem penalidade); notification | G1 | `notification.created` |
| `TriageOpened` | 1 | triage | bubble → `EXPIRED_SUCCESS → IN_TRIAGE` (B9); notification | G1 | `bubble.state_changed` |
| `ShipmentRegistered` | 1 | triage | reputation → `SHIPPED_ON_TIME` (+5) ou, se `on_time = false`, `SHIPPING_LATE` (−15); triage → agenda auto-confirmação e remove `triage-shipping-grace`; notification → comprador | G1 | `notification.created` |
| `DeliveryConfirmed` | 1 | triage | triage → agenda fim da janela de arrependimento; notification | G1 | `notification.created` |
| `WithdrawalRequested` | 1 | triage | triage → agenda prazo de devolução (10 dias); notification → vendedor | G1 | `notification.created` |
| `TriageItemCompleted` | 1 | triage | payment → libera repasse com 6% retidos sobre `final_amount`; reputation → +20 comprador / +30 vendedor; triage → `close-check` | G1 | `notification.created` |
| `TriageItemCancelled` | 1 | triage | payment → estorno (se capturado); reputation → −60 se `reason ∈ {SHIPPING_TIMEOUT, BUYER_CANCELLED_LATE}`; triage → `close-check`; notification | G1 | `notification.created` |
| `TriageClosed` | 1 | triage | bubble → B11/B12; notification | G1 | `bubble.state_changed` |
| `PayoutReleased` | 1 | payment | notification → vendedor; platform → auditoria | G1 | `notification.created` |
| `ScoreChanged` | 1 | reputation | notification → titular | G1 | `notification.created` |
| `ScoreDisputeOpened` | 1 | reputation | notification → fila de moderação; platform → auditoria | G1 | — |
| `ScoreDisputeResolved` | 1 | reputation | notification → titular; platform → auditoria | G1 | `notification.created` |
| `TriageCaseOpened` *(proposto)* | 1 | moderation | triage → `payout_on_hold = true`, pausa prazos (remove jobs); notification → vendedor e fila de moderação | G1 | — |
| `TriageCaseDecided` *(proposto)* | 1 | moderation | triage → T13/T14/T15; payment → estorno total ou parcial; reputation → `TRIAGE_CASE_UPHELD` (−30) se procedente | G1 | `notification.created` |
| `AccountSuspended` *(proposto)* | 1 | moderation | identity → `accounts.status = 'SUSPENDED'` e revoga refresh tokens; bubble → cancela bolhas `ACTIVE` da conta (B7) e libera suas cotas (Q4/Q7); triage → `payout_on_hold` nos itens em que é vendedora | G1 | — |

### 2.2 Payloads de exemplo (v1)

```jsonc
// BubblePublished
{ "bubble_id": "…b001", "type": "SALE", "creator_pseudonym": "TecnoLotes#9C1D", "category": "eletronicos",
  "canvas": { "x": 10240.5, "y": -3320.0 }, "tile": "tile:3:12:-4", "starts_at": "2026-12-08T12:00:00Z",
  "expires_at": "2026-12-10T12:00:00Z", "min_quotas": 40, "max_quotas": 100, "max_pj_share": 50,
  "price_tiers": [ { "min_filled_quotas": 0, "unit_price": 10000 }, { "min_filled_quotas": 40, "unit_price": 9000 },
                   { "min_filled_quotas": 70, "unit_price": 8000 }, { "min_filled_quotas": 100, "unit_price": 7500 } ],
  "version": 1 }

// BubbleCancelled
{ "bubble_id": "…b001", "from_status": "EXPIRED_FAILED", "reason": "GOAL_NOT_MET", "cancelled_by": "SYSTEM",
  "refund_policy": "FULL", "version": 9 }

// QuotaReserved (proposto)
{ "bubble_id": "…b001", "quota_id": "…q777", "payment_id": "…p777", "quantity": 1, "account_type": "PF",
  "reserved_until": "2026-12-08T14:18:22Z", "filled_quotas": 71, "reserved_quotas": 3, "version": 75 }

// QuotaAcquired
{ "bubble_id": "…b001", "quota_id": "…q123", "payment_id": "…p123", "participant_pseudonym": "Bolhista#4F2A",
  "account_type": "PF", "quantity": 1, "filled_quotas": 72, "reserved_quotas": 2, "max_quotas": 100,
  "current_unit_price": 8000, "tier_changed": false, "next_tier": { "min_filled_quotas": 100, "unit_price": 7500 },
  "version": 76 }

// QuotaReleased
{ "bubble_id": "…b001", "quota_id": "…q456", "payment_id": "…p456", "quantity": 1,
  "reason": "USER_LEFT",            // USER_LEFT | RESERVATION_EXPIRED | BUBBLE_EXPLODED_UNPAID | ACCOUNT_SUSPENDED
  "filled_quotas": 71, "reserved_quotas": 2, "current_unit_price": 8000, "tier_changed": true, "version": 77 }

// BubbleExploded
{ "bubble_id": "…b001", "type": "SALE", "outcome": "SUCCESS", "reason": "FULL",
  "filled_quotas": 100, "max_quotas": 100, "min_quotas": 40, "final_unit_price": 7500,
  "exploded_at": "2026-12-09T09:41:07.112Z", "bid_selection_deadline": null,
  "cancelled_reservations": 0, "version": 104 }

// BidSubmitted
{ "bubble_id": "…c900", "bid_id": "…d001", "bidder_pseudonym": "Fornecedor#71AB", "bidder_score_band": "BOM",
  "unit_price": 18990, "delivery_days": 12, "replaces_bid_id": null, "submitted_at": "2026-12-08T15:00:00Z" }

// BidWithdrawn
{ "bubble_id": "…c900", "bid_id": "…d001", "reason": "REPLACED", "replaced_by_bid_id": "…d002" }

// BidSelected
{ "bubble_id": "…c900", "bid_id": "…d002", "mode": "AUTO_TIMEOUT", "unit_price": 18500,
  "seller_account_id": "…a555", "selected_at": "2026-12-11T10:00:00.004Z" }

// PaymentAuthorized
{ "payment_id": "…p777", "bubble_id": "…b001", "quota_id": "…q777", "method": "PIX",
  "authorized_amount": 10000, "gateway_charge_id": "ch_…", "authorized_at": "2026-12-08T14:09:51Z" }

// PaymentCaptured
{ "payment_id": "…p123", "bubble_id": "…b001", "quota_id": "…q123", "method": "CARD",
  "authorized_amount": 10000, "captured_amount": 7500, "released_amount": 2500, "captured_at": "2026-12-09T09:41:12Z" }

// PaymentRefunded
{ "payment_id": "…p456", "refund_id": "…r456", "kind": "VOID",   // VOID | PARTIAL | FULL
  "amount": 10000, "reason": "QUOTA_RELEASED", "completed_at": "2026-12-08T16:00:03Z" }

// PaymentFailed
{ "payment_id": "…p999", "bubble_id": "…b001", "quota_id": "…q999", "stage": "CAPTURE",  // AUTHORIZE | CAPTURE
  "cause": "AUTH_EXPIRED", "gateway_code": "…" }

// TriageCaseOpened (proposto)
{ "case_id": "…k001", "triage_item_id": "…t003", "reason_code": "NOT_RECEIVED", "item_status_at_open": "SHIPPED",
  "paused_remaining": "P4DT6H", "opened_at": "2026-12-15T10:00:00Z" }

// TriageCaseDecided (proposto)
{ "case_id": "…k001", "triage_item_id": "…t003", "decision": "PARTIAL_REFUND", "refund_amount": 2500,
  "final_amount": 5000, "against_seller": true, "decided_at": "2026-12-17T16:00:00Z" }

// AccountSuspended (proposto)
{ "account_id": "…a100", "suspension_id": "…u001", "source_type": "REPORT", "suspended_at": "2026-12-18T09:00:00Z" }

// TriageOpened
{ "bubble_id": "…b001", "seller_account_id": "…a100", "items_open": 97, "items_cancelled": 3,
  "opened_at": "2026-12-09T09:41:30Z" }

// ShipmentRegistered
{ "triage_item_id": "…t001", "bubble_id": "…b001", "carrier": "CORREIOS", "on_time": true,
  "shipped_at": "2026-12-11T10:00:00Z", "auto_confirm_at": "2026-12-21T23:59:59Z" }

// DeliveryConfirmed
{ "triage_item_id": "…t001", "confirmation": "BUYER", "delivered_at": "2026-12-14T18:00:00Z",
  "withdrawal_deadline": "2026-12-21T18:00:00Z" }

// WithdrawalRequested
{ "triage_item_id": "…t001", "requested_at": "2026-12-16T09:00:00Z", "return_deadline": "2026-12-26T09:00:00Z" }

// TriageItemCompleted
{ "triage_item_id": "…t001", "bubble_id": "…b001", "buyer_id": "…a200", "seller_id": "…a100",
  "amount": 7500, "completed_at": "2026-12-21T18:00:05Z" }

// TriageItemCancelled
{ "triage_item_id": "…t002", "bubble_id": "…b001", "reason": "SHIPPING_TIMEOUT", "fault": "SELLER",
  "refund_amount": 7500, "cancelled_at": "2026-12-16T09:41:13Z" }

// TriageClosed
{ "bubble_id": "…b001", "outcome": "COMPLETED", "items_completed": 95, "items_cancelled": 5 }

// PayoutReleased
{ "payout_id": "…o001", "triage_item_id": "…t001", "seller_id": "…a100", "gross_amount": 7500,
  "platform_fee": 450, "gateway_fee": 0, "net_amount": 7050, "released_at": "2026-12-21T18:01:00Z" }

// ScoreChanged
{ "account_id": "…a100", "score_event_id": "…s001", "kind": "TX_COMPLETED_SELLER", "points": 30,
  "old_score": 512, "new_score": 541, "band": "REGULAR", "model_version": "v1" }

// ScoreDisputeOpened
{ "dispute_id": "…x001", "score_event_id": "…s009", "account_id": "…a100", "opened_at": "2026-12-17T10:00:00Z" }

// ScoreDisputeResolved
{ "dispute_id": "…x001", "score_event_id": "…s009", "decision": "UPHELD", "decided_at": "2026-12-20T15:00:00Z" }
```

### 2.3 Eventos WebSocket (cliente)

| Evento WS | Room(s) | Payload | Origem |
| :--- | :--- | :--- | :--- |
| `bubble.updated` | `bubble:{id}`, `tile:{z}:{x}:{y}` (todas as escalas que contêm a bolha) | `{ id, filled_quotas, reserved_quotas, current_price, next_tier, is_near_full, version, committed_at }` (≤ 300 bytes) | `QuotaAcquired`, `QuotaReleased`, `QuotaReserved` |
| `bubble.state_changed` | idem | `{ id, status, version }` | `BubblePublished`, `BubbleCancelled`, `BidSelected`, `TriageOpened`, `TriageClosed` |
| `bubble.exploded` | idem | `{ id, outcome, reason, final_unit_price, version }` | `BubbleExploded` |
| `bid.submitted` | `bubble:{id}` | `{ bubble_id, bid_id, bidder_pseudonym, unit_price, delivery_days, status }` | `BidSubmitted`, `BidWithdrawn` |
| `notification.created` | `account:{id}` (room privada, entra no handshake autenticado) | `{ id, template, title, created_at }` | Consumidor de notification |

`is_expiring` não é enviado: o cliente o calcula a partir de `expires_at` e do *offset* de relógio recebido no handshake.

---

## 3. Outbox transacional e relay

### 3.1 Tabela

`outbox_events` ([modelo-dados.md §3.7](modelo-dados.md#37-notificações-e-plataforma)): `id` (UUID v7), `aggregate_type`, `aggregate_id`, `event_type`, `event_version`, `payload jsonb`, `trace_parent`, `occurred_at`, `published_at`, `attempts`, `last_error`. Índice parcial `WHERE published_at IS NULL`. Trigger `AFTER INSERT` faz `pg_notify('outbox_new', id)`. O `NOTIFY` só é entregue no commit, então o relay nunca acorda por evento abortado.

### 3.2 Escrita (produtor)

```ts
// application/acquire-quota.use-case.ts (trecho)
await this.tx.run(async (trx) => {
  const res = await this.bubbles.tryAcquire(trx, cmd);          // UPDATE condicional (ADR-0002)
  if (!res.ok) throw Conflict(res.reason);                       // rollback → 409
  await this.quotas.insert(trx, quota);                          // índice único parcial PF
  const events = bubble.pullDomainEvents();                      // QuotaAcquired [, BubbleExploded]
  await this.outbox.append(trx, events, { traceParent: ctx.traceParent });
});                                                              // COMMIT → NOTIFY outbox_new
```

### 3.3 Relay (no `worker`)

```text
loop:
  1. Liderança: pg_try_advisory_lock(hashtext('outbox-relay')) numa conexão dedicada.
     Sem a liderança → standby (tenta de novo a cada 5 s).
  2. LISTEN outbox_new; acorda no NOTIFY ou a cada 500 ms (rede de segurança).
  3. SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY id LIMIT 200;
  4. Para cada evento, em ordem:
       a. realtime: emitter Socket.io (Redis) → rooms derivadas (se houver WS derivado);
       b. consumidores: Queue('domain-events').addBulk(
            subscribers(event_type).map(c => ({ name: c, data: envelope,
              opts: { jobId: `${c}__${event_id}`, attempts: 10,
                      backoff: { type: 'exponential', delay: 1000 },
                      removeOnComplete: { age: 86400 }, removeOnFail: false } })));
  5. UPDATE outbox_events SET published_at = now() WHERE id = ANY(:ids);
  6. Erro em 4 → attempts += 1, last_error; o lote para no evento com erro
     (preserva a ordem); alerta se o evento mais velho pendente tiver > 30 s.
```

- **Por que um único relay?** Para preservar a ordem de publicação. Com o volume do R1 (dezenas a centenas de eventos/s), um relay com lotes de 200 e `LISTEN/NOTIFY` dá latência de poucos ms. Se virar gargalo, particionar por `hash(aggregate_id) % N`, com um líder por partição.
- **Por que não publicar direto do api após o commit?** Perderia eventos em crash e não teria retry. O custo do relay na latência WS é de ~5–15 ms (NOTIFY + leitura), dentro do orçamento de 200 ms.
- **Dedupe na fila:** o `jobId` determinístico faz o BullMQ ignorar o `add` repetido enquanto o job existir (inclusive 24 h após completar). Depois disso, a idempotência do consumidor (3.4) cobre.
- **Rastreamento:** o relay e os processadores abrem *spans* filhos a partir de `trace_parent`. Um único trace liga o clique, o commit, o relay, a fila e o consumidor.

### 3.4 Idempotência no consumidor

```ts
// platform/infrastructure/idempotent-consumer.ts
export async function handleOnce(consumer: string, evt: Envelope, fn: (trx: Tx) => Promise<void>) {
  await prisma.$transaction(async (trx) => {
    const inserted = await trx.$executeRaw`
      INSERT INTO processed_events (consumer, event_id) VALUES (${consumer}, ${evt.event_id}::uuid)
      ON CONFLICT DO NOTHING`;
    if (inserted === 0) return;          // já processado → no-op (ack do job)
    await fn(trx);                       // efeitos + novos eventos no outbox, na MESMA transação
  });
}
```

- Efeitos externos (gateway) não entram na transação. Eles usam **chave de idempotência derivada do evento** no próprio gateway (ex.: `capture__{payment_id}`, `refund__{payment_id}__{reason}`) e a guarda de estado (`UPDATE payments … WHERE status = 'AUTHORIZED'`). Se o processo cair depois de chamar o gateway e antes do commit, o retry repete a chamada com a mesma chave, e o gateway devolve o mesmo resultado.
- Consumidores que só emitem WS ou notificação usam a `dedupe_key` de `notifications` (`{event_id}:{account_id}:{channel}`).

---

## 4. Filas BullMQ

Configuração comum: Redis 7 com AOF `everysec` e `noeviction`; **mínimo de 2 réplicas de worker** (Spec F7); `lockDuration` 10 s, `stalledInterval` 5 s, `maxStalledCount` 2; **exceção `bubble-expire`:** processador dedicado com `lockDuration` 1.000 ms (renovado a cada ~500 ms) e `stalledInterval` 500 ms, para que a queda de uma réplica no meio do job ainda caiba nos ≤ 2 s (o job é só um `UPDATE` de milissegundos; um falso *stalled* por *event loop* bloqueado > 1 s apenas repete um job idempotente); `removeOnComplete` por idade; `removeOnFail: false` (DLQ = jobs *failed*, com alerta). IDs customizados sem `:`, usando `__` como separador. Todo processador executa um **caso de uso idempotente** com guarda de estado; o job não carrega estado autoritativo, só ids.

| Fila | Job (name) | `jobId` | Delay | Tentativas / backoff | Idempotência | Origem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `bubble-expire` *(canônica)* | `explode` | `expire__{bubbleId}` | `expires_at − now()` | 10, exponencial 500 ms | `UPDATE … WHERE status='ACTIVE' AND expires_at <= now()`; 0 linhas e ainda `ACTIVE` com `expires_at` futuro → reagenda (relógio adiantado) | Consumidor de `BubblePublished` |
| `bubble-expiring` *(canônica)* | `warn` | `expiring__{bubbleId}` | `expires_at − 1 h − now()` (só se > 0) | 5, exponencial 2 s | `notifications.dedupe_key`; no-op se a bolha não está `ACTIVE` | Consumidor de `BubblePublished` |
| `bid-selection-timeout` *(canônica)* | `auto-select` | `bidsel__{bubbleId}` | 24 h após `exploded_at` | 10, exponencial 1 s | `UPDATE bubbles … WHERE status='EXPIRED_SUCCESS' AND selected_bid_id IS NULL` | Consumidor de `BubbleExploded` (PURCHASE) |
| `bid-selection-timeout` | `warn` | `bidselwarn__{bubbleId}` | 22 h após `exploded_at` (T−2 h, Spec F11) | 5 | `dedupe_key` | idem |
| `triage-deadline` *(canônica)* | `shipping` | `ship__{itemId}` | `shipping_deadline − now()` | 10, exponencial 1 s | T3 (marca atrasado) com guarda `status='PENDING_SHIPMENT' AND NOT is_late AND now() > shipping_deadline` | Consumidor de `PaymentCaptured` |
| `triage-shipping-grace` *(proposta)* | `cancel` | `grace__{itemId}` | `shipping_grace_deadline − now()` (+3 dias) | 10, exponencial 1 s | T5 com guarda `status='PENDING_SHIPMENT' AND is_late AND now() > shipping_grace_deadline` | T3 |
| `triage-deadline` | `warn` | `{kind}warn__{itemId}` | prazo − 24 h | 5 | `dedupe_key` | idem (envio, devolução) |
| `triage-deadline` | `auto-confirm` | `autoconf__{itemId}` | `auto_confirm_at − now()` | 10 | T5 com guarda `status='SHIPPED'` | `ShipmentRegistered` (reagendado se o rastreio atualizar a entrega) |
| `triage-deadline` | `withdrawal-end` | `wdend__{itemId}` | `withdrawal_deadline − now()` | 10 | T7 com guarda `status='DELIVERED' AND NOT payout_on_hold` | `DeliveryConfirmed` |
| `triage-deadline` | `return` | `return__{itemId}` | `return_deadline − now()` | 10 | T9 com guarda `status='WITHDRAWAL_REQUESTED'` e índice único de caso aberto | `WithdrawalRequested` |
| `quota-reservation-expire` *(proposta)* | `expire` | `resv__{quotaId}` | `reserved_until − now()` = `min(15 min, tempo restante)` | 10, exponencial 500 ms | Q4 com guarda `status='RESERVED' AND reserved_until <= now()` | `QuotaReserved` |
| `cnpj-verification-retry` *(proposta)* | `retry` / `revalidate` | `cnpj__{accountId}__{n}` | 15 min (por 24 h) / 30 dias | 3 por execução | Atualiza `company_profiles` se mudou; idempotente por natureza | Cadastro PJ / revalidação |
| `domain-events` *(proposta)* | nome do consumidor | `{consumer}__{eventId}` | 0 | 10, exponencial 1 s (até ~17 min) | `processed_events` | Relay do outbox |
| `email` *(proposta)* | template | `mail__{notificationId}` | 0 | 8, exponencial 5 s | `notifications.status` | Consumidor de notification |
| `maintenance` *(proposta)* | `retention`, `canvas-cleanup`, `score-decay`, `partitions` | repetível (cron) | 03:00 BRT; `canvas-cleanup` a cada 10 min | 3 | Operações em lote idempotentes | Repeatable jobs |

Cancelamento de timers: em `BubbleCancelled`/`BubbleExploded`, o consumidor chama `queue.remove(jobId)`. Se a remoção falhar, nada se perde: o job roda, encontra a guarda falsa e termina como no-op.

---

## 5. Reconciliador

Roda no `worker` a cada **1 min**, como `setInterval` sob `pg_try_advisory_lock(hashtext('reconciler'))`. **Não depende do Redis** para decidir: lê o Postgres (fonte da verdade) e executa os casos de uso diretamente quando o Redis está indisponível, ou reenfileira quando está disponível.

| # | Verificação (SQL resumido) | Ação | Métrica / alerta |
| :--- | :--- | :--- | :--- |
| R1 | `bubbles WHERE status='ACTIVE' AND expires_at <= now() - interval '2 seconds'` | Executa `ExplodeByTime` direto (idempotente) | `reconciler_explosions_total` > 0 → alerta (timer atrasou) |
| R2 | `bubbles WHERE status='ACTIVE'` sem job `expire__{id}` no Redis (amostragem por lote; varredura completa após detectar reinício do Redis) | Recria `bubble-expire`/`bubble-expiring` | `reconciler_jobs_recreated_total` |
| R3 | `quotas WHERE status='RESERVED' AND reserved_until <= now() - interval '5 seconds'` | Executa `ExpireReservation` | — |
| R4 | `bubbles WHERE status='EXPIRED_SUCCESS' AND type='PURCHASE' AND selected_bid_id IS NULL AND bid_selection_deadline <= now()` | Executa `AutoSelectOnTimeout` | alerta |
| R5 | `triage_items` vencidos em `shipping_deadline` / `shipping_grace_deadline` / `auto_confirm_at` / `withdrawal_deadline` / `return_deadline` | Executa a transição de prazo correspondente | alerta |
| R6 | `bubbles WHERE status='EXPIRED_SUCCESS'` com todas as capturas resolvidas e sem `TriageOpened` há > 5 min | Reemite o *check* B9 | alerta |
| R7 | `outbox_events WHERE published_at IS NULL AND occurred_at < now() - interval '30 seconds'` | Não publica (é papel do relay): alerta "relay parado" | **page** |
| R8 | `payments WHERE status IN ('PENDING','AUTHORIZED') AND updated_at < now() - interval '15 minutes'` com divergência suspeita | Consulta o gateway (`getCharge`) e aplica o estado real | `payment_drift_total` |
| R9 | `webhook_events WHERE status IN ('RECEIVED','FAILED') AND received_at < now() - interval '2 minutes'` | Reprocessa | alerta |

Conciliação financeira diária (gateway × `payments`/`refunds`/`payouts`) é um job separado na fila `maintenance`, com relatório para a operação.

---

## 6. Diagramas de sequência

### 6.1 Aquisição da última cota com explosão (cartão)

```mermaid
sequenceDiagram
    autonumber
    actor U as Participante (PF)
    participant W as web
    participant A as api (AcquireQuota)
    participant PG as PostgreSQL
    participant GW as Pagar.me
    participant RL as worker: relay
    participant R as Redis (adapter/filas)
    participant WS as api: Socket.io (N nós)
    participant C as worker: consumidores

    U->>W: "Entrar na bolha"
    W->>A: POST /api/v1/bubbles/{id}/quotas<br/>Idempotency-Key: k1
    A->>PG: INSERT idempotency_keys (conta, k1, IN_PROGRESS)
    Note over A,PG: chave repetida + COMPLETED → devolve a resposta salva
    A->>PG: SELECT bolha (pré-validação barata: ACTIVE, PF sem cota, não é criador)
    A->>GW: authorize(initial_price × 1, idem=pay__{paymentId})
    GW-->>A: authorized
    A->>PG: BEGIN
    A->>PG: UPDATE bubbles SET filled = filled+1, status = CASE(...)<br/>WHERE id AND status='ACTIVE' AND filled+reserved+1 <= max<br/>AND expires_at > now() RETURNING ...
    alt 1 linha e filled = max (última cota)
        A->>PG: INSERT quotas (ACTIVE)
        A->>PG: UPDATE bubbles SET final_unit_price = degrau atingido
        A->>PG: INSERT outbox (QuotaAcquired, BubbleExploded{SUCCESS, FULL})
        A->>PG: UPDATE idempotency_keys → COMPLETED (201)
        A->>PG: COMMIT → NOTIFY outbox_new
        A-->>W: 201 Created { quota, bubble: { status: EXPIRED_SUCCESS } }
        PG-->>RL: NOTIFY outbox_new
        RL->>PG: SELECT pendentes ORDER BY id
        RL->>R: emitter → rooms bubble:{id}, tile:* (bubble.updated, bubble.exploded)
        R-->>WS: pub/sub do adapter
        WS-->>W: bubble.exploded (todos os clientes da room; p99 < 200 ms)
        RL->>R: addBulk domain-events (payment, bidding, bubble, notification)
        RL->>PG: UPDATE outbox SET published_at
        R-->>C: payment.on-bubble-exploded
        C->>GW: capture(final × qtd) por pagamento (idem=capture__{paymentId})
        C->>PG: payments → CAPTURED + outbox PaymentCaptured
    else 0 linhas (esgotada / encerrada) ou 23505 (PF já tem cota)
        A->>PG: ROLLBACK
        A->>GW: void(authorization) (idem=void__{paymentId})
        A->>PG: UPDATE idempotency_keys → COMPLETED (409)
        A-->>W: 409 problem+json (QUOTA_SOLD_OUT | BUBBLE_NOT_ACTIVE | PF_QUOTA_LIMIT)
    end
```

### 6.2 Explosão por tempo com o worker caindo no meio

```mermaid
sequenceDiagram
    autonumber
    participant R as Redis (BullMQ)
    participant W1 as worker #1
    participant W2 as worker #2
    participant PG as PostgreSQL
    participant RC as Reconciliador (líder)
    participant A as api (POST quotas)

    Note over R: job expire__{id} com delay até expires_at
    R->>W1: job pronto em T (W1 obtém o lock do job, lockDuration 1 s)
    W1->>PG: BEGIN; UPDATE bubbles SET status = CASE WHEN filled>=min ...<br/>WHERE id AND status='ACTIVE' AND expires_at <= now()
    Note over W1: processo morre antes do COMMIT
    PG-->>PG: conexão cai → ROLLBACK automático (nada foi gravado)
    A->>PG: (T + 1 s) UPDATE ... AND expires_at > now() → 0 linhas
    A-->>A: 409 BUBBLE_NOT_ACTIVE (corretude independe do timer)
    Note over R,W2: lock do job expira (1 s, fila bubble-expire) → verificação de stalled (500 ms) devolve o job para wait
    R->>W2: job expire__{id} (tentativa 2)
    W2->>PG: BEGIN; UPDATE ... WHERE status='ACTIVE' AND expires_at <= now() → 1 linha
    W2->>PG: cancela reservas RESERVED; INSERT outbox BubbleExploded{TIME}; COMMIT
    W2->>R: ack do job (completed)
    Note over W1,W2: variante: W1 commitou e morreu antes do ack → W2 repete,<br/>UPDATE devolve 0 linhas, status já não é ACTIVE → no-op (sem evento duplicado)
    Note over RC: variante: Redis perdeu o job → em ≤ 60 s o RC acha<br/>status='ACTIVE' AND expires_at <= now()-2s e executa ExplodeByTime
    RC->>PG: SELECT ativas vencidas → nenhuma (W2 já explodiu)
```

Atraso esperado: ≤ 2 s com queda de réplica, mesmo durante o job (lock de 1 s + stalled de 500 ms + `UPDATE` em ms, Spec F7). Perda dos jobs no Redis: ≤ 60 s pelo reconciliador, **com alerta** de violação da meta (Spec §6). Em todos os casos, nenhuma cota é aceita depois de `expires_at`.

### 6.3 Seleção de lance com timeout

```mermaid
sequenceDiagram
    autonumber
    participant B as worker: bubble
    participant BD as worker: bidding
    participant R as Redis (BullMQ)
    participant PG as PostgreSQL
    actor CR as Criador da bolha de compra
    participant A as api (SelectBid)

    B->>PG: BubbleExploded{SUCCESS} (PURCHASE): bid_selection_deadline = exploded_at + 24 h
    BD->>R: add bidsel__{id} (delay 24 h) e bidselwarn__{id} (delay 22 h)
    R->>BD: (T+22 h) warn → notificação ao criador "faltam 2 h"
    par Criador escolhe perto do fim
        CR->>A: POST /bubbles/{id}/bids/{bidId}/select
        A->>PG: BEGIN; UPDATE bubbles SET selected_bid_id=:bid, final_unit_price=:p<br/>WHERE id AND status='EXPIRED_SUCCESS' AND selected_bid_id IS NULL<br/>AND now() < bid_selection_deadline
    and Timeout dispara
        R->>BD: (T+24 h) auto-select
        BD->>PG: SELECT bid ORDER BY unit_price, submitted_at LIMIT 1<br/>(SUBMITTED, licitante com CNPJ ATIVA)
        BD->>PG: BEGIN; UPDATE bubbles SET selected_bid_id=:menor ...<br/>WHERE status='EXPIRED_SUCCESS' AND selected_bid_id IS NULL
    end
    alt criador venceu a corrida (1 linha)
        A->>PG: bids: escolhido SELECTED; INSERT outbox BidSelected{CREATOR}; COMMIT
        A-->>CR: 200 OK
        BD->>PG: UPDATE → 0 linhas → no-op
    else timeout venceu (1 linha)
        BD->>PG: bids SELECTED; outbox BidSelected{AUTO_TIMEOUT}; COMMIT
        A->>PG: UPDATE → 0 linhas → ROLLBACK
        A-->>CR: 409 BID_SELECTION_WINDOW_CLOSED
    else nenhum lance válido
        BD->>PG: UPDATE bubbles SET status='CANCELLED', cancel_reason='NO_VALID_BID'<br/>WHERE status='EXPIRED_SUCCESS'; outbox BubbleCancelled; COMMIT
    end
    Note over PG: BidSelected → payment captura target→preço do lance;<br/>bidding rejeita os demais; triage abre os itens após as capturas
```

### 6.4 Webhook de captura duplicado

```mermaid
sequenceDiagram
    autonumber
    participant GW as Pagar.me
    participant A as api (WebhookController)
    participant PG as PostgreSQL
    participant C as worker: payment

    GW->>A: POST /api/v1/webhooks/payments/pagarme<br/>{ id: "hook_123", type: "charge.paid", charge: ch_9 }
    A->>A: verifica a assinatura HMAC (timing-safe) → inválida = 401
    A->>PG: INSERT webhook_events (PAGARME, hook_123, ...)<br/>ON CONFLICT (provider, provider_event_id) DO NOTHING
    PG-->>A: 1 linha (novo)
    A-->>GW: 200 OK (rápido; processamento assíncrono)
    A->>PG: outbox/fila: process-webhook(hook_123)
    C->>GW: GET /charges/ch_9 (fetch-back: não confia no payload)
    GW-->>C: status = paid
    C->>PG: BEGIN; UPDATE payments SET status='AUTHORIZED' (Pix pago)<br/>WHERE gateway_charge_id='ch_9' AND status='PENDING' → 1 linha
    C->>PG: INSERT outbox PaymentAuthorized; webhook_events → PROCESSED; COMMIT

    Note over GW: retry do gateway (timeout de rede no 1º envio)
    GW->>A: POST ... { id: "hook_123", type: "charge.paid" } (mesmo id)
    A->>PG: INSERT ... ON CONFLICT DO NOTHING → 0 linhas
    A-->>GW: 200 OK (duplicado; nada a fazer)

    Note over GW: evento DIFERENTE com o mesmo efeito (ex.: order.paid)
    GW->>A: POST ... { id: "hook_124", type: "order.paid", charge: ch_9 }
    A->>PG: INSERT webhook_events → 1 linha (id novo)
    A-->>GW: 200 OK
    C->>PG: UPDATE payments ... WHERE status='PENDING' → 0 linhas (já AUTHORIZED)
    C->>PG: webhook_events hook_124 → IGNORED (sem evento de domínio)
```

O mesmo desenho vale para `charge.captured` e `charge.refunded`: dedupe pelo id do evento do gateway + guarda de estado no `UPDATE` + *fetch-back*. Se o Pagar.me v5 não oferecer HMAC (questão Q2 do [c4.md](c4.md#9-riscos-arquiteturais-e-questões-em-aberto)), a verificação passa a *basic auth* + allowlist de IP, e o *fetch-back* se torna a garantia principal.

---

## Fontes consultadas (AlterEgo)

- **arquitetura-ddd** — *DDD + Microservices Web* (microservices.io, Chris Richardson), página "Event sourcing", seção *Context/Forces*: um comando precisa atualizar o banco **e** publicar a mensagem de forma atômica; 2PC não é opção; publicar dentro ou depois da transação não é confiável; a ordem por agregado deve ser preservada. Página "Messaging": o *Transactional Outbox* "permite enviar mensagens como parte de uma transação de banco". *DDD by Examples: Library*: começar com consistência imediata entre agregados e ter a troca para eventual (store-and-forward) barata.
- **senior-backend-nodejs** — *Architecture Flashcards (NotebookLM)*: o padrão *Polling publisher* publica lendo a tabela de outbox; *audit logging* como padrão de observabilidade. *Architecture Quiz (hard)*: propósito do *Transactional Outbox* (enviar a mensagem de forma confiável como parte da transação).
- **asias-dist-data-systems** — *Apache Kafka Docs*, "Message Delivery Semantics": definições de *at-most-once*, *at-least-once* e *exactly-once*, e o alerta de que alegações de exactly-once costumam ter "letras miúdas" quando produtor ou consumidor falham. Base do princípio 2 e da idempotência por chave. *System Design Primer* (Donne Martin), "Asynchronism / task queues": trabalho lento em fila, fora do request.
- **asias-postgresql** — *PostgreSQL 17 Docs* §13.2 (Read Committed reavalia o `WHERE` do `UPDATE` concorrente) e §13.3 (*advisory locks* para eleição de líder do relay e do reconciliador; não segurar locks em transações longas).
- **performance-engineer** — *k6 Docs* (Grafana), "Thresholds": p99 < 200 ms do WS e atraso de explosão como *thresholds* do teste de carga.
