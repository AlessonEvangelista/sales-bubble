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
ninguém. A verificação automática dessas fronteiras entra no **BV-101**.

---

## 🛠️ Instruções de Execução Local (Dev Setup)

Pré-requisitos: Node.js 24 (`nvm use` lê o `.nvmrc`) e npm 11+.

```bash
cd 003-project
npm install          # ou `npm ci` quando houver package-lock.json versionado
npm run build        # build de todos os workspaces (Turborepo, respeitando dependências)
npm run dev          # web :3000, api :3001 (GET /api/v1/health/live), worker
```

| Comando | O que faz |
| :--- | :--- |
| `npm run build` | `turbo run build` — `tsc` nos pacotes/api/worker, `next build` no web. |
| `npm run dev` | Sobe web, api e worker em modo watch. |
| `npm run lint` | ESLint em todos os workspaces. |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces. |
| `npm run test` | Testes unitários (Vitest). |
| `npm run format` / `format:check` | Prettier. |

Filtrar por workspace: `npx turbo run test --filter=@bolha/core-domain`.

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

### Ainda não incluído (tarefas seguintes da S1)

- **BV-101** — regras de fronteira entre pacotes (`eslint-plugin-boundaries` / dependency-cruiser).
- **BV-102** — `docker-compose.yml` (Postgres 16, Redis 7, Mailpit), `.env.example`, seeds e comandos `db:*`.
- **BV-107** — schema Prisma e migrations; **BV-111** — conteúdo do pacote `contracts`.
