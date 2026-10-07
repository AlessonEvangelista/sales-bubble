# Runbooks — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) (RNF02, RNF04, RF07) · [Spec do Produto](../../SPEC.md) (§5, §6) · [Plano de Projeto v2](../planing-project.md) (E9, R3, R5, R6)

> Procedimentos para os modos de falha conhecidos. Cada runbook é disparado por um alerta de [slo-observabilidade.md §7](slo-observabilidade.md#7-alertas) e se integra ao processo de [resposta a incidentes](resposta-incidentes.md). Decisões assumidas: ADR-0002, ADR-0003, ADR-0010, ADR-0011, ADR-0012 (status **Proposto**). A plataforma de contêiner é decidida na S1; os comandos de plataforma usam Cloud Run, com o equivalente no Railway quando diferente.

---

## 0. Convenções

- **Antes de agir:** declare/registre o incidente no `#incidentes` (mesmo que S3) e anote cada ação com horário.
- **Acesso:** comandos de banco rodam pela conta `ops_readonly` (leitura) ou `ops_rw` (escrita, com aprovação do IC). Nunca copiar dados pessoais para fora do ambiente; resultados de query com PII não são colados no chat.
- **CLI de operação:** `npm run ops -- <comando>` (em `tools/ops`, executada via job da plataforma com as credenciais do ambiente). Comandos citados aqui fazem parte do escopo de E9 e devem existir antes do Gate E.
- **Variáveis:** `$DB` = string de conexão do ambiente (via secret manager), `$REDIS` = URL do Redis, prefixo de filas BullMQ `bull`.
- **Fonte da verdade:** o PostgreSQL. Redis e filas são derivados e podem ser reconstruídos (ADR-0011).

| ID | Runbook | Alertas |
| :--- | :--- | :--- |
| RB-01 | Fila BullMQ parada ou atrasada | AL-08, AL-09, AL-14 |
| RB-02 | Bolhas vencidas não explodidas | AL-06, AL-07, AL-19 |
| RB-03 | Redis indisponível | AL-10 |
| RB-04 | Postgres com locks ou latência alta | AL-02, AL-04, AL-05, AL-11, AL-24 |
| RB-05 | Webhooks do gateway falhando ou duplicados | AL-15, AL-16 |
| RB-06 | Divergência de conciliação financeira | AL-17 |
| RB-07 | Estorno travado | AL-18 |
| RB-08 | Pico de conexões WebSocket | AL-12, AL-13, AL-25 |
| RB-09 | Deploy com falha / rollback | AL-01, critérios do plano de release |
| RB-10 | Vazamento suspeito de dados | AL-16, AL-21, AL-22 |
| RB-11 | Reserva Pix não liberada após 15 min | AL-18b |
| RB-12 | Capturas falhando por pré-autorização expirada | AL-18c |

---

## RB-01 — Fila BullMQ parada ou atrasada

**Sintomas:** explosões, avisos de `EXPIRING`, fim de janela de lance ou prazos de triagem não acontecem no horário; notificações atrasam; `bolha.outbox.pending` cresce.
**Alertas:** AL-08 (job mais antigo > 60 s ou `active = 0` com `waiting > 0`), AL-09 (falhas), AL-14 (outbox).

**Diagnóstico**
```bash
# 1. Estado das filas
npm run ops -- queues:status          # waiting/delayed/active/failed/paused por fila
redis-cli -u $REDIS LLEN bull:bubble-expire:wait
redis-cli -u $REDIS ZCARD bull:bubble-expire:delayed
redis-cli -u $REDIS LLEN bull:bubble-expire:active
redis-cli -u $REDIS ZCARD bull:bubble-expire:failed
redis-cli -u $REDIS HGET bull:bubble-expire:meta paused   # "1" = fila pausada

# 2. Workers vivos? (cada worker registra nome de cliente no Redis)
redis-cli -u $REDIS CLIENT LIST | grep -c bolha-worker
gcloud run services describe bolha-worker --region=$REGION --format='value(status.conditions)'

# 3. Últimas falhas
npm run ops -- queues:failed --queue=bubble-expire --limit=20   # mostra failedReason, attemptsMade (sem payload com PII)
```
```sql
-- 4. Outbox acumulado
SELECT count(*) AS pendentes, min(occurred_at) AS mais_antigo, now() - min(occurred_at) AS lag
FROM outbox_events WHERE published_at IS NULL;
SELECT type, count(*), max(attempts) FROM outbox_events WHERE published_at IS NULL GROUP BY type;
```

**Mitigação**
1. Fila pausada por engano → `npm run ops -- queues:resume --queue=<fila>`.
2. Nenhum worker ativo / travado → reiniciar o serviço worker (`gcloud run services update bolha-worker --region=$REGION --update-env-vars=RESTART_AT=$(date +%s)`; Railway: *Restart* do serviço). Escalar para 2+ instâncias se `waiting` estiver alto.
3. Jobs falhando por bug de código → corrigir/rollback (RB-09); depois `npm run ops -- queues:retry-failed --queue=<fila>` (jobs são idempotentes).
4. Outbox travado em um evento "venenoso" (`attempts` alto) → `npm run ops -- outbox:quarantine --id=<id>` (move para `last_error`, segue o resto) e abrir bug.
5. Em qualquer caso, o reconciliador de 1 min continua explodindo bolhas pelo banco; confirme com RB-02.

**Verificação:** `oldest_waiting_age` < 5 s; `outbox.pending` volta a ~0; D4 sem bolhas atrasadas; nenhum job novo em `failed`.
**Escalonamento:** 15 min sem melhora → Backend sênior; explosões atrasadas > 70 s → incidente S2 (S1 se afetar dinheiro).

---

## RB-02 — Bolhas vencidas não explodidas

**Sintomas:** bolha com `expires_at` no passado ainda `ACTIVE`, aceitando cotas; usuários relatam "o timer zerou e nada aconteceu".
**Alertas:** AL-06 (`ACTIVE` com `expires_at < now() − 70 s`), AL-07 (p99 > 2 s), AL-19 (reconciliador recuperando com frequência).

**Diagnóstico**
```sql
SELECT id, type, expires_at, filled_quotas, min_quotas, max_quotas, now() - expires_at AS atraso
FROM bubbles
WHERE status = 'ACTIVE' AND expires_at < now() - interval '5 seconds'
ORDER BY expires_at LIMIT 100;
```
```bash
npm run ops -- reconciler:status          # última execução, duração, recuperadas, erro
redis-cli -u $REDIS ZSCORE bull:bubble-expire:delayed <jobId>   # o job existe? (jobId = bubble-expire:<bubbleId>)
```
Perguntas: o reconciliador está rodando (RB-01 se a fila de repetição parou)? Houve perda de dados no Redis (RB-03)? A query do reconciliador está lenta/bloqueada (RB-04)?

**Mitigação**
1. Disparar o reconciliador manualmente: `npm run ops -- reconciler:run-now`. Ele aplica a mesma transição idempotente (ADR-0011): `UPDATE bubbles SET status = CASE WHEN filled_quotas >= min_quotas THEN 'EXPIRED_SUCCESS' ELSE 'EXPIRED_FAILED' END, exploded_at = now() WHERE id = :id AND status = 'ACTIVE' AND expires_at <= now()` + outbox `BubbleExploded{reason: TIME}`.
2. Se o reconciliador também falhar, explodir uma bolha específica: `npm run ops -- bubble:explode --id=<id>` (mesmo caminho de código, com auditoria).
3. Para impedir novas cotas em bolha vencida enquanto isso, o `UPDATE` de cota exige `status = 'ACTIVE'`; se o atraso for generalizado, desligar `quota_acquisition_enabled`.
4. Reagendar jobs perdidos: `npm run ops -- timers:rebuild` (recria `bubble-expire`, `bubble-expiring`, `bid-selection-timeout`, `triage-deadline` a partir do banco; idempotente por `jobId`).
5. Cotas aceitas depois de `expires_at`: listar e tratar como incidente de produto (estorno se a pessoa entrou após o fim).
```sql
SELECT q.id, q.bubble_id, q.created_at, b.expires_at
FROM quotas q JOIN bubbles b ON b.id = q.bubble_id
WHERE q.created_at > b.expires_at;
```

**Verificação:** query de diagnóstico vazia; `explosion_delay` p99 ≤ 2 s nas próximas explosões; notificações de explosão enviadas (`notifications` com tipo de explosão para as bolhas recuperadas).
**Escalonamento:** qualquer bolha > 70 s atrasada = S2; cotas aceitas após o fim ou estorno não disparado em bolha `EXPIRED_FAILED` = S1 (Tech Lead + PO).

---

## RB-03 — Redis indisponível

**Sintomas:** erros 5xx em endpoints que usam rate limit/idempotência; WS sem broadcast entre instâncias; filas paradas; `/health/ready` com `redis: down`.
**Alertas:** AL-10.

**Diagnóstico**
```bash
redis-cli -u $REDIS PING
redis-cli -u $REDIS INFO persistence | grep -E 'aof_enabled|aof_last_bgrewrite_status|aof_last_write_status|loading'
redis-cli -u $REDIS INFO memory | grep -E 'used_memory_human|maxmemory_human|maxmemory_policy'
redis-cli -u $REDIS INFO clients | grep connected_clients
```
Console do provedor gerenciado: status da instância, failover em andamento, manutenção programada.

**Mitigação**
1. **Falha transitória / failover do provedor:** as aplicações reconectam sozinhas (ioredis com retry). Acompanhar.
2. **Memória cheia** (`noeviction` rejeita escrita): identificar crescimento (`npm run ops -- redis:bigkeys`); limpar filas `completed`/`failed` antigas (`npm run ops -- queues:clean --older-than=24h`); escalar a instância.
3. **Indisponibilidade prolongada (> 5 min):**
   - Ligar `maintenance_mode` se escritas de cota estiverem falhando de forma inconsistente; o banco continua íntegro (ADR-0002 não depende do Redis).
   - Ao voltar, **reconstruir timers a partir do Postgres**: `npm run ops -- timers:rebuild`, e rodar `reconciler:run-now` (RB-02).
   - Chaves de idempotência perdidas: a idempotência de cota também é garantida pelo índice/registro no banco; verificar duplicidades com a query do SLO-03.
4. **Perda de dados do Redis (sem AOF ou corrupção):** tratar como S2; o banco é a verdade — reconstruir timers, sessões de WS reconectam, rate limits zeram.

**Verificação:** `PING` ok; filas processando (RB-01); D5 com broadcast entre instâncias (sonda sintética AL-25 verde); nenhuma bolha vencida pendente.
**Escalonamento:** > 15 min → suporte do provedor (ticket prioridade máxima) + Tech Lead; impacto em explosões → S1/S2 conforme RB-02.

---

## RB-04 — Postgres com locks ou latência alta

**Sintomas:** p99 de API alto, timeouts em `POST /quotas`, pool de conexões esgotado, explosões lentas.
**Alertas:** AL-02, AL-04, AL-11; AL-05 (violação de integridade de cotas); AL-24 (WAL/backup).

**Diagnóstico**
```sql
-- Transações longas e o que estão fazendo
SELECT pid, usename, application_name, state, now() - xact_start AS tx_idade,
       wait_event_type, wait_event, left(query, 120) AS query
FROM pg_stat_activity
WHERE state <> 'idle' ORDER BY xact_start NULLS LAST LIMIT 30;

-- Quem bloqueia quem
SELECT a.pid AS bloqueado, pg_blocking_pids(a.pid) AS bloqueadores, now() - a.query_start AS espera, left(a.query, 100)
FROM pg_stat_activity a WHERE cardinality(pg_blocking_pids(a.pid)) > 0;

-- Hotspot de linha (muitas cotas na mesma bolha é esperado; espera longa não é)
SELECT relation::regclass, mode, count(*) FROM pg_locks WHERE NOT granted GROUP BY 1, 2;

-- Top queries por tempo total
SELECT calls, round(total_exec_time) AS total_ms, round(mean_exec_time, 1) AS media_ms, left(query, 120)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;

-- Conexões vs limite
SELECT count(*), current_setting('max_connections') FROM pg_stat_activity;

-- Invariante de cotas (AL-05)
SELECT id, filled_quotas, max_quotas FROM bubbles WHERE filled_quotas > max_quotas;
SELECT bubble_id, account_id, count(*) FROM quotas
WHERE account_type = 'PF' AND status = 'ACTIVE' GROUP BY 1, 2 HAVING count(*) > 1;
```

**Mitigação**
1. **Violação de integridade (AL-05) → S1 imediato:** desligar `quota_acquisition_enabled`, preservar evidências (não "corrigir" contadores à mão), acionar Tech Lead; tratar participantes excedentes com estorno conforme decisão do PO.
2. Transação longa bloqueando (ex.: migration, query de relatório): `SELECT pg_cancel_backend(<pid>);` e, se não resolver em 30 s, `SELECT pg_terminate_backend(<pid>);` (com aprovação do IC se for processo da aplicação).
3. Pool esgotado: verificar vazamento de conexão após deploy recente (→ RB-09); reduzir instâncias do worker temporariamente se ele estiver saturando o banco; ajustar `connection_limit` por instância.
4. Query nova lenta: rollback do deploy que a introduziu; índice faltante entra como migration `CREATE INDEX CONCURRENTLY` (nunca criado à mão em produção).
5. Recurso da instância saturado (CPU/IO): escalar a instância gerenciada; pausar jobs não críticos (`npm run ops -- queues:pause --queue=reconciliation-daily`).
6. **WAL/backup atrasado (AL-24):** verificar arquivamento no console do provedor; o RPO ≤ 15 min (RNF04) depende dele — abrir ticket com o provedor se atraso > 10 min.

**Verificação:** p99 de `quota.reserve` < 100 ms; sem bloqueios > 5 s; conexões < 70%; invariantes vazias.
**Escalonamento:** 15 min com SLO-02 violado → Backend sênior + Tech Lead; restore (PITR) só por decisão do IC com Tech Lead (RTO ≤ 4 h).

---

## RB-05 — Webhooks do gateway falhando ou duplicados

**Sintomas:** pagamentos Pix pagos mas cota ainda "reservada"; capturas/estornos sem confirmação; picos de 4xx/5xx em `POST /webhooks/payments/pagarme`; duplicidades.
**Alertas:** AL-15 (falhas > 1% ou silêncio de 2 h com pagamentos criados), AL-16 (HMAC inválido).

**Diagnóstico**
```sql
-- Situação dos webhooks (colunas propostas de webhook_events)
SELECT status, type, count(*), max(received_at) AS ultimo
FROM webhook_events WHERE received_at > now() - interval '2 hours'
GROUP BY 1, 2 ORDER BY 3 DESC;

SELECT id, provider_event_id, type, attempts, left(last_error, 200)
FROM webhook_events WHERE status = 'FAILED' ORDER BY received_at DESC LIMIT 20;

-- Duplicados: devem existir no máximo 1 linha por provider_event_id (índice único)
SELECT provider_event_id, count(*) FROM webhook_events GROUP BY 1 HAVING count(*) > 1;
```
Painel do gateway: entregas de webhook com falha, status do serviço do Pagar.me, configuração de URL/segredo.

**Mitigação**
1. **HMAC inválido em massa:** segredo rotacionado de um lado só → alinhar `PAGARME_WEBHOOK_SECRET` com o painel. Se a origem não for o gateway (IPs desconhecidos, padrões de ataque), tratar como segurança (AL-16 → RB-10) e bloquear na borda.
2. **Erro no nosso processamento (5xx):** o gateway retenta; corrigir/rollback (RB-09) e reprocessar: `npm run ops -- webhooks:replay --status=FAILED --since=<ts>` (idempotente por `provider_event_id`).
3. **Silêncio (gateway não entrega):** rodar o **pull de status** para pagamentos pendentes: `npm run ops -- payments:sync --since=<ts>` (consulta a API do gateway e aplica as mesmas transições idempotentes). Se o gateway está fora, ligar `pix_enabled`/`card_enabled` = off conforme o meio afetado ou `payments_enabled` = off.
4. **Duplicados:** comportamento esperado (Spec §6: processado uma vez). Se algum efeito foi aplicado duas vezes (ex.: dois estornos), é S1: congelar com `captures_paused`, levantar o impacto com RB-06.

**Verificação:** `FAILED` = 0 após o replay; pagamentos pendentes antigos zerados; D7 normal; conciliação do dia sem divergência.
**Escalonamento:** > 30 min sem webhooks com pagamentos reais → S2 + responsável por pagamentos + suporte do gateway; efeito financeiro duplicado → S1.

---

## RB-06 — Divergência de conciliação financeira

**Sintomas:** relatório diário aponta diferença entre `payments`/`refunds`/`payouts` e o extrato do gateway.
**Alertas:** AL-17.

**Diagnóstico**
```sql
-- Totais do dia por tipo (lado da plataforma), em centavos
SELECT 'capturado' AS tipo, sum(captured_amount_cents) FROM payments
 WHERE captured_at >= :dia AND captured_at < :dia + interval '1 day'
UNION ALL
SELECT 'estornado', sum(amount_cents) FROM refunds
 WHERE confirmed_at >= :dia AND confirmed_at < :dia + interval '1 day'
UNION ALL
SELECT 'repassado', sum(amount_cents) FROM payouts
 WHERE released_at >= :dia AND released_at < :dia + interval '1 day';
```
```bash
npm run ops -- reconciliation:diff --date=YYYY-MM-DD   # lista por provider_id: só no gateway, só na plataforma, valor diferente
```
Classificar cada diferença: (a) timing (evento após o corte do dia), (b) webhook perdido (RB-05), (c) estorno travado (RB-07), (d) captura duplicada ou valor errado (bug), (e) taxa/split calculado diferente.

**Mitigação**
1. (a) Registrar como diferença de timing; deve zerar na conciliação do dia seguinte.
2. (b)/(c) Aplicar RB-05 (`payments:sync`) ou RB-07 e reconciliar de novo.
3. (d) Valor cobrado a mais de usuário = **S1**: ligar `captures_paused`; levantar todos os afetados; estorno da diferença com aprovação do PO; comunicação aos usuários (resposta-incidentes §6).
4. (e) Abrir bug; ajuste no repasse antes de liberar o próximo lote de `payouts`.
5. Ajustes manuais só via comando auditado (`npm run ops -- payments:adjust` grava em `audit_log`), nunca `UPDATE` direto.

**Verificação:** `reconciliation:diff` sem itens não explicados; relatório do dia seguinte com divergência 0.
**Escalonamento:** qualquer cobrança indevida → S1 (Tech Lead + PO + Jurídico); divergência sem explicação em 24 h → S2.

---

## RB-07 — Estorno travado

**Sintomas:** usuário reclama que não recebeu o estorno; `refunds` em `PENDING` há muito tempo; bolha `EXPIRED_FAILED` que não chega a `CANCELLED`.
**Alertas:** AL-18 (`PENDING` > 24 h).

**Diagnóstico**
```sql
SELECT r.id, r.payment_id, r.reason, r.amount_cents, r.status, r.requested_at, r.attempts, left(r.last_error, 200)
FROM refunds r WHERE r.status IN ('PENDING', 'FAILED') AND r.requested_at < now() - interval '1 hour'
ORDER BY r.requested_at LIMIT 50;

-- Bolhas falhas presas antes do CANCELLED
SELECT id, exploded_at FROM bubbles
WHERE status = 'EXPIRED_FAILED' AND exploded_at < now() - interval '30 minutes';
```
```bash
npm run ops -- payments:inspect --payment=<payment_id>   # estado no gateway vs local (sem dados de cartão)
```
Causas comuns: pré-autorização já expirada (cancelamento vira no-op no gateway, mas não foi marcado localmente); Pix com estorno recusado (conta destino encerrada); erro de idempotência; job de estorno falhando (RB-01).

**Mitigação**
1. Estado divergente (gateway já estornou/cancelou) → `npm run ops -- payments:sync --payment=<id>` aplica a confirmação.
2. Falha transitória → `npm run ops -- refunds:retry --id=<id>` (mesma `idempotency_key`, nunca uma nova).
3. Pix sem destino válido → fluxo manual com o suporte do gateway; avisar o usuário com prazo (template de comunicação).
4. Bolha presa em `EXPIRED_FAILED` → após todos os estornos confirmados, `npm run ops -- bubble:finalize --id=<id>` (transição idempotente para `CANCELLED`).

**Verificação:** `refunds` sem `PENDING` > 24 h; SLO-07 de volta à meta; usuário notificado (`PaymentRefunded` → notificação).
**Escalonamento:** > 72 h ou > 10 estornos travados simultâneos → S2 (Pagamentos + PO); risco de descumprir o estorno integral da Spec F7 / CDC → Jurídico.

---

## RB-08 — Pico de conexões WebSocket

**Sintomas:** latência de tempo real alta, reconexões em massa, CPU/memória da API alta, sonda sintética falhando.
**Alertas:** AL-12, AL-13, AL-25.

**Diagnóstico**
- D5: conexões por instância, connects/s, disconnects por `reason`, commit → renderização p99, RTT p99, mensagens/s por room.
- Distinguir: **tráfego legítimo** (lançamento, bolha viral — muitos clientes na room `bubble:{id}`) × **tempestade de reconexão** (deploy, Redis instável; disconnect `transport close` em massa) × **abuso** (muitas conexões por IP/conta).
```bash
npm run ops -- ws:top-rooms --limit=20        # rooms com mais membros
npm run ops -- ws:connections-by-ip --limit=20   # IPs truncados (/24)
redis-cli -u $REDIS PUBSUB NUMSUB socket.io#/#   # canal do redis-adapter
```

**Mitigação**
1. **Escalar horizontalmente** a API (aumentar instâncias mínimas/máximas); o `@socket.io/redis-adapter` distribui o broadcast (ADR-0010).
2. Ligar `realtime_degraded_mode` (agregação de 1 s por bolha, menos rooms de tile por cliente). O cliente continua correto: eventos carregam `version` e snapshots são recarregados na reconexão (Spec §6).
3. Tempestade de reconexão: confirmar que o cliente usa backoff exponencial com jitter; se um deploy causou, pausar a progressão (RB-09).
4. Abuso: limitar conexões por IP/conta na borda; bloquear origem; se houver padrão de bot nas cotas, reforçar CAPTCHA adaptativo (R8).
5. Cadastro explodindo além da capacidade: religar `beta_allowlist` ou desligar `public_signup_enabled` temporariamente.

**Verificação:** commit → renderização p99 < 200 ms por 15 min; reconexões normalizadas; sonda verde. Depois desligar `realtime_degraded_mode`.
**Escalonamento:** SLO-01b violado (WS indisponível) → S2; com impacto em explosões ou cotas → S1.

---

## RB-09 — Deploy com falha / rollback

**Sintomas:** smoke falhou; 5xx/latência sobem logo após um deploy; job de migration falhou; erro JS em massa após deploy do web.
**Alertas:** AL-01/AL-04 logo após deploy; critérios do [plano de release §6](plano-release.md#6-critérios-de-rollback).

**Diagnóstico**
- D10: anotação do deploy, comparação antes/depois por `service.version`.
- Logs do workflow `deploy-production` e do job de migration.
- Sentry: erros novos da versão.

**Mitigação (sem debate quando um critério de rollback é atingido)**
```bash
# API / worker — Cloud Run: voltar 100% para a revisão anterior
gcloud run revisions list --service=bolha-api --region=$REGION --limit=5
gcloud run services update-traffic bolha-api --region=$REGION --to-revisions=<REVISAO_ANTERIOR>=100
gcloud run services update-traffic bolha-worker --region=$REGION --to-revisions=<REVISAO_ANTERIOR>=100
# Railway: Deployments → deploy anterior → "Rollback"

# Web — Vercel
vercel rollback <url-do-deploy-anterior> --scope <time>
```
1. Migration falhou: o deploy já parou antes da troca de tráfego (nada a reverter na aplicação). Verificar se a migration ficou parcialmente aplicada (`SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;`); corrigir com nova migration (*roll-forward*) — `prisma migrate resolve` só com Tech Lead.
2. Migration aplicada e código novo com bug: rollback só do código (o schema é *expand*, compatível com N−1).
3. Dano a dados (escrita incorreta): S1; desligar a funcionalidade via flag, levantar escopo com queries, corrigir com script auditado; **PITR** só em último caso, por decisão do IC + Tech Lead (RTO ≤ 4 h, RPO ≤ 15 min — RNF04), ciente de que restaura também dados legítimos.
4. Bloquear novos deploys até o postmortem (`deploy-freeze` no environment `production`).

**Verificação:** smoke verde na revisão restaurada; 5xx e p99 na linha de base; error budget recalculado.
**Escalonamento:** rollback não resolve em 15 min → S1/S2 com Tech Lead; dano a dados → S1.

---

## RB-10 — Vazamento suspeito de dados

**Sintomas:** PII em logs; acesso anômalo a dados pessoais; credencial exposta (repositório, log, chat); relato externo; tentativa de webhook forjado bem-sucedida; dump ou exportação inesperada.
**Alertas:** AL-21 (PII em logs), AL-22 (acesso anômalo), AL-16 (HMAC inválido em massa); gitleaks no CI.

> Este runbook **aciona o plano de resposta a incidentes de segurança/LGPD** (`08-seguranca-compliance/`) e é sempre **S1** até prova em contrário. Ver [resposta-incidentes.md §7](resposta-incidentes.md#7-interface-com-o-plano-lgpd).

**Primeiros 30 minutos**
1. Declarar S1, IC nomeado; acionar Tech Lead e **Encarregado (DPO)** / Jurídico. Abrir registro de incidente de segurança com hora de **ciência** (marco do prazo legal).
2. **Preservar evidências antes de corrigir**: exportar logs relevantes para armazenamento restrito (sem replicar PII em chat/ticket), snapshot do banco se necessário, listar sessões/tokens ativos.
3. **Conter**:
   - Credencial exposta → revogar/rotacionar imediatamente (banco, gateway, KMS, OAuth, GitHub), invalidar sessões (`npm run ops -- sessions:revoke-all --scope=<escopo>`).
   - PII em logs → corrigir o `redact`, **expurgar** os logs afetados no backend de logs e restringir acesso até expurgo.
   - Acesso anômalo → bloquear conta/IP/token; ligar `maintenance_mode` se a origem for desconhecida e ativa.
   - Chave de dados (ADR-0012) suspeita → rotação da chave e recriptografia planejada.

**Diagnóstico**
```sql
-- Ações administrativas e exportações recentes (audit_log)
SELECT occurred_at, actor_id, action, target_type, count(*)
FROM audit_log
WHERE occurred_at > now() - interval '72 hours'
  AND action IN ('ACCOUNT_EXPORT', 'ADMIN_VIEW_PII', 'ROLE_CHANGED', 'KEY_ACCESS')
GROUP BY 1, 2, 3, 4 ORDER BY 1 DESC;
```
- Escopo: quais dados (CPF/CNPJ/e-mail/endereço/pagamento), de quantos titulares, cifrados ou em claro, por quanto tempo expostos, quem acessou.
- Pseudônimos e dados cifrados sem a chave reduzem risco, mas pseudonimização **continua sendo dado pessoal** (LGPD).

**Mitigação e notificação**
- O DPO/Jurídico avalia **risco ou dano relevante** e decide a comunicação à **ANPD e aos titulares** dentro do prazo regulamentar (ver resposta-incidentes §7).
- Comunicação externa só com texto aprovado pelo Jurídico.

**Verificação:** vetor fechado; credenciais rotacionadas; detector AL-21 sem novos achados por 72 h; registro do incidente completo (mesmo quando não houver notificação, o registro é mantido).
**Escalonamento:** imediato a Tech Lead + PO + DPO/Jurídico; fornecedores (gateway, provedor de nuvem) se o vetor passar por eles.

---

## RB-11 — Reserva Pix não liberada após 15 min

**Contexto:** no Pix, a cota fica **reservada por 15 min** aguardando pagamento e deve voltar à capacidade se não for paga (Spec F5, §5, §6). Reserva presa tira vagas reais de uma bolha ativa e pode impedir a explosão por lotação.
**Sintomas:** bolha mostra cotas ocupadas que não viram pagamento; usuários veem "esgotado" com pouca gente confirmada; `bolha_pix_reservations_overdue > 0`.
**Alertas:** AL-18b.

**Diagnóstico**
```sql
-- Reservas Pix vencidas ainda ocupando capacidade (estado e colunas a confirmar na ERS/ADR-0003)
SELECT q.id, q.bubble_id, q.quantity, q.created_at, now() - q.created_at AS idade, p.status AS pagamento, b.status AS bolha
FROM quotas q
JOIN payments p ON p.id = q.payment_id
JOIN bubbles b ON b.id = q.bubble_id
WHERE p.method = 'PIX' AND q.status = 'RESERVED' AND q.created_at < now() - interval '16 minutes'
ORDER BY q.created_at LIMIT 100;
```
Causas: job de expiração da reserva não rodou (RB-01) ou foi perdido (RB-03); webhook de pagamento chegou e falhou no processamento (RB-05), deixando a reserva num estado intermediário; corrida entre pagamento tardio e expiração.

**Mitigação**
1. Consultar o gateway para cada reserva antes de liberar (o usuário pode ter pago e o webhook falhado): `npm run ops -- payments:sync --method=PIX --since=<ts>`.
   - Pago → confirmar a cota (a reserva vira cota ativa).
   - Não pago → **liberar**: `npm run ops -- pix:release-overdue` (cancela a cobrança no gateway, devolve a capacidade com `UPDATE bubbles SET filled_quotas = filled_quotas - :n WHERE id = :id AND status = 'ACTIVE'`, grava `QuotaReleased` no outbox; idempotente).
2. Pagamento que chegar **depois** da liberação → estorno integral automático (`LATE_PAYMENT_REFUNDED`), sem penalidade de score (Spec §6).
3. Se a bolha já explodiu com reservas pendentes: as reservas **não contam** como cota; verificar se o resultado (SUCCESS/FAILED) considerou só cotas pagas e se o estorno das reservas foi disparado (Spec §6).
4. Recorrência: ligar `pix_enabled` = off temporariamente até a causa ser corrigida.

**Verificação:** `bolha_pix_reservations_overdue = 0`; capacidades corretas (`filled_quotas` = soma das cotas ativas + reservas válidas); D7 sem pagamentos tardios sem estorno.
**Escalonamento:** reserva presa > 30 min em bolha `ACTIVE` → S2; resultado de explosão calculado com reserva não paga → S1 (Tech Lead + PO).

---

## RB-12 — Capturas falhando por pré-autorização expirada

**Contexto:** na explosão com sucesso, captura-se o preço final de cada participante; se a pré-autorização expirou, o item daquele comprador é cancelado sem afetar o score dele nem os demais (Spec F7, §6). Falhas em série indicam que a duração da bolha excede a validade real da pré-autorização (R5, Spec Q1) ou que a captura está atrasada.
**Sintomas:** itens de triagem cancelados com `cancel_reason = CAPTURE_FAILED`; vendedores recebendo menos pedidos que o esperado; `bolha.payments.capture{result="AUTH_EXPIRED"}` > 0.
**Alertas:** AL-18c.

**Diagnóstico**
```sql
SELECT b.id AS bolha, b.type, b.starts_at, b.exploded_at, b.exploded_at - p.authorized_at AS idade_autorizacao,
       count(*) FILTER (WHERE p.capture_status = 'AUTH_EXPIRED') AS expiradas, count(*) AS total
FROM payments p JOIN quotas q ON q.payment_id = p.id JOIN bubbles b ON b.id = q.bubble_id
WHERE p.method = 'CARD' AND b.exploded_at > now() - interval '24 hours'
GROUP BY 1, 2, 3, 4, 5 HAVING count(*) FILTER (WHERE p.capture_status = 'AUTH_EXPIRED') > 0
ORDER BY expiradas DESC;
```
Perguntas: as expiradas são de bolhas longas (perto de 5 dias)? De uma bandeira/emissor específico? A captura rodou com atraso após a explosão (fila `payment`/RB-01)? Bolha de compra: a captura só ocorre após a seleção do lance (até 24 h depois — ADR-0005), o que soma tempo à pré-autorização.

**Mitigação**
1. Captura atrasada por fila → RB-01; reprocessar capturas pendentes ainda válidas **imediatamente** (`npm run ops -- captures:retry --bubble=<id>`).
2. Expiração por duração: reduzir `BUBBLE_MAX_DURATION_HOURS` (efeito em bolhas novas) e, para bolhas de compra, considerar a janela de seleção de 24 h no limite; registrar decisão no ADR-0003 (Q1 da Spec).
3. Bolhas ativas em risco (autorização vai expirar antes de `expires_at` + janela): listar e avisar criador/participantes; o PO decide entre manter (cancelando itens expirados) ou orientar reautorização, se o gateway suportar.
4. Itens cancelados: garantir que o usuário **não foi cobrado** e foi notificado; nenhum evento de score negativo para o comprador (Spec §6).
5. Falha generalizada de captura (não só expiração) → `card_enabled` = off e acionar o gateway.

**Verificação:** `AUTH_EXPIRED` = 0 nas novas explosões; SLO-07c na meta; guardrail "estorno por cancelamento na triagem" < 5% (PRD §10).
**Escalonamento:** > 10% de capturas falhando em uma bolha ou > 2% no dia → S2 (Pagamentos + PO); usuário cobrado em item cancelado → S1.

---

## Manutenção dos runbooks

- Dono: DevOps/SRE com o Tech Lead; revisão a cada postmortem que tocar no tema e trimestralmente.
- Todo alerta novo exige runbook novo ou atualizado no mesmo PR.
- Game day mensal durante o primeiro trimestre: sortear um RB e executá-lo em staging.

---

## Fontes consultadas (AlterEgo)

- **asias-observabilidade** (trecho do *Google SRE Book*, cap. 6 "Monitoring Distributed Systems"): sintoma × causa e alertas acionáveis — cada runbook parte do sintoma do usuário e do alerta que dispara.
- **sre** — Google, *Site Reliability Engineering*, cap. "Managing Incidents": só o time de Ops altera o sistema durante o incidente; documento vivo com ações anotadas (seção 0).
- **migration-specialist** — *Flyway Docs*, FAQ: reparo após migration falha (corrigir e reaplicar, sem alterações manuais) e Pramod Sadalage & Martin Fowler, *Evolutionary Database Design* (RB-09).
- **release-manager** — *Manual de Processo de Desenvolvimento de Software*, §13.3: rollback com critérios objetivos (RB-09).
