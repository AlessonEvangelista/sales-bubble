# Plano de Teste de Carga — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · [Plano de Projeto v2](../planing-project.md) · [API WebSocket](../05-arquitetura/api-websocket.md) · [Estratégia de testes](estrategia-testes.md)

> Objetivo: comprovar as metas técnicas do PRD §10 e dos RNF01, RNF02 e RNF04 exigidas pelo **Gate E** (plano §3) e pela **Spec §8, item 3**: "canvas a 60 FPS com 500 bolhas, tempo real com p99 < 200 ms e explosão com p99 ≤ 2 s". A execução principal acontece em **S7** (E9) e o reteste em **S8**, após o hardening.

---

## 1. Metas de aceite (de onde vêm)

| # | Meta | Origem | SLI medido |
| :--- | :--- | :--- | :--- |
| M1 | Atualização de cota em tempo real **< 200 ms em p99**, do commit à renderização | PRD §10 (latência de tempo real) e RNF01 | `ws_fanout_latency`: `ts` do envelope (commit) → recepção no cliente k6. A parcela de renderização é medida no benchmark (M2) |
| M2 | **500 bolhas com frame time p95 ≤ 16,7 ms** (≥ 60 FPS) durante pan e zoom, em 2 dispositivos de referência | RNF01 | Frame time p95 no benchmark Playwright (CT-059) sob carga WS |
| M3 | **Explosão por tempo com p99 ≤ 2 s** após `expires_at` | PRD §10 (pontualidade da explosão), RNF02 e Spec F7 | `explosion_delay = exploded_at − expires_at` (p99 e máximo) |
| M3' | **Perda de jobs no Redis**: explosão pelo reconciliador em **≤ 1 min**, com alerta de SLO. A queda de uma réplica de worker continua sob M3 (≤ 2 s), porque há ≥ 2 réplicas | Spec v1.1 §6 (B8) e F7 | `explosion_delay` das bolhas explodidas pelo reconciliador |
| M4 | **Última cota estritamente atômica**: 100 requisições por 1 cota dão exatamente 1 sucesso e 99 `QUOTA_SOLD_OUT` sem cobrança | RNF02, RF03.5 e Spec §6 (B1) | Invariante `filled_quotas ≤ max_quotas`; sucessos = cotas restantes; zero autorizações órfãs |
| M5 | Webhooks processados de forma idempotente sob rajada | Spec §6 (B9) e ADR-0003 (proposto) | Duplicidades efetivadas = 0; atraso da fila de webhooks |
| M6 | Disponibilidade de 99,5% (API e WS) sob carga, sem degradação no soak | RNF04 | Taxa de sucesso no soak de 8 h; RPO/RTO validados no teste de restore ([estratégia §3.8](estrategia-testes.md)) |

Metas complementares, a ratificar na ERS (são **hipóteses deste plano**, não do PRD):

| SLI | Meta proposta |
| :--- | :--- |
| `POST /bubbles/{id}/quotas` latência | p95 < 300 ms, p99 < 800 ms (inclui pré-autorização no **stub** do gateway com 150 ms) |
| `GET /bubbles?bbox` latência | p95 < 150 ms |
| Taxa de erro 5xx | < 0,1% em todos os cenários. **0** no cenário de corrida (C2) |
| Atraso do outbox (commit → publicação) | p99 < 100 ms |
| Lag da fila de webhooks | < 30 s no pico; volta a 0 em < 2 min |

---

## 2. Perfil de carga (hipóteses)

Não há histórico de produção. O dimensionamento parte do beta (≈ 50 usuários e 5 PJs, plano S8) e projeta o beta público com margem de **10×** sobre a expectativa inicial. A coluna de estresse coincide com a capacidade-alvo do contrato WS (§9): 10 mil conexões simultâneas, 500 bolhas ativas e rajada de 100 cotas/s numa bolha. Os números serão recalibrados com a telemetria do beta fechado.

| Parâmetro | Média (beta público) | Pico | Estresse (2× pico) |
| :--- | :--- | :--- | :--- |
| Clientes WS simultâneos | 1.000 | 5.000 | 10.000 |
| Bolhas `ACTIVE` | 2.000 | 5.000 | 10.000 |
| Bolhas por viewport (canvas) | até 500 | 500 | 500 |
| Aquisições de cota / s (global) | 5 | 50 | 100 |
| Mensagens WS emitidas / s (por cliente, após culling por tile) | ≤ 2 | ≤ 10 | ≤ 20 |
| Webhooks / min | 60 | 2.000 | 10.000 |

Seguindo a orientação do k6 (Grafana, *k6 Docs — Stress/Soak testing*), a ordem é: smoke → carga média → estresse → soak. O teste de estresse só roda depois que a carga média passa, reaproveitando o mesmo script com parâmetros maiores.

---

## 3. Cenários

### C1 — Canvas com 500 bolhas e N clientes WS (M1, M2)

- **Preparação:** 5.000 bolhas `ACTIVE` distribuídas no espaço virtual. Uma região "quente" concentra 500 bolhas num único conjunto de tiles `tile:{z}:{x}:{y}`.
- **Clientes:** N VUs (1k → 5k → 10k em rampa de 10 min, platô de 30 min) conectam ao namespace `/rt` e enviam `viewport.set` cobrindo a região quente (80% dos VUs) ou regiões aleatórias (20%). Cerca de 10% também enviam `bubble.subscribe` para uma bolha. Os limites do contrato (64 tiles e 20 rooms de bolha por conexão, 3 conexões por conta e 20 por IP anônimo) são respeitados. Por isso os VUs anônimos vêm de vários IPs de origem ou usam contas autenticadas.
- **Gerador de mutações:** um cenário paralelo (`constant-arrival-rate`) adquire e libera cotas nas bolhas da região quente a 50/s, o que gera `bubble.updated`. Uma bolha recebe a rajada de **100 cotas/s** (capacidade-alvo do contrato WS).
- **Medição de M1:** o envelope de todo evento traz `ts` (instante do commit no banco) e `id` do outbox. O VU registra `recv_at − ts` numa `Trend`. Os geradores k6 e a API ficam na **mesma região**, com NTP (*chrony*), e a deriva medida antes do teste precisa ficar abaixo de 5 ms. Para validar sem depender do relógio, um **VU observador** mede o ida-e-volta: ele próprio adquire a cota e cronometra até receber o próprio `bubble.updated`. A amostragem `latency.ack` do servidor (contrato WS §9) é a terceira verificação.
- **Coalescência e backpressure:** `bubble.updated` em tiles é coalescível e `volatile`. A latência é medida sobre o evento entregue. Também se contam os `resync.required` com `reason: BACKPRESSURE`, que devem ser zero na carga de pico.
- **Medição de M2:** durante o platô, o benchmark Playwright (`/bench`, CT-059) roda conectado ao mesmo ambiente e recebe o tráfego real da região quente, verificando também o *throttle* visual (1 atualização por bolha a cada 100 ms, CT-058).
- **Socket.io no k6:** o k6 fala WebSocket puro (`k6/ws` ou `k6/experimental/websockets`), então o script implementa o enquadramento Engine.IO v4 / Socket.io v5: `40/rt,{auth}` para conectar ao namespace, `2`/`3` para ping/pong e `42/rt,[...]` para eventos.

### C2 — Rajada na última cota (M4, M1)

- **Preparação:** bolha `ACTIVE` com `max_quotas = 50`, `filled_quotas = 49` e K contas PF distintas com tokens pré-emitidos.
- **Rajadas:** K = 100, 250, 500 e 1000 requisições disparadas **no mesmo instante** (barreira de horário, ver script em §6). Cada rajada se repete 10× em bolhas novas.
- **Variante PF duplicada:** 50 requisições paralelas da **mesma** conta numa bolha com folga. Esperado: 1 sucesso (índice único parcial, ADR-0002).
- **Variante PJ:** 20 PJs pedindo N cotas que, somadas, excedem o restante. Esperado: nunca `filled_quotas > max_quotas` e respeito a `max_pj_share`.
- **Variante explosão:** K clientes WS na room `bubble:{id}` medem a chegada de `bubble.exploded` (p99 < 200 ms).
- **Variante Pix (Spec v1.1 F5, B5–B7):** 30% das requisições com Pix. A reserva ocupa capacidade (`filled_quotas + reserved_quotas ≤ max_quotas`), então as últimas vagas podem ficar só reservadas. Nesse caso as novas entradas recebem `QUOTA_SOLD_OUT` e a explosão por lotação ocorre quando o último Pix é pago (CT-065). Um lote não é pago, para validar a reabertura das vagas sob carga (CT-066). Outro lote paga depois do fim, para validar o estorno automático (CT-067). Os limites anti-abuso (máx. 3 reservas abertas por conta) ficam ligados (CT-069).
- **Aprovação:** exatamente `max − filled` sucessos (= 1) e o resto `409 QUOTA_SOLD_OUT` (Spec F5). **0 respostas 5xx**, 0 deadlocks no log do Postgres, `filled_quotas = max_quotas` no `teardown` e nenhuma pré-autorização órfã no stub do gateway ("Nenhum valor foi cobrado").

### C3 — 10.000 bolhas expirando no mesmo minuto (M3)

- **Preparação:** 10.000 bolhas com `expires_at` distribuído uniformemente dentro de um mesmo minuto. 50% atingem `min_quotas` (vão para `EXPIRED_SUCCESS` e captura) e 50% não (`EXPIRED_FAILED` → `CANCELLED` e estorno). Média de 20 participantes por bolha, o que dá cerca de 200 mil operações no stub do gateway.
- **Variantes:**
  - **C3a:** workers estáveis (2 réplicas).
  - **C3b:** uma das 2 réplicas é morta no meio do minuto (CT-024a).
  - **C3c:** `FLUSHALL` no Redis 5 min antes, para medir o **reconciliador** (CT-024b). Aqui a meta é M3' (≤ 1 min, com alerta de SLO disparado), não 2 s.
- **SLIs:** `explosion_delay` p50/p99/máx (consulta SQL após o teste), profundidade e taxa da fila BullMQ, CPU e conexões do Postgres, lag do outbox e duração das capturas e estornos.
- **Aprovação:** C3a e C3b com **p99 ≤ 2 s** (PRD §10). C3c com máximo ≤ 1 min e alerta disparado. Nenhuma bolha com explosão duplicada (`BubbleExploded` por bolha = 1). Todas as falhas estornadas a 100% na conciliação. Pré-autorizações expiradas no stub viram itens cancelados sem afetar os demais (Spec §6, B10).

### C4 — Webhooks em rajada (M5)

- **Preparação:** o stub do gateway gera webhooks reais (corpo e assinatura) para os pagamentos criados em C3.
- **Carga:** 10.000 webhooks em 5 min (`ramping-arrival-rate` até 100/s), com **20% duplicados**, **5% fora de ordem** (ex.: `refunded` antes de `authorized` reconhecido) e **1% com assinatura inválida**.
- **Aprovação:** todos os válidos respondem 2xx em p99 < 500 ms (processamento assíncrono após persistir em `webhook_events`). Os inválidos recebem `401 WEBHOOK_SIGNATURE_INVALID`. Zero efeitos duplicados. Estado final de cada pagamento igual ao do gateway (conciliação). Lag da fila volta a 0 em < 2 min.

### C5 — Carga média, soak e estresse (regressão)

Mix realista (70% navegação no canvas, 20% detalhe da bolha, 8% aquisição ou saída de cota, 2% lances) em três execuções: **carga média** de 30 min, **soak** de 8 h (vazamento de memória no gateway WS, crescimento de `outbox_events` e `webhook_events`; taxa de sucesso ≥ 99,5%, coerente com o SLO do RNF04) e **estresse** a 2× o pico (degradação graciosa: 429 em vez de 5xx).

---

## 4. Ambiente

| Item | Configuração |
| :--- | :--- |
| Ambiente | `perf`, isolado e com o **mesmo tamanho de instância** previsto para produção (API, WS, workers, Postgres e Redis gerenciados com o mesmo plano) |
| Réplicas | API ≥ 2, WS ≥ 2 (com `@socket.io/redis-adapter`), worker **≥ 2** (mínimo de produção; ADR-0010/0011) |
| Gateway | **Stub** do `PaymentPort` com latência configurável (p50 de 150 ms, p99 de 600 ms) e taxa de falha de 0,5%. O sandbox real não suporta essa carga e não pode ser usado para isso |
| CNPJ / e-mail | Stubs (BrasilAPI e e-mail fora do caminho crítico) |
| Geradores k6 | Na mesma região da API; 1 gerador para cada ~2.000 conexões WS; NTP sincronizado |
| Observabilidade | OTel → Grafana/SigNoz com dashboards de API, WS, BullMQ, Postgres (`pg_stat_statements`, locks) e Redis; Sentry ligado |
| Dados | Seed sintético via factories ([estratégia §5](estrategia-testes.md)); **nenhum dado real** |
| Proteções | Rate limit e anti-bot **ligados**. As contas de teste ficam numa allowlist de *bypass* por cabeçalho assinado, só no ambiente `perf`. Também se executa uma rodada sem bypass para validar o 429 |

---

## 5. SLIs e coleta

| SLI | Fonte | Agregação |
| :--- | :--- | :--- |
| `http_req_duration` por rota (tag `name`) | k6 | p50/p95/p99 |
| `ws_fanout_latency` | k6 (`Trend` customizada) | p50/p95/p99/máx |
| `quota_success`, `quota_conflict`, `quota_other` | k6 (`Counter`) | total por rajada |
| `explosion_delay` | SQL pós-teste em `bubbles` | p50/p99/máx |
| Lag do outbox e da fila de webhooks | métricas OTel do worker | p99 / pico |
| FPS | benchmark Playwright | média e p5 |
| Saturação | CPU/mem por serviço, conexões e locks do Postgres, memória e ops do Redis, *event loop lag* do Node | pico |

---

## 6. Script k6 de exemplo — corrida pela última cota (C2)

```javascript
// tests/load/c2-last-quota.js
// Uso:
//   k6 run -e BASE_URL=https://api.perf.bolhavenda.internal \
//          -e BUBBLE_ID=<uuid> -e REMAINING=1 -e VUS=1000 \
//          -e START_AT=$(( $(date +%s%3N) + 15000 )) c2-last-quota.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL;
const BUBBLE_ID = __ENV.BUBBLE_ID;
const REMAINING = Number(__ENV.REMAINING || 1);
const VUS = Number(__ENV.VUS || 100);
const START_AT = Number(__ENV.START_AT); // epoch ms comum a todos os VUs (barreira)

// Um token de conta PF distinta por VU (gerados pelo seed; nunca contas reais)
const tokens = new SharedArray('pf-tokens', () => JSON.parse(open('./data/pf-tokens.json')));

const success = new Counter('quota_success');
const conflict = new Counter('quota_conflict');
const other = new Counter('quota_other');
const latency = new Trend('quota_latency', true);

export const options = {
  scenarios: {
    last_quota_race: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    quota_success: [`count==${REMAINING}`], // exatamente as cotas restantes
    quota_other: ['count==0'],              // nenhum 5xx/timeout/4xx inesperado
    quota_latency: ['p(99)<800'],
    checks: ['rate==1.0'],
  },
};

export function setup() {
  const res = http.get(`${BASE}/api/v1/bubbles/${BUBBLE_ID}`);
  const b = res.json();
  if (b.status !== 'ACTIVE' || b.max_quotas - b.filled_quotas !== REMAINING) {
    throw new Error(`Pré-condição inválida: ${b.status} ${b.filled_quotas}/${b.max_quotas}`);
  }
  return { max: b.max_quotas };
}

export default function () {
  // Barreira: todos os VUs disparam no mesmo instante
  const wait = (START_AT - Date.now()) / 1000;
  if (wait > 0) sleep(wait);

  const res = http.post(
    `${BASE}/api/v1/bubbles/${BUBBLE_ID}/quotas`,
    // card_token de teste aceito pelo STUB do PaymentPort (ambiente perf)
    JSON.stringify({ quantity: 1, payment: { method: 'CARD', card_token: __ENV.STUB_CARD_TOKEN, installments: 1 } }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens[(__VU - 1) % tokens.length]}`,
        'Idempotency-Key': uuidv4(),
      },
      tags: { name: 'POST /bubbles/{id}/quotas' },
      responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 409),
    },
  );
  latency.add(res.timings.duration);

  const code = res.status === 409 ? safeCode(res) : null;
  if (res.status === 201) success.add(1);
  else if (res.status === 409 && code === 'QUOTA_SOLD_OUT') conflict.add(1);
  else other.add(1);

  check(res, {
    '201 ou 409 QUOTA_SOLD_OUT': (r) => r.status === 201 || code === 'QUOTA_SOLD_OUT',
    '409 é problem+json': (r) =>
      r.status !== 409 || String(r.headers['Content-Type']).includes('application/problem+json'),
  });
}

function safeCode(r) {
  try { return r.json('code'); } catch (_) { return null; }
}

export function teardown(data) {
  sleep(2); // margem para o outbox
  const b = http.get(`${BASE}/api/v1/bubbles/${BUBBLE_ID}`).json();
  check(b, {
    'sem overbooking: filled_quotas == max_quotas': (x) => x.filled_quotas === data.max,
    'explodiu por lotação': (x) => x.status === 'EXPIRED_SUCCESS',
  });
}
```

Esboço do VU observador WS (C1/C2). Usa o enquadramento Engine.IO v4 / Socket.io v5 no namespace `/rt` e os eventos do [contrato WS](../05-arquitetura/api-websocket.md):

```javascript
import ws from 'k6/ws';
import { Trend, Counter } from 'k6/metrics';
const fanout = new Trend('ws_fanout_latency', true);
const resyncs = new Counter('ws_resync_required');
const NS = '/rt';

export function observer() {
  const url = `${__ENV.WS_URL}/socket.io/?EIO=4&transport=websocket`;
  const auth = __ENV.ACCESS_TOKEN ? JSON.stringify({ token: __ENV.ACCESS_TOKEN }) : '';
  ws.connect(url, {}, (socket) => {
    const emit = (event, data) => socket.send(`42${NS},${JSON.stringify([event, data])}`);
    socket.on('message', (m) => {
      if (m.startsWith('0')) socket.send(`40${NS},${auth}`);          // open Engine.IO → CONNECT no namespace
      else if (m === '2') socket.send('3');                            // ping → pong
      else if (m.startsWith(`40${NS}`)) {                              // CONNECT ok
        emit('bubble.subscribe', { bubble_id: __ENV.BUBBLE_ID });
      } else if (m.startsWith(`42${NS},`)) {
        const [event, envelope] = JSON.parse(m.slice(`42${NS},`.length));
        if (event === 'bubble.updated' || event === 'bubble.exploded') {
          fanout.add(Date.now() - Date.parse(envelope.ts));            // ts = instante do commit
        } else if (event === 'resync.required') {
          resyncs.add(1);
        }
      }
    });
    socket.setTimeout(() => socket.close(), Number(__ENV.HOLD_MS || 60000));
  });
}
```

---

## 7. Execução, análise e relatório

**Roteiro por rodada:**
1. Rodar um smoke (1–5 VUs) e validar o ambiente: seed, NTP, dashboards e stubs.
2. Coletar a linha de base com a carga média.
3. Executar os cenários na ordem C2 → C1 → C3 → C4 → C5, com intervalo para o sistema voltar ao repouso. Cada execução recebe um `testid` como tag no k6 e nos traces OTel.
4. Exportar os resultados: `k6 run --out json=…` ou Prometheus remote write para o Grafana, mais o `handleSummary` em JSON e HTML.
5. Rodar as consultas SQL de verificação (invariantes, `explosion_delay`, duplicidade de `BubbleExploded`, conciliação).

**Análise:**
- Comparar percentis (nunca médias) com as metas da §1. Correlacionar picos de p99 com saturação: conexões do Postgres, *event loop lag*, ops do Redis, lag do outbox.
- Para cada violação, abrir um trace exemplar (*exemplar* OTel) da cauda e identificar o segmento dominante: banco, gateway stub, publicação ou fan-out.
- **Um único 5xx ou um único overbooking em C2 reprova o cenário**, qualquer que seja o percentil.

**Relatório** (`07-qualidade/resultados/AAAA-MM-DD-carga.md`):

| Seção | Conteúdo |
| :--- | :--- |
| Resumo | Aprovado/reprovado por meta (M1–M5) e por cenário |
| Ambiente | Versões (SHA), tamanho das instâncias, réplicas, configuração dos stubs |
| Resultados | Tabela de SLIs (p50/p95/p99/máx), gráficos de latência × VUs e de saturação |
| Invariantes | Saída das consultas SQL (overbooking, duplicidade, conciliação) |
| Gargalos | Achados com evidência (trace, dashboard) e hipótese de causa |
| Ações | Ticket por achado, com dono e sprint; reteste exigido para o Gate E |

---

## 8. Riscos do próprio teste

- **Gerador saturado** (CPU acima de 80% no k6) distorce a latência medida. Monitore e escale os geradores.
- **Deriva de relógio** invalida o `ws_fanout_latency` entre hosts. Use o VU observador (ida e volta) como verificação cruzada.
- **O stub do gateway esconde a latência real.** Rode uma medição separada e de baixa taxa no sandbox para calibrar a latência do stub.
- **Rate limit mal configurado** pode "passar" no C2 por bloquear tudo. Por isso C2 roda com bypass e também sem ele.

---

## Fontes consultadas (AlterEgo)

- **performance-engineer** — Grafana, *k6 Docs*: "Stress testing" (carga acima da média, rodar após o teste de carga média, reaproveitar o script), "Soak testing" (duração estendida, monitorar recursos do backend), "Executors" (`shared-iterations`, `per-vu-iterations`, `constant-arrival-rate`, `ramping-arrival-rate`) e "WebSockets" (`k6/ws`, laço de eventos por VU, `k6/experimental/websockets`).
