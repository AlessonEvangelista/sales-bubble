# Guia de Desenvolvimento — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · [Plano de Projeto v2](../planing-project.md) · [Governança](../governance.md)

> Documento de onboarding para quem vai escrever código no monorepo `003-project/`. Tudo que aqui depende das decisões D1–D8 assume os ADRs correspondentes com status **Proposto** (aguardam o Gate A). Requisitos são referenciados pelos códigos do PRD v2.1 (RF01–RF09, RNF01–RNF06) e pelos ADRs; parâmetros e casos de borda seguem a [Spec](../../SPEC.md) §5–§6.

---

## 1. Pré-requisitos

| Ferramenta | Versão | Observação |
| :--- | :--- | :--- |
| Node.js | 24 LTS (fixada em `.nvmrc`) | O Node 20 saiu de suporte em 30/04/2026; o projeto adota o 24 LTS. |
| npm | 11+ (vem com o Node 24) | Monorepo com **npm workspaces** + Turborepo para orquestrar tarefas. |
| Docker + Docker Compose v2 | Docker 24+ | Comando `docker compose` (v2), não `docker-compose` (v1). |
| Git | 2.40+ | Hooks com Husky (lint-staged + commitlint). |
| k6 | 0.50+ | Só para testes de carga (`npm run test:load`). |
| Navegadores do Playwright | `npx playwright install --with-deps` | Só para E2E. |
| Editor | VS Code recomendado | Extensões: ESLint, Prettier, Prisma, Vitest, Playwright, Mermaid. |

Acessos que o dev precisa pedir ao Tech Lead no primeiro dia: repositório GitHub, ambiente de staging (somente leitura de logs/dashboards), conta sandbox do Pagar.me (somente as chaves de teste), Sentry e o projeto de observabilidade (Grafana/SigNoz).

---

## 2. Estrutura do monorepo

```text
003-project/
├── apps/
│   ├── web/                 # Next.js (App Router) + PixiJS — canvas, PWA, telas de triagem
│   ├── api/                 # NestJS — REST /api/v1, gateway Socket.io, webhooks
│   └── worker/              # NestJS (standalone) — consumidores BullMQ, relay do outbox, reconciliador
├── packages/
│   ├── core-domain/         # Regras de negócio puras (TS sem dependências de infra)
│   ├── database/            # Prisma schema, migrations, seeds, adapters de repositório
│   ├── ui-components/       # Design system e componentes visuais (React + sprites PixiJS)
│   └── contracts/           # DTOs, schemas Zod, OpenAPI, tipos de eventos WS e de domínio
├── tools/                   # scripts de ops (CLI), k6, geradores
├── docker-compose.yml
├── .env.example
├── turbo.json
└── package.json             # workspaces: ["apps/*", "packages/*"]
```

### 2.1 Responsabilidade de cada pasta

| Pasta | Responsabilidade | Pode importar | Não pode importar |
| :--- | :--- | :--- | :--- |
| `packages/core-domain` | Entidades, objetos de valor (`Money`, `QuotaCount`, `PriceTiers`), máquina de estados da bolha (ADR-0009), cálculo de preço por degraus (ADR-0004), regras de cota PF/PJ (ADR-0006), modelo de score (ADR-0007), eventos de domínio, **portas** (interfaces) e **casos de uso**. | `contracts` (somente tipos), bibliotecas puras (ex.: `uuid`) | NestJS, Prisma, Redis, BullMQ, Socket.io, `fetch`, `process.env`, relógio do sistema (usar porta `Clock`) |
| `packages/database` | `schema.prisma`, migrations SQL, seeds, **adapters** que implementam as portas de repositório, `UnitOfWork` sobre `prisma.$transaction`, gravação no `outbox_events`. | `core-domain`, `contracts`, Prisma | `apps/*` |
| `packages/contracts` | Contratos compartilhados entre front e back: DTOs de request/response, schemas Zod, tipos dos eventos WS (`bubble.updated`, `bubble.exploded`…), tipos dos eventos de domínio serializados, códigos de erro RFC 9457. | nada além de `zod` | qualquer outro pacote |
| `packages/ui-components` | Componentes React (Tailwind), tokens do [style-guide](../style-guide.md), renderizadores PixiJS da bolha. | `contracts` | `core-domain` com regras de servidor, `database` |
| `apps/api` | Composição (módulos NestJS por bounded context), controllers REST, guards de auth, gateway WS, endpoint de webhook, adapters HTTP externos (Pagar.me, BrasilAPI/ReceitaWS). | todos os `packages/*` exceto `ui-components` | `apps/web`, `apps/worker` |
| `apps/worker` | Mesmo código de módulos que a API, iniciado como processo separado (ADR-0001): processadores BullMQ (`bubble-expire`, `bubble-expiring`, `bid-selection-timeout`, `triage-deadline`), relay do outbox, reconciliador de 1 min (ADR-0011), conciliação financeira diária. | idem `apps/api` | `apps/web` |
| `apps/web` | UI, canvas (PixiJS + QuadTree), cliente Socket.io, PWA, RUM. | `contracts`, `ui-components` | `core-domain`, `database` |

### 2.2 Regra de dependência

```mermaid
flowchart LR
  web[apps/web] --> contracts
  web --> ui[ui-components]
  api[apps/api] --> domain[core-domain]
  api --> database
  api --> contracts
  worker[apps/worker] --> domain
  worker --> database
  worker --> contracts
  database --> domain
  database --> contracts
  domain --> contracts
  ui --> contracts
```

- **O domínio não importa infraestrutura.** `core-domain` define portas (`BubbleRepository`, `PaymentPort`, `Clock`, `IdGenerator`, `UnitOfWork`, `EventRecorder`); `database` e `apps/*` fornecem os adapters.
- A regra é verificada no CI com `eslint-plugin-boundaries` (ou `dependency-cruiser`). Violação reprova o PR.
- Módulos de bounded contexts diferentes (identity, bubble, bidding, payment, triage, reputation, notification, realtime, platform) **não chamam repositórios uns dos outros**. A comunicação entre contextos se dá por caso de uso público do módulo ou por evento de domínio via outbox.

---

## 3. Setup local passo a passo

### 3.1 Primeiro uso

```bash
git clone <repo> bolha-venda && cd bolha-venda/003-project
nvm use                       # lê .nvmrc (24)
npm ci                        # instala todos os workspaces
cp .env.example .env          # valores de dev já funcionam com o compose
docker compose up -d          # Postgres 16 + Redis 7 (+ Mailpit)
npm run db:migrate            # aplica migrations (prisma migrate dev)
npm run db:seed               # contas, bolhas e degraus de exemplo
npm run dev                   # web :3000, api :3001, worker
```

Verificação rápida:
- `curl http://localhost:3001/api/v1/health/ready` → `{"status":"ok","db":"up","redis":"up"}`.
- Abrir `http://localhost:3000` e logar com uma conta do seed (seção 3.4).
- Mailpit em `http://localhost:8025` para ver os e-mails de notificação.

### 3.2 `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: bolha
      POSTGRES_PASSWORD: bolha
      POSTGRES_DB: bolha_dev
    ports: ["5432:5432"]
    command: ["postgres", "-c", "shared_preload_libraries=pg_stat_statements", "-c", "log_min_duration_statement=200"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bolha -d bolha_dev"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec", "--maxmemory-policy", "noeviction"]
    ports: ["6379:6379"]
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  mailpit:
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"]

  # Opcional: docker compose --profile obs up -d
  otel-lgtm:
    image: grafana/otel-lgtm:latest
    profiles: ["obs"]
    ports: ["3030:3000", "4317:4317", "4318:4318"]

volumes:
  pgdata:
  redisdata:
```

> `maxmemory-policy noeviction` é obrigatório para BullMQ: chaves de fila não podem ser despejadas. AOF replica a configuração de produção (ADR-0011, R3).

### 3.3 `.env.example`

```dotenv
# ---------- Geral ----------
NODE_ENV=development
APP_ENV=local                         # local | ci | staging | production
LOG_LEVEL=debug                       # trace|debug|info|warn|error
APP_VERSION=dev                       # preenchido pelo CI com o semver/sha

# ---------- Portas e URLs ----------
API_PORT=3001
WEB_PORT=3000
API_PUBLIC_URL=http://localhost:3001
WEB_PUBLIC_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# ---------- Banco e Redis ----------
DATABASE_URL=postgresql://bolha:bolha@localhost:5432/bolha_dev?schema=public&connection_limit=10
DATABASE_DIRECT_URL=postgresql://bolha:bolha@localhost:5432/bolha_dev   # usado por migrations (sem pooler)
REDIS_URL=redis://localhost:6379
BULLMQ_PREFIX=bull

# ---------- Autenticação ----------
JWT_ACCESS_PRIVATE_KEY_PATH=./.secrets/jwt-access.pem   # gerar com: npm run keys:dev
JWT_ACCESS_PUBLIC_KEY_PATH=./.secrets/jwt-access.pub
JWT_ACCESS_TTL_SECONDS=900                              # 15 min
REFRESH_TOKEN_TTL_DAYS=30
REFRESH_COOKIE_NAME=bv_rt
COOKIE_DOMAIN=localhost
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/oauth/google/callback

# ---------- Criptografia de PII (ADR-0012) ----------
PII_KMS_PROVIDER=local                # local (dev/ci) | gcp-kms | secret-manager
PII_DATA_KEY_BASE64=                  # dev: 32 bytes base64 (npm run keys:dev). Produção: via KMS, nunca em .env
PII_DATA_KEY_ID=dev-key-1
PII_HMAC_KEY_BASE64=                  # chave do HMAC-SHA256 para busca/unicidade

# ---------- Pagamentos (ADR-0003) ----------
PAYMENT_PROVIDER=fake                 # fake | pagarme
PAGARME_API_BASE_URL=https://api.pagar.me/core/v5
PAGARME_SECRET_KEY=                   # sk_test_... (sandbox)
PAGARME_WEBHOOK_SECRET=
PAGARME_RECIPIENT_ID_PLATFORM=        # recebedor da plataforma (split)
PIX_EXPIRATION_SECONDS=900            # 15 min (Spec §5)

# ---------- CNPJ (ADR-0008) ----------
CNPJ_PRIMARY_BASE_URL=https://brasilapi.com.br/api/cnpj/v1
CNPJ_FALLBACK_BASE_URL=https://receitaws.com.br/v1/cnpj
CNPJ_REVALIDATION_DAYS=30
CNPJ_PROVIDER=fake                    # fake | real (dev usa fake para não depender de rede)

# ---------- Regras de bolha ----------
BUBBLE_MIN_DURATION_MINUTES=60
BUBBLE_MAX_DURATION_HOURS=120         # 5 dias (R5, Spec §5)
PIX_RESERVATION_MINUTES=15            # Spec §5
NEAR_FULL_THRESHOLD_PERCENT=80
EXPIRING_WINDOW_MINUTES=60            # flag EXPIRING e bloqueio de saída
AUTO_DELIVERY_CONFIRMATION_DAYS=7
WITHDRAWAL_WINDOW_DAYS=7              # CDC art. 49 (fixo)
SCORE_DISPUTE_WINDOW_DAYS=5
CLOSED_BUBBLE_VISIBLE_HOURS=24
WS_BUBBLE_UPDATE_MIN_INTERVAL_MS=100  # máx. 1 atualização visual por bolha a cada 100 ms
BUBBLE_DEFAULT_MAX_PJ_SHARE=50
TRIAGE_DEFAULT_SHIPPING_DAYS=7
BID_SELECTION_WINDOW_HOURS=24
RECONCILER_INTERVAL_MS=60000

# ---------- Anti-abuso (R8) ----------
RATE_LIMIT_QUOTA_PER_MINUTE=10
CAPTCHA_PROVIDER=none                 # none | turnstile | hcaptcha
CAPTCHA_SECRET=

# ---------- E-mail ----------
SMTP_URL=smtp://localhost:1025
EMAIL_FROM="Bolha Venda <nao-responda@bolhavenda.local>"

# ---------- Observabilidade ----------
OTEL_SERVICE_NAME=bolha-api           # bolha-worker no worker
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=local
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0           # staging/prod: 0.1
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_RUM_ENDPOINT=http://localhost:3001/api/v1/rum

# ---------- Feature flags (defaults locais) ----------
FLAGS_DEFAULTS=bubble_creation_enabled:true,payments_enabled:true,purchase_bubbles_enabled:true
```

Regras: o `.env` nunca é commitado; todo segredo de staging/produção vive no secret manager da plataforma; a API valida as variáveis na inicialização com um schema Zod (`apps/api/src/config/env.ts`) e **não sobe** se faltar alguma.

### 3.4 Seeds

`packages/database/prisma/seed.ts` é idempotente (upsert por chave natural) e cria:

| Conta | Tipo | Senha (só dev) | Uso |
| :--- | :--- | :--- | :--- |
| `carlos@seed.local` | PF, score 500 | `Senha#123` | Persona Carlos Silva |
| `compras@tecnolotes.seed.local` | PJ, CNPJ fictício ATIVO | `Senha#123` | Persona TecnoLotes Ltda |
| `pj2@seed.local` | PJ | `Senha#123` | Concorrente em lances |
| `admin@seed.local` | PF + papel `moderator` | `Senha#123` | Moderação |

E cerca de 500 bolhas espalhadas pelo canvas (para o benchmark do RNF01: frame time p95 ≤ 16,7 ms), com degraus de preço, metade `SALE` e metade `PURCHASE`, em estados variados. `npm run db:seed -- --small` cria só 20 bolhas.

---

## 4. Comandos

| Comando | O que faz |
| :--- | :--- |
| `npm run dev` | Sobe web, api e worker em modo watch (Turborepo). |
| `npm run build` | Build de todos os workspaces. |
| `npm run lint` | ESLint + regra de fronteiras + Prettier check. |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces. |
| `npm run test` | Testes unitários (Vitest) — `core-domain` e lógica pura. |
| `npm run test:int` | Integração (Vitest + Supertest + Testcontainers: Postgres 16 e Redis 7 efêmeros). |
| `npm run test:e2e` | Playwright contra o stack local (`docker compose` + `npm run start:e2e`). Inclui axe-core nas telas principais. |
| `npm run test:load` | k6 (`tools/k6/*.js`): rajada da última cota, conexões WS, canvas. Nunca contra produção. |
| `npm run test:concurrency` | Cenário do Plano §9: 100 requisições paralelas para 1 cota restante → 1 × 201 e 99 × 409. |
| `npm run db:migrate` | `prisma migrate dev` (cria/aplica migration local). |
| `npm run db:migrate:create -- --name <nome>` | Cria migration sem aplicar (`--create-only`) para editar SQL. |
| `npm run db:deploy` | `prisma migrate deploy` (usado pelo CI/CD). |
| `npm run db:seed` / `db:reset` | Seed / drop + migrate + seed (só local). |
| `npm run keys:dev` | Gera chaves JWT e chaves de PII de desenvolvimento em `.secrets/`. |
| `npm run ops -- <comando>` | CLI de operação (`tools/ops`), usada nos [runbooks](../09-operacao/runbooks.md). |

Filtrar por workspace: `npx turbo run test --filter=@bolha/core-domain`.

---

## 5. Convenções de código TypeScript

### 5.1 Geral
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Proibido `any` (use `unknown` + parse com Zod nas bordas).
- ESM, imports absolutos por alias de pacote (`@bolha/core-domain`), nunca `../../../packages/...`.
- Funções pequenas, interfaces de porta pequenas (só os métodos que o caso de uso precisa).

### 5.2 Nomes
| Elemento | Convenção | Exemplo |
| :--- | :--- | :--- |
| Arquivos | `kebab-case` | `acquire-quota.use-case.ts` |
| Classes, tipos, interfaces | `PascalCase`, sem prefixo `I` | `BubbleRepository`, `AcquireQuota` |
| Variáveis e funções | `camelCase` | `filledQuotas` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_PF_QUOTAS_PER_BUBBLE` |
| Tabelas e colunas | `snake_case`, tabelas no plural (nomes canônicos) | `price_tiers.min_filled_quotas` |
| Eventos de domínio | Passado, `PascalCase` | `QuotaAcquired`, `BubbleExploded` |
| Eventos WS | `contexto.acao` minúsculo | `bubble.updated` |
| Filas BullMQ | `kebab-case` | `bubble-expire` |
| Linguagem | Código em inglês; termos do domínio seguem o glossário (bubble, quota, bid, triage, score). Textos de UI em pt-BR. |

### 5.3 Erros
- **Falhas de negócio esperadas** (cotas esgotadas, PF já tem cota, teto PJ excedido, bolha não está `ACTIVE`, criador tentando participar, lance acima do `target_price` — `BID_ABOVE_TARGET`) são **valores de retorno**: `Result<T, DomainError>`. O controller mapeia o `DomainError.code` para problem+json (RFC 9457).
- **Violação de invariante** dentro de uma entidade (ex.: transição de estado inválida chamada pelo próprio código) lança `DomainInvariantViolation`. É bug, vira 500 e alerta no Sentry.
- **Falhas de infraestrutura** (timeout de banco, gateway fora) são exceções; o filtro global da API as converte em 503/502 com `type` padronizado. Nunca vazam stack ou SQL para o cliente.

```ts
// packages/core-domain/src/shared/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type DomainError =
  | { code: 'BUBBLE_NOT_ACTIVE' }
  | { code: 'QUOTA_SOLD_OUT'; available: number }
  | { code: 'PF_QUOTA_LIMIT' }
  | { code: 'PJ_SHARE_EXCEEDED'; maxForAccount: number }
  | { code: 'CREATOR_CANNOT_JOIN' }
  | { code: 'ACCOUNT_NOT_VERIFIED' }
  | { code: 'PAYMENT_DECLINED'; reason: string };
```

Mapeamento HTTP padrão (códigos da Spec F5): `BUBBLE_NOT_ACTIVE` → 409, `QUOTA_SOLD_OUT` → 409, `PF_QUOTA_LIMIT` → 409, `PJ_SHARE_EXCEEDED` → 422, `CREATOR_CANNOT_JOIN` → 403, `ACCOUNT_NOT_VERIFIED` → 403, `PAYMENT_DECLINED` → 402. As mensagens ao usuário são as da Spec F5. O catálogo completo de `type` URIs vive em `packages/contracts/src/errors.ts`.

### 5.4 Dinheiro, datas e IDs
- **Dinheiro em centavos**: `bigint` no banco, `bigint` no TS de domínio (objeto de valor `Money { cents: bigint; currency: 'BRL' }`). Na API JSON, serializar como **string** (`"unitPriceCents": "12990"`) para não perder precisão. Proibido `number` com casas decimais e proibido `float` no banco. Arredondamento só em um lugar (`Money.multiply`), sempre explícito.
- **Datas em UTC**: colunas `timestamptz`; no TS, `Date` ou `Temporal.Instant` (polyfill) sempre em UTC; fuso `America/Sao_Paulo` só na formatação da UI. O domínio nunca chama `new Date()` — usa a porta `Clock` (permite testes determinísticos de expiração).
- **IDs UUID v7** gerados na aplicação (porta `IdGenerator`, implementação com a lib `uuid` v10+ `v7()`), porque o PostgreSQL 16 não tem `uuidv7()` nativo. Coluna `uuid`. UUID v7 é ordenável por tempo, o que favorece índices e paginação por cursor.

### 5.5 Logs
Logger `pino` estruturado em JSON, com `trace_id`/`span_id` injetados pelo OpenTelemetry. **Proibido logar PII** (CPF, CNPJ, e-mail, nome, telefone, endereço, token, dados de cartão). Os caminhos sensíveis são removidos pela configuração `redact` do pino e um teste de contrato garante isso. Detalhes em [SLO e observabilidade](../09-operacao/slo-observabilidade.md#5-logs-estruturados-sem-pii).

---

## 6. Padrão de módulo NestJS hexagonal

Cada bounded context é um módulo NestJS com a mesma forma:

```text
apps/api/src/modules/bubble/
├── bubble.module.ts            # wiring: liga portas do domínio aos adapters
├── http/
│   ├── quotas.controller.ts    # adapter de entrada (REST)
│   └── dto/                    # reexporta schemas de @bolha/contracts
└── realtime/                   # (quando houver) handlers WS
packages/core-domain/src/bubble/
├── bubble.ts                   # entidade + máquina de estados
├── price-tiers.ts              # cálculo de preço (ADR-0004)
├── ports.ts                    # portas
└── use-cases/acquire-quota.ts  # caso de uso
packages/database/src/bubble/
└── prisma-quota-reservation.ts # adapter de saída
```

### 6.1 Exemplo completo: caso de uso `AcquireQuota`

Implementa RF03.1, RF03.2, RF03.3, RF03.5, RF07.1 e RNF02 conforme ADR-0002 (concorrência), ADR-0003 (pré-autorização), ADR-0004 (preço) e ADR-0006 (teto PJ). O fluxo é o do PRD v2.1 §8.2: **pré-autorizar → reservar em uma transação → compensar se a reserva falhar**. Assim nenhuma cota fica ocupada sem dinheiro reservado. O valor reservado é `valor_reserva × quantidade`, com `valor_reserva` = preço inicial (venda) ou preço-alvo (compra) (Spec F5).

> **Pix:** o exemplo cobre o cartão. No Pix (Spec F5, §5), a cobrança tem 15 min para ser paga e a cota fica **reservada** nesse período: a reserva ocupa capacidade, mas **não conta para a meta mínima** se a bolha explodir antes do pagamento (Spec §6). A confirmação chega por webhook e a expiração é tratada por um job de 15 min. O modelo exato (estado da cota reservada e nome do job) deve ser fixado na ERS/ADR-0003; os nomes canônicos de jobs do ADR-0011 ainda não incluem esse timer.

**Portas** (`packages/core-domain/src/bubble/ports.ts`):

```ts
import type { Money } from '../shared/money';
import type { DomainEvent } from '../shared/events';

export type AccountType = 'PF' | 'PJ';

export interface ReserveQuotaInput {
  quotaId: string;
  bubbleId: string;
  accountId: string;
  accountType: AccountType;
  quantity: number;
  paymentId: string;
  now: Date;
}

export type ReserveQuotaOutcome =
  | { status: 'RESERVED'; filledQuotas: number; maxQuotas: number; exploded: boolean }
  | { status: 'NOT_ACTIVE' | 'SOLD_OUT' | 'PF_ALREADY_HAS_QUOTA' | 'PJ_SHARE_EXCEEDED'; available?: number };

/** Porta de saída: reserva atômica (implementada no adapter Prisma). */
export interface QuotaReservationPort {
  reserve(input: ReserveQuotaInput, events: (o: Extract<ReserveQuotaOutcome, { status: 'RESERVED' }>) => DomainEvent[]):
    Promise<ReserveQuotaOutcome>;
}

export interface BubbleReadPort {
  getForQuota(bubbleId: string): Promise<{ status: string; type: 'SALE' | 'PURCHASE'; creatorId: string; initialPrice: Money; targetPrice: Money; tiers: PriceTier[]; maxQuotas: number; maxPjShare: number } | null>;
}

export interface PaymentPort {
  authorize(i: { idempotencyKey: string; accountId: string; amount: Money; method: 'CARD' | 'PIX' }):
    Promise<{ ok: true; paymentId: string } | { ok: false; reason: string }>;
  release(i: { paymentId: string; idempotencyKey: string }): Promise<void>;  // void da pré-autorização / estorno do Pix
}

export interface Clock { now(): Date }
export interface IdGenerator { next(): string } // UUID v7
export type PriceTier = { minFilledQuotas: number; unitPrice: Money };
```

**Caso de uso** (`packages/core-domain/src/bubble/use-cases/acquire-quota.ts`):

```ts
import { ok, err, type Result, type DomainError } from '../../shared/result';
import { currentUnitPrice } from '../price-tiers';
import type { BubbleReadPort, Clock, IdGenerator, PaymentPort, QuotaReservationPort, AccountType } from '../ports';

export interface AcquireQuotaCommand {
  bubbleId: string;
  accountId: string;
  accountType: AccountType;
  quantity: number;
  paymentMethod: 'CARD' | 'PIX';
  idempotencyKey: string;   // vem do header Idempotency-Key
}

export class AcquireQuota {
  constructor(
    private readonly bubbles: BubbleReadPort,
    private readonly reservations: QuotaReservationPort,
    private readonly payments: PaymentPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: AcquireQuotaCommand): Promise<Result<{ quotaId: string; filledQuotas: number; currentPriceCents: bigint }, DomainError>> {
    if (cmd.accountType === 'PF' && cmd.quantity !== 1) return err({ code: 'PF_QUOTA_LIMIT' });   // RF03.1
    if (!Number.isInteger(cmd.quantity) || cmd.quantity < 1) return err({ code: 'QUOTA_SOLD_OUT', available: 0 });
    // ACCOUNT_NOT_VERIFIED (PJ sem CNPJ ativo) é checado pelo guard de identidade antes do caso de uso

    const bubble = await this.bubbles.getForQuota(cmd.bubbleId);
    if (!bubble || bubble.status !== 'ACTIVE') return err({ code: 'BUBBLE_NOT_ACTIVE' });
    if (bubble.creatorId === cmd.accountId) return err({ code: 'CREATOR_CANNOT_JOIN' });

    // 1) Pré-autoriza valor_reserva × cotas (cartão) ou cobra (Pix) — ADR-0003 / Spec F5
    const reserveUnit = bubble.type === 'SALE' ? bubble.initialPrice : bubble.targetPrice;
    const auth = await this.payments.authorize({
      idempotencyKey: `quota:${cmd.idempotencyKey}`,
      accountId: cmd.accountId,
      amount: reserveUnit.multiply(cmd.quantity),
      method: cmd.paymentMethod,
    });
    if (!auth.ok) return err({ code: 'PAYMENT_DECLINED', reason: auth.reason });

    // 2) Reserva atômica + eventos no outbox, na mesma transação — ADR-0002 / ADR-0010
    const quotaId = this.ids.next();
    const now = this.clock.now();
    const outcome = await this.reservations.reserve(
      { quotaId, bubbleId: cmd.bubbleId, accountId: cmd.accountId, accountType: cmd.accountType, quantity: cmd.quantity, paymentId: auth.paymentId, now },
      (r) => [
        { type: 'QuotaAcquired', aggregateId: cmd.bubbleId, payload: { quotaId, quantity: cmd.quantity, filledQuotas: r.filledQuotas } },
        ...(r.exploded ? [{ type: 'BubbleExploded', aggregateId: cmd.bubbleId, payload: { outcome: 'SUCCESS', reason: 'FULL' } }] : []),
      ],
    );

    if (outcome.status !== 'RESERVED') {
      // 3) Compensação: libera a pré-autorização (idempotente)
      await this.payments.release({ paymentId: auth.paymentId, idempotencyKey: `quota-release:${cmd.idempotencyKey}` });
      return err(mapOutcome(outcome));
    }

    const price = currentUnitPrice(bubble.tiers, outcome.filledQuotas); // "preço atual se fechar agora" — ADR-0004
    return ok({ quotaId, filledQuotas: outcome.filledQuotas, currentPriceCents: price.cents });
  }
}

function mapOutcome(o: { status: string; available?: number }): DomainError {
  switch (o.status) {
    case 'SOLD_OUT': return { code: 'QUOTA_SOLD_OUT', available: o.available ?? 0 };
    case 'PF_ALREADY_HAS_QUOTA': return { code: 'PF_QUOTA_LIMIT' };
    case 'PJ_SHARE_EXCEEDED': return { code: 'PJ_SHARE_EXCEEDED', maxForAccount: o.available ?? 0 };
    default: return { code: 'BUBBLE_NOT_ACTIVE' };
  }
}
```

**Adapter Prisma** (`packages/database/src/bubble/prisma-quota-reservation.ts`):

```ts
import { Prisma, type PrismaClient } from '@prisma/client';
import type { QuotaReservationPort, ReserveQuotaInput, ReserveQuotaOutcome } from '@bolha/core-domain';
import { appendOutbox } from '../platform/outbox';

export class PrismaQuotaReservation implements QuotaReservationPort {
  constructor(private readonly prisma: PrismaClient) {}

  async reserve(i: ReserveQuotaInput, events: Parameters<QuotaReservationPort['reserve']>[1]): Promise<ReserveQuotaOutcome> {
    try {
      return await this.prisma.$transaction(async (tx) => {   // Read Committed (padrão) — sem SERIALIZABLE, sem Redlock
        if (i.accountType === 'PJ') {
          // Serializa apenas compras da MESMA PJ na MESMA bolha, para checar o teto (ADR-0006)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${i.bubbleId} || ':' || ${i.accountId}, 0))`;
          const [cap] = await tx.$queryRaw<{ held: bigint; max_allowed: number }[]>`
            SELECT COALESCE(SUM(q.quantity), 0) AS held,
                   floor(b.max_quotas * b.max_pj_share / 100.0)::int AS max_allowed
            FROM bubbles b LEFT JOIN quotas q
              ON q.bubble_id = b.id AND q.account_id = ${i.accountId}::uuid AND q.status = 'ACTIVE'
            WHERE b.id = ${i.bubbleId}::uuid GROUP BY b.max_quotas, b.max_pj_share`;
          if (!cap || Number(cap.held) + i.quantity > cap.max_allowed)
            return { status: 'PJ_SHARE_EXCEEDED', available: cap ? cap.max_allowed - Number(cap.held) : 0 } as const;
        }

        // Fonte da verdade contra overbooking (ADR-0002 / RNF02)
        const rows = await tx.$queryRaw<{ filled_quotas: number; max_quotas: number }[]>`
          UPDATE bubbles
             SET filled_quotas = filled_quotas + ${i.quantity},
                 status      = CASE WHEN filled_quotas + ${i.quantity} = max_quotas THEN 'EXPIRED_SUCCESS' ELSE status END,
                 exploded_at = CASE WHEN filled_quotas + ${i.quantity} = max_quotas THEN ${i.now} ELSE exploded_at END,
                 version     = version + 1,
                 updated_at  = ${i.now}
           WHERE id = ${i.bubbleId}::uuid
             AND status = 'ACTIVE'
             AND filled_quotas + ${i.quantity} <= max_quotas
          RETURNING filled_quotas, max_quotas`;

        if (rows.length === 0) {
          const [b] = await tx.$queryRaw<{ status: string; available: number }[]>`
            SELECT status, max_quotas - filled_quotas AS available FROM bubbles WHERE id = ${i.bubbleId}::uuid`;
          return b?.status === 'ACTIVE' ? { status: 'SOLD_OUT', available: b.available } as const : { status: 'NOT_ACTIVE' } as const;
        }

        // Índice único parcial quotas(bubble_id, account_id) WHERE account_type='PF' AND status='ACTIVE' (ADR-0002)
        await tx.quota.create({ data: {
          id: i.quotaId, bubbleId: i.bubbleId, accountId: i.accountId, accountType: i.accountType,
          quantity: i.quantity, status: 'ACTIVE', paymentId: i.paymentId, createdAt: i.now } });

        const { filled_quotas, max_quotas } = rows[0]!;
        const result = { status: 'RESERVED' as const, filledQuotas: filled_quotas, maxQuotas: max_quotas, exploded: filled_quotas === max_quotas };
        await appendOutbox(tx, events(result), i.now);   // mesma transação: sem "commit sem evento"
        return result;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { status: 'PF_ALREADY_HAS_QUOTA' }; // unique violada → rollback do UPDATE
      throw e;
    }
  }
}
```

> Nota: o advisory lock por (bolha, PJ) é um detalhe de implementação para o teto PJ; não substitui o `UPDATE` condicional, que continua sendo a única proteção contra overbooking. Confirmar no ADR-0002 durante o Gate A.

**Controller** (`apps/api/src/modules/bubble/http/quotas.controller.ts`):

```ts
@Controller('bubbles/:bubbleId/quotas')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class QuotasController {
  constructor(private readonly acquireQuota: AcquireQuota) {}

  @Post()
  @HttpCode(201)
  @RequireIdempotencyKey()   // interceptor: replay da resposta original se a chave já foi usada
  async acquire(
    @Param('bubbleId', ParseUUIDPipe) bubbleId: string,
    @Body(new ZodPipe(AcquireQuotaRequest)) body: AcquireQuotaRequest,   // de @bolha/contracts
    @CurrentAccount() account: AuthenticatedAccount,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<AcquireQuotaResponse> {
    const r = await this.acquireQuota.execute({
      bubbleId, accountId: account.id, accountType: account.type,
      quantity: body.quantity, paymentMethod: body.paymentMethod, idempotencyKey,
    });
    if (!r.ok) throw ProblemDetails.fromDomain(r.error);   // RFC 9457
    return { quotaId: r.value.quotaId, filledQuotas: r.value.filledQuotas, currentUnitPriceCents: r.value.currentPriceCents.toString() };
  }
}
```

**Wiring** (`bubble.module.ts`): o módulo registra `AcquireQuota` com `useFactory`, injetando `PrismaQuotaReservation`, `PrismaBubbleRead`, `PagarmePaymentAdapter` (ou `FakePaymentAdapter` quando `PAYMENT_PROVIDER=fake`), `SystemClock` e `UuidV7Generator`. O domínio não sabe que NestJS existe.

**Testes esperados para este caso de uso**
- Unitário (Vitest, `core-domain`): portas falsas; PF com `quantity = 2` → `PF_QUOTA_LIMIT`; reserva falha → `release` chamado exatamente 1 vez; explosão por lotação gera `BubbleExploded{SUCCESS, FULL}`.
- Integração (Testcontainers): 100 requisições paralelas para 1 cota restante → 1 sucesso, 99 × 409 `QUOTA_SOLD_OUT` sem cobrança (RNF02, Spec §6), `filled_quotas = max_quotas`; PF em paralelo na mesma bolha → 1 sucesso; outbox com exatamente 1 `BubbleExploded`.

---

## 7. Como adicionar um evento de domínio (outbox)

1. **Declare o tipo** em `packages/contracts/src/events/domain-events.ts` (nome no passado, payload sem PII, `schemaVersion`):
   ```ts
   export const ShipmentRegisteredV1 = z.object({
     type: z.literal('ShipmentRegistered'), schemaVersion: z.literal(1),
     triageItemId: z.string().uuid(), carrier: z.string(), trackingCodeHash: z.string(),
   });
   ```
2. **Emita no caso de uso** retornando o evento para o adapter gravar com `appendOutbox(tx, events, now)` **dentro da mesma transação** da mudança de estado. Nunca publique direto no Redis/Socket.io a partir do caso de uso.
3. **Tabela `outbox_events`** (colunas propostas): `id` (UUID v7), `aggregate_type`, `aggregate_id`, `type`, `schema_version`, `payload jsonb`, `occurred_at`, `published_at null`, `attempts`, `last_error`. Índice parcial `WHERE published_at IS NULL`.
4. **Relay** (no `apps/worker`): lê lotes com `SELECT … FOR UPDATE SKIP LOCKED LIMIT 100`, publica para os consumidores (filas BullMQ internas e o canal do gateway WS) e marca `published_at`. Entrega é **pelo menos uma vez**.
5. **Consumidores idempotentes**: cada handler registra `(event_id, handler)` processado ou usa operação naturalmente idempotente (`UPDATE … WHERE status = 'X'`). Teste obrigatório: entregar o mesmo evento 2 vezes não muda o resultado.
6. **Se o evento vira mensagem WS**, mapeie em `apps/api/src/modules/realtime/projections.ts` para um dos eventos de cliente (`bubble.updated`, `bubble.state_changed`, `bubble.exploded`, `bid.submitted`, `notification.created`) e a room (`bubble:{id}` e/ou `tile:{z}:{x}:{y}`), conforme ADR-0010.
7. **Instrumente**: contador `bolha.domain_events.published{type}` é automático no relay; métricas de negócio específicas vão em [slo-observabilidade.md](../09-operacao/slo-observabilidade.md).
8. **Mudança de payload** = nova `schemaVersion`; consumidores aceitam N e N−1 durante um release (expand/contract também vale para eventos).

---

## 8. Como adicionar uma migration

Toda mudança de schema passa por migration versionada; nenhuma alteração manual em banco de staging ou produção.

1. Edite `packages/database/prisma/schema.prisma`.
2. `npm run db:migrate:create -- --name add_shipping_days_to_bubbles` (gera SQL sem aplicar).
3. **Revise e edite o SQL** gerado quando precisar de algo que o Prisma não expressa: índices únicos parciais (ex.: o de PF do ADR-0002), `CHECK` (preço não crescente, `filled_quotas <= max_quotas`), `CREATE INDEX CONCURRENTLY` (em arquivo de migration separado, pois não roda dentro de transação).
4. `npm run db:migrate` aplica localmente; rode `npm run test:int`.
5. Classifique a migration no PR como **expand**, **migrate (backfill)** ou **contract** e siga as regras de [pipeline-ci-cd.md §5](pipeline-ci-cd.md#5-migrations-em-deploy-expandcontract):
   - nunca renomear/remover coluna no mesmo release em que o código deixa de usá-la;
   - `NOT NULL` em tabela grande: adicionar `CHECK … NOT VALID`, validar depois;
   - backfill em lotes por job, nunca dentro da migration.
6. Conflito de migrations com `develop`: faça rebase, **regere** a sua migration com timestamp posterior e aplique tudo do zero em banco limpo (`npm run db:reset`).

---

## 9. Feature flags

- Armazenamento: tabela `feature_flags` (proposta, módulo `platform`: `key`, `enabled`, `rules jsonb`, `updated_by`, `updated_at`) com cache em memória de 10 s e invalidação via Redis pub/sub. Alteração auditada em `audit_log`. Alternativa a avaliar na S1: Unleash self-hosted.
- Uso no back: `@FeatureGate('payments_enabled')` em controllers ou `flags.isEnabled('x', ctx)` em casos de uso de aplicação (nunca no `core-domain`). No front: `useFlag('x')` a partir de `GET /api/v1/flags` público.
- Tipos: **release** (esconde funcionalidade incompleta; remover até 2 sprints depois de 100%), **ops/kill switch** (permanentes, listados no [plano de release](../09-operacao/plano-release.md#3-feature-flags-e-kill-switches)), **permissão/beta** (allowlist do beta fechado).
- Toda flag nova entra em `packages/contracts/src/flags.ts` com dono e data de remoção prevista. Flag sem dono reprova o PR.

---

## 10. Fluxo Git e checklist de PR

Segue [governance.md](../governance.md):
- Branches a partir de `develop`: `feature/<nome>`, `fix/<nome>`, `docs/<nome>`. Nada direto em `main` ou `develop`.
- Commits em **Conventional Commits**: `feat(bubble): adiciona teto de cotas por PJ`, tipos `feat|fix|docs|style|refactor|test|chore`. Mudança incompatível: `!` após o escopo e rodapé `BREAKING CHANGE:` (necessário para o versionamento semântico; ver [pipeline-ci-cd.md §7](pipeline-ci-cd.md#7-versionamento-semântico-e-changelog)). O commitlint valida no hook e no CI.
- Branches curtas (ideal ≤ 3 dias): branch longa gera conflito de merge caro e atrasa a integração contínua.

**Checklist do PR** (template em `.github/pull_request_template.md`):

- [ ] Título em Conventional Commits; referência ao item do backlog e ao requisito (ex.: RF03.1, ADR-0002).
- [ ] CI verde (lint, typecheck, unit, integração, build, scans).
- [ ] Regras de domínio novas com teste unitário; fluxo crítico com teste de integração/E2E.
- [ ] Sem `core-domain` importando infra (regra de fronteira passou).
- [ ] Dinheiro em centavos/`bigint`, datas UTC, IDs UUID v7.
- [ ] Nenhuma PII em logs, eventos, métricas ou mensagens de erro; dado sensível novo cifrado (ADR-0012).
- [ ] Endpoints POST de cota/lance/pagamento exigem `Idempotency-Key`; erros em problem+json.
- [ ] Migration classificada (expand/migrate/contract) e compatível com a versão anterior do código.
- [ ] Eventos novos via outbox, com consumidor idempotente.
- [ ] Métricas/traces do fluxo instrumentados (DoD do Plano §8).
- [ ] Feature flag criada com dono e data de remoção, se aplicável.
- [ ] Acessibilidade verificada (axe-core) se mexeu em UI.
- [ ] Docs/diagramas em `002-llm` atualizados e log em `001 log/` se a mudança for significativa.
- [ ] 1 aprovação de revisor (2 se tocar em `payment`, `identity` ou migrations destrutivas).

---

## Fontes consultadas (AlterEgo)

- **migration-specialist** — Pramod Sadalage & Martin Fowler, *Evolutionary Database Design*: toda mudança de schema como migration versionada; renumerar e reaplicar do zero ao conflitar com a mainline; banco compatível com mais de uma versão da aplicação em deploys graduais (base das seções 8 e 3).
- **migration-specialist** — *Flyway Docs* (FAQ): "todas as mudanças de banco feitas pela ferramenta, sem exceções" (regra de nenhuma alteração manual).
- **asias-refatoracao** — Martin Fowler, *Refatoração* (limites da refatoração): branches de longa duração geram conflitos semânticos caros e exigem integração contínua (seção 10); interfaces publicadas exigem manter a antiga e depreciar (versionamento de eventos, seção 7).
- **engenharia-software** — Robert C. Martin, *Código Limpo*, cap. 17, heurística G8 "Informações excessivas": interfaces pequenas e baixo acoplamento (portas enxutas, seção 6).
- **signoz-observabilidade** — SigNoz, *OpenTelemetry Node.js — Getting Started with Tracing, Logs, and Metrics*: atributos de recurso consistentes (`service.name`, ambiente) e correlação trace–log (variáveis `OTEL_*` do `.env.example`).
