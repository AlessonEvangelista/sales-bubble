# ADR-0010 — Tempo real com Socket.io + Redis adapter, rooms por tile e por bolha, publicado a partir do outbox transacional

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RNF01 e §5.2](../../../PRD.MD) · [Spec v1.1 F2](../../../SPEC.md) · Detalhe: [eventos-dominio.md](../eventos-dominio.md) · ADRs relacionados: ADR-0001, ADR-0011
**Decisores:** Tech Lead · **Revisar em:** teste de carga da S7 (5 mil sockets, p99 < 200 ms)

## Contexto

- **RNF01:** atualização de cota com p99 < 200 ms do commit no servidor até a renderização no cliente; 500 bolhas no viewport.
- O `api` roda com N réplicas: um evento gerado numa réplica precisa chegar aos sockets de todas.
- O cliente só deve receber eventos da área visível (tiles do viewport, Spec F2) e das bolhas em que está.
- Publicar um evento "depois do commit" direto do request perde eventos em crash; publicar antes do commit gera eventos fantasmas em rollback (R7).

## Decisão

1. **Socket.io** no `api` com **`@socket.io/redis-adapter`** (pub/sub no Redis) e cliente com `transports: ['websocket']` (dispensa afinidade de sessão).
2. **Rooms:**
   - `tile:{z}:{x}:{y}`: grade fixa por nível de zoom; o cliente faz `join`/`leave` ao mover a câmera (limite de 64 tiles por socket);
   - `bubble:{id}`: detalhe aberto ou participação;
   - `account:{id}`: privada, para `notification.created`, entrada só com handshake autenticado.
   Visitantes anônimos podem entrar em rooms de tile (somente leitura).
3. **Publicação só a partir do outbox:** o caso de uso grava o evento em `outbox_events` na mesma transação; um trigger dispara `pg_notify('outbox_new')` (entregue só no commit); o **relay** no `worker` (líder único via `pg_try_advisory_lock`) lê em ordem de `id`, emite pelo `@socket.io/redis-emitter` às rooms derivadas e enfileira os consumidores (BullMQ, `jobId` determinístico). Poll de segurança a cada 500 ms.
4. **Payload delta** (≤ 300 bytes) com `version` monotônica; o cliente descarta `version` menor que a atual, aplica no próximo `requestAnimationFrame` (no máximo 1 atualização visual por bolha a cada 100 ms, Spec F2) e, na reconexão, recarrega o snapshot via `GET /bubbles?bbox`.
5. **Medição:** cada mensagem carrega `committed_at`; o cliente amostra o ack (1%) e o OTel registra `ws_e2e_latency_ms` (histograma) com *threshold* k6 `p(99)<200`.

## Alternativas consideradas

| Critério | **A. Socket.io + Redis adapter + outbox (escolhida)** | B. SSE + Redis pub/sub | C. Serviço gerenciado (Pusher/Ably) | D. Publicar direto após o commit (sem outbox) |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●●● | ●●● | ● custo por conexão/mensagem; dados fora do país | ●●● |
| Reversibilidade | ●●● (`RealtimeEmitter` é porta) | ●●● | ●● | ●●● |
| Complexidade | ●● relay + rooms | ●● reconexão e rooms manuais | ●●● | ●●● |
| Risco | ●●● sem evento perdido nem fantasma; latência medida | ●● só servidor → cliente (OK), menos tooling de rooms | ●● dependência externa no caminho crítico | ● perde eventos em crash; ordem não garantida |

## Consequências

**Positivas (+)** Um único caminho de publicação (DB → relay) para WS e consumidores; o trace liga clique → commit → socket; escala horizontal do `api`.
**Negativas (−)** Relay único é gargalo e ponto de falha → standby com eleição por *advisory lock*; alerta se o evento mais velho pendente passar de 30 s; particionar por `aggregate_id` se necessário. Redis vira dependência do tempo real → sem Redis, o REST continua e o cliente faz *refetch* periódico.

## Verificação

k6 + script de WS: 5 mil sockets, 50 cotas/s, p99 < 200 ms; caos: matar o relay líder → o standby assume em ≤ 5 s sem perda (comparar `outbox_events` × mensagens recebidas).

## Fontes

- Projeto: PRD v2.1 RNF01; Spec v1.1 F2; plano v2 §7 (R7), E5.
- **arquitetura-ddd** — microservices.io (Chris Richardson): o comando precisa atualizar o banco e publicar a mensagem atomicamente; 2PC não é opção; publicar dentro ou depois da transação não é confiável; preservar a ordem por agregado → *Transactional Outbox*.
- **senior-backend-nodejs** — *Architecture Flashcards*: *Polling publisher* lê a tabela de outbox.
- **performance-engineer** — *k6 Docs*, "Thresholds": SLO de latência codificado como critério de aprovação.
