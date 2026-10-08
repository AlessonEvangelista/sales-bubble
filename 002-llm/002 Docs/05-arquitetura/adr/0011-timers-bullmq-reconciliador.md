# ADR-0011 — Timers com BullMQ (delayed jobs idempotentes) + reconciliador de 1 min com o Postgres como fonte da verdade

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RNF02 e §5.2](../../../PRD.MD) · [Spec v1.1 F5, F7, F9, §6](../../../SPEC.md) · Detalhe: [eventos-dominio.md §4–§5](../eventos-dominio.md#4-filas-bullmq) · ADRs relacionados: ADR-0002, ADR-0009
**Decisores:** Tech Lead · **Revisar em:** teste de caos da S4/S7

## Contexto

- **RNF02 / Spec F7:** a explosão por tempo ocorre em ≤ 2 s após `expires_at`, **mesmo com queda de uma réplica do worker**. Se o Redis perder os jobs, o reconciliador explode em ≤ 1 min, com alerta (Spec §6).
- Há vários prazos: expiração, aviso de 1 h, janela de lance (24 h), reserva Pix (`min(15 min, restante)`), envio (`shipping_days`), tolerância de +3 dias, auto-confirmação (7 dias), arrependimento (7 dias), devolução (10 dias).
- R3: o timer pode atrasar ou se perder (Redis reinicia, worker cai).

## Decisão

1. **BullMQ delayed jobs**, um por prazo, com `jobId` determinístico (`expire__{bubbleId}` etc.). Filas canônicas: `bubble-expire`, `bubble-expiring`, `bid-selection-timeout`, `triage-deadline`; propostas: `quota-reservation-expire`, `triage-shipping-grace`, `cnpj-verification-retry`, `domain-events`, `email`, `maintenance`.
2. **Jobs só carregam ids**; o processador chama um caso de uso **idempotente** com guarda de estado e de tempo no SQL (`WHERE status = 'ACTIVE' AND expires_at <= now()`). Job adiantado (relógio do Redis × Postgres) → reagenda. Job repetido → 0 linhas → no-op.
3. **Agendamento a partir de eventos** (`BubblePublished` → agenda), não dentro do request: se o Redis estiver fora no momento da publicação, a bolha é publicada e o reconciliador cria o job depois.
4. **Pontualidade com queda de réplica:** mínimo de **2 réplicas** de worker. A fila `bubble-expire` tem processador dedicado com `lockDuration` = 1.000 ms e `stalledInterval` = 500 ms: se a réplica morrer com o job em mãos, ele volta para a fila em ~1–1,5 s e a outra réplica conclui dentro dos 2 s. As demais filas usam `lockDuration` 10 s / `stalledInterval` 5 s.
5. **Corretude independente do timer:** o `UPDATE` de aquisição de cota exige `expires_at > now()` (ADR-0002) e a saída de cota exige `expires_at − now() ≥ 60 min`. Nenhuma ação de usuário acontece "depois do fim", mesmo que a explosão atrase.
6. **Reconciliador** a cada 1 min no `worker`, como `setInterval` sob `pg_try_advisory_lock` (não depende do Redis): explode ativas vencidas há > 2 s, expira reservas Pix vencidas, executa seleção de lance e prazos de triagem vencidos, recria jobs ausentes, alerta sobre outbox parado e pagamentos divergentes ([eventos-dominio.md §5](../eventos-dominio.md#5-reconciliador)). Cada ação do reconciliador incrementa uma métrica e dispara alerta (o timer falhou).
7. **Redis** gerenciado com AOF `everysec` e `maxmemory-policy noeviction`.

## Alternativas consideradas

| Critério | **A. BullMQ + reconciliador (escolhida)** | B. Só polling do Postgres (cron a cada 1 s) | C. `pg_cron` / agendamento no banco | D. Só BullMQ, sem reconciliador |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●● Redis já existe (adapter WS) | ●●● | ●● extensão nem sempre disponível no gerenciado | ●●● |
| Reversibilidade | ●●● (`SchedulerPort`) | ●●● | ●● | ●●● |
| Complexidade | ●● dois mecanismos | ●●● | ●● lógica de negócio no banco | ●●● |
| Risco | ●●● ≤ 2 s com queda de réplica; nenhuma perda | ●● consulta por segundo sobre todas as ativas; precisão limitada pelo intervalo | ●● acoplamento e observabilidade ruins | ● perda do Redis = bolhas que nunca explodem (R3) |

## Consequências

**Positivas (+)** Precisão de segundos no caminho normal; nenhuma bolha "esquecida"; tudo idempotente.
**Negativas (−)** `lockDuration` de 1 s aumenta o tráfego de renovação de locks no Redis e pode gerar falso *stalled* se o *event loop* travar > 1 s; como o job é idempotente, o efeito é só reprocessamento → manter o processador de `bubble-expire` leve e isolado. Dois mecanismos para manter e testar → testes de caos na CI (matar réplica, `FLUSHALL` no Redis de teste).

## Verificação

Caos (S4/S7): 1.000 bolhas expirando no mesmo minuto, matar uma réplica no meio → p99 de `exploded_at − expires_at` ≤ 2 s; `FLUSHALL` no Redis → todas explodem em ≤ 60 s, com alerta; nenhuma cota aceita após `expires_at`.

## Fontes

- Projeto: PRD v2.1 RNF02; Spec v1.1 F5, F7, F9, §6; plano v2 §7 (R3), §9.
- **asias-postgresql** — *PostgreSQL 17 Docs* §13.3, *Advisory Locks* (liderança do reconciliador); §13.2 (guardas no `UPDATE`).
- **asias-dist-data-systems** — *System Design Primer* (Donne Martin), "Asynchronism / task queues": trabalho agendado e lento em filas fora do request. *Apache Kafka Docs*, "Message Delivery Semantics": *at-least-once* exige processamento idempotente.
- Parâmetros do BullMQ (`lockDuration`, `stalledInterval`, `jobId`): documentação oficial da biblioteca (conhecimento do autor; o AlterEgo não retornou trecho específico, validar na S1).
