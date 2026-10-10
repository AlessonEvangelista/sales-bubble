# 💻 003-project - Ambiente de Desenvolvimento de Código-Fonte

Este diretório contém os códigos-fonte das aplicações web, serviços de backend e pacotes reutilizáveis do Bolha Venda.
O monorepo usa **npm workspaces + Turborepo**, Node.js **24 LTS** e TypeScript em modo estrito
(ver [guia de desenvolvimento](../002-llm/002%20Docs/06-engenharia/guia-desenvolvimento.md) e
[ADR-0001](../002-llm/002%20Docs/05-arquitetura/adr/0001-monolito-modular.md)).

---

## 🏗️ Estrutura do Monorepo

```text
003-project/
├── apps/
│   ├── web/              # @bolha/web — Next.js (App Router) + PixiJS: canvas, PWA, triagem
│   ├── api/              # @bolha/api — NestJS: REST /api/v1, gateway Socket.io, webhooks
│   └── worker/           # @bolha/worker — NestJS standalone: BullMQ, relay do outbox, reconciliador
├── packages/
│   ├── core-domain/      # @bolha/core-domain — regras de negócio puras (sem infraestrutura)
│   ├── database/         # @bolha/database — Prisma, migrations, seeds, adapters de repositório
│   ├── ui-components/    # @bolha/ui-components — design system (React + sprites PixiJS)
│   └── contracts/        # @bolha/contracts — DTOs, schemas Zod, eventos WS/domínio, erros RFC 9457
├── tools/                # scripts de ops (CLI), k6, geradores
├── prototipacao-gemini/  # protótipo estático (fora dos workspaces)
├── eslint.config.js      # ESLint flat config compartilhado
├── tsconfig.base.json    # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
├── turbo.json            # pipelines build / dev / lint / typecheck / test
└── package.json          # workspaces: ["apps/*", "packages/*"]
```

Regra de dependência (guia §2.2): `web → contracts, ui-components`; `api`/`worker → core-domain, database, contracts`;
`database → core-domain, contracts`; `core-domain → contracts`; `ui-components → contracts`; `contracts` não importa
ninguém. Essas fronteiras são verificadas automaticamente (BV-101 — ver [Fronteiras entre pacotes](#-fronteiras-entre-pacotes-bv-101)).

---

## 🛠️ Instruções de Execução Local (Dev Setup)

Pré-requisitos: Node.js 24 (`nvm use` lê o `.nvmrc`), npm 11+ e Docker 24+ com Compose v2 (`docker compose`).

```bash
cd 003-project
npm install          # ou `npm ci` quando houver package-lock.json versionado
cp .env.example .env # valores de dev já funcionam com o compose (ver aviso abaixo)
npm run db:up        # Postgres 16 + Redis 7 + Mailpit, espera os healthchecks
npm run db:seed      # seed de desenvolvimento (`-- --small` para 20 bolhas)
npm run dev          # web :3000, api :3001, worker
```

Verificação rápida:

- `curl http://localhost:3001/api/v1/health/live` → `{"status":"ok"}`
- `curl http://localhost:3001/api/v1/health/ready` → `{"status":"ok","db":"up","redis":"up"}` (503 se algum estiver fora)
- Mailpit (e-mails de dev): <http://localhost:8025>

> **Atenção ao `.env`:** se o seu `003-project/.env` já guarda credenciais de ferramentas
> (Jira/GitHub — ver [REPO_MAP](../002-llm/REPO_MAP.md)), **não** rode o `cp`: acrescente as
> variáveis do `.env.example` ao final do arquivo. O `.env` nunca é commitado (`.gitignore`).

### Infraestrutura local (`docker-compose.yml`)

| Serviço | Imagem | Porta no host | Observação |
| :--- | :--- | :--- | :--- |
| `postgres` | `postgres:16-alpine` | `5432` (`POSTGRES_HOST_PORT`) | usuário/senha `bolha`/`bolha`, banco `bolha_dev`, `pg_stat_statements` |
| `redis` | `redis:7-alpine` | `6379` (`REDIS_HOST_PORT`) | AOF `everysec` + `maxmemory-policy noeviction` (obrigatório p/ BullMQ) |
| `mailpit` | `axllent/mailpit` | `1025` (SMTP), `8025` (UI) | caixa de e-mail falsa |
| `otel-lgtm` | `grafana/otel-lgtm` | `3030`, `4317`, `4318` | opcional: `docker compose --profile obs up -d` |

Os dados persistem nos volumes nomeados `pgdata` e `redisdata`; `docker compose down -v` apaga tudo.
Se 5432/6379 já estiverem ocupadas por outro projeto, defina `POSTGRES_HOST_PORT`/`REDIS_HOST_PORT`
no `.env` e ajuste a porta em `DATABASE_URL`, `DATABASE_DIRECT_URL` e `REDIS_URL`.

### Variáveis de ambiente

O [`.env.example`](.env.example) lista todas as variáveis do guia (§3.3), agrupadas e comentadas, sem
segredos reais. A API (`apps/api/src/config/env.ts`) e o worker (`apps/worker/src/config/env.ts`) carregam
o `003-project/.env` (variáveis do processo têm precedência) e validam com Zod na inicialização: sem
`DATABASE_URL`/`REDIS_URL` válidas o processo **não sobe**. Cada história acrescenta ao schema as variáveis
que passar a consumir. Segredos de staging/produção vivem no secret manager, nunca em `.env`.

### Comandos

| Comando | O que faz |
| :--- | :--- |
| `npm run build` | `turbo run build` — `tsc` nos pacotes/api/worker, `next build` no web. |
| `npm run dev` | Sobe web, api e worker em modo watch. |
| `npm run lint` | ESLint em todos os workspaces + regras de fronteira (`lint:boundaries`). |
| `npm run lint:boundaries` | dependency-cruiser: grafo de dependências entre pacotes (falha em violação). |
| `npm run test:boundaries` | Testa as próprias regras de fronteira contra fixtures com violações conhecidas. |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces. |
| `npm run test` | Testes unitários (Vitest). |
| `npm run format` / `format:check` | Prettier. |
| `npm run db:up` / `db:down` | `docker compose up -d --wait` / `docker compose down` (preserva os volumes). |
| `npm run db:logs` | Logs do Postgres e do Redis. |
| `npm run db:seed` | Seed de desenvolvimento (`-- --small` → 20 bolhas). Até o BV-107 só valida a conexão. |
| `npm run keys:dev` | Gera chaves de dev em `.secrets/`: par RSA do JWT RS256 e chaves de PII (`pii-keys.env`). |

Filtrar por workspace: `npx turbo run test --filter=@bolha/core-domain`.

---

## 🧱 Fronteiras entre pacotes (BV-101)

Ferramenta: **dependency-cruiser** (`.dependency-cruiser.cjs`), que lê o grafo real de imports
(incluindo `import type`) e reprova o PR em qualquer violação (ADR-0001 item 5, pipeline-ci-cd §2).
Complementa o ESLint, que no `core-domain` proíbe `process`, `fetch`, timers, `Date.now()` e
`new Date()` sem argumentos (usar a porta `Clock`).

| Regra | O que bloqueia |
| :--- | :--- |
| `no-circular` | Ciclos de dependência. |
| `packages-not-to-apps` / `app-not-to-other-app` | Pacote importando app; app importando outro app. |
| `no-relative-cross-workspace` | `../../packages/x/src/...` entre workspaces (use `@bolha/x`). |
| `core-domain-no-outward-deps` | `core-domain` importando qualquer coisa além de si, `@bolha/contracts` e libs puras permitidas (hoje: `uuid`). |
| `core-domain-contracts-type-only` | Import de **valor** de `@bolha/contracts` no `core-domain` (use `import type`). |
| `core-domain-context-public-api` | Um contexto do `core-domain` usando arquivos internos de outro (só `index.ts` ou `shared/`). |
| `contracts-only-zod` | `contracts` importando algo além de `zod`. |
| `database-allowed-deps` / `database-no-cross-context-repositories` | `database` → `ui-components`; adapter de um contexto chamando repositório de outro (permitidos `shared/` e `platform/`). |
| `ui-components-only-contracts` | `ui-components` → `core-domain`/`database`. |
| `web-not-to-server-packages` | `web` → `core-domain`/`database`. |
| `server-apps-not-to-ui-components` | `api`/`worker` → `ui-components`. |
| `nest-module-public-api` | Módulo Nest usando arquivos internos de outro módulo (só `*.module.ts` ou `index.ts`). |

```bash
npm run lint:boundaries   # verifica a árvore atual
npm run test:boundaries   # garante que cada regra detecta a violação correspondente (tools/boundaries/fixtures)
```

O `tsconfig.depcruise.json` (usado só pelo dependency-cruiser) resolve `@bolha/*` para o `src/` de cada
pacote, então a verificação não depende de build prévio e distingue `import type` de import de valor.
Para ampliar as libs puras do `core-domain`, edite `CORE_DOMAIN_ALLOWED_NPM` no `.dependency-cruiser.cjs`
(exige revisão do tech lead).

## ✅ CI (GitHub Actions)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (raiz do repositório, BV-103) roda em todo PR
(inclusive PRs empilhados) e em push para `main`/`develop`, sempre dentro de `003-project/`
(Node do `.nvmrc`, `npm ci`, cache do npm e do Turborepo). Gates conforme
[pipeline-ci-cd.md §2](../002-llm/002%20Docs/06-engenharia/pipeline-ci-cd.md#2-gates-obrigatórios-branch-protection):

| Job | Gates | Reproduzir localmente |
| :--- | :--- | :--- |
| Qualidade | commitlint (PR), Prettier, ESLint, fronteiras `lint:boundaries` + `test:boundaries` (BV-101), `tsc`, Prisma/squawk (BV-107) | `npm run format:check && npm run lint && npm run typecheck` |
| Testes unitários | Vitest + cobertura; piso do `core-domain` 90% linhas / 85% ramos | `npm run test:coverage` |
| Integração | Postgres 16 + Redis 7 (services), `test:int`, `test:concurrency`, `test:contract` | pendente (BV-102/BV-107/BV-111) |
| Build | `turbo run build` | `npm run build` |
| Imagem | build Docker + Trivy de api/worker | pendente (Dockerfiles no BV-105) |
| Segurança | gitleaks, `npm audit --omit=dev --audit-level=high`, OSV-Scanner, licenças | `npm audit --omit=dev --audit-level=high && node tools/ci/check-licenses.mjs` |
| SAST | CodeQL `security-extended` | — |
| E2E | Playwright + axe sobre docker compose | pendente (Playwright e compose/BV-102) |
| **CI OK** | agrega todos os jobs — use este como *required check* | — |

Gates cujo ferramental ainda não existe rodam via `tools/ci/run-if-present.mjs <script> <ticket>`: sem o
script, o passo emite o aviso **"Gate pendente"** e passa; quando a tarefa criar o script (ex.: `lint:boundaries`),
o gate passa a bloquear sem editar o workflow. Exceções de licença ficam em `tools/ci/check-licenses.mjs`;
de vulnerabilidade, em `osv-scanner.toml` (e no registro `.security/exceptions.yaml`).

## Release e deploy de produção (BV-106)

Conforme [pipeline-ci-cd.md §4–§8](../002-llm/002%20Docs/06-engenharia/pipeline-ci-cd.md#7-versionamento-semântico-e-changelog):

- **Versão única do produto** (`vMAJOR.MINOR.PATCH` para api, worker e web), derivada dos Conventional Commits
  pelo **release-please**: `feat` → MINOR, `fix` → PATCH, `!`/`BREAKING CHANGE:` → MAJOR; antes do go-live a
  linha é `0.x` (`bump-minor-pre-major`). Configuração na raiz do repositório:
  [`release-please-config.json`](../release-please-config.json) e
  [`.release-please-manifest.json`](../.release-please-manifest.json) (pacote `003-project`, tag sem componente).
  A versão fica em `003-project/package.json` e o histórico em `003-project/CHANGELOG.md` (gerado).
- [`.github/workflows/release-please.yml`](../.github/workflows/release-please.yml) (push em `main`): abre/atualiza
  o PR de release; o merge cria a tag `vX.Y.Z` + GitHub Release e dispara o deploy de produção. Também abre o
  PR de back-merge `main → develop` quando `develop` existir.
- [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml) (**esqueleto**): release
  publicada ou `workflow_dispatch` numa tag → valida tag e janela → **promove por digest** as imagens que o CD de
  staging (BV-105) já publicou para o commit da tag (`ghcr.io/<owner>/bolha-<app>:sha-<7>`; só adiciona a tag de
  versão, sem rebuild) → confere staging → **migrations** em job próprio → deploy gradual da api
  (Cloud Run `--no-traffic --tag candidate` + `update-traffic` 10% → 50% → 100%), worker rolling, smoke e
  observação, **rollback** automático para a revisão anterior. Os jobs `migrate` e `deploy` usam o environment
  `production` (aprovação manual pelos revisores obrigatórios).
- Janela de deploy: `tools/deploy/check-window.mjs` (seg–qui, 10h–16h BRT, sem feriado nacional nem véspera;
  fora dela só com `override_window` + justificativa). Testes: `npm run test:deploy`.

Configuração no GitHub (pendente — HITL):

| Item | Onde | Valor |
| :--- | :--- | :--- |
| Environment `production` | Settings → Environments | revisores obrigatórios (Tech Lead ou PO + DevOps); tags `v*` apenas |
| `DEPLOY_PLATFORM` | variável do repositório | `cloudrun` ou `railway` (BV-104). Vazia = workflow só valida e avisa "Deploy pendente" |
| `CLOUD_RUN_REGION`, `CLOUD_RUN_API_SERVICE`, `CLOUD_RUN_WORKER_SERVICE`, `CLOUD_RUN_MIGRATE_JOB` | variáveis (Cloud Run) | região; padrões `bolha-api`, `bolha-worker`, `bolha-migrate` |
| `PRODUCTION_URL`, `PRODUCTION_API_URL` / `STAGING_API_URL` | variáveis dos environments | URLs públicas (smoke em `/api/v1/health/ready`) |
| `RELEASE_PLEASE_TOKEN` | segredo (opcional, recomendado) | GitHub App/PAT para o CI rodar no PR de release; sem ele o deploy é disparado por `workflow_dispatch` |
| OIDC na nuvem | `.github/actions/oidc-cloud-auth` | composite action do BV-110 (sem chave de longa duração) |

### Ainda não incluído (tarefas seguintes da S1)

- **BV-107** — schema Prisma e migrations (`db:migrate`, `db:migrate:create`, `db:deploy`, `db:reset`) e a
  gravação real dos dados do seed; **BV-111** — conteúdo do pacote `contracts`.
