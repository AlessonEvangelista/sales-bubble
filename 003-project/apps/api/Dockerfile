# syntax=docker/dockerfile:1
# Imagem da API (BV-105 / EN-025) — pipeline-ci-cd.md §1, §4 e §6.
#
# Build (contexto = 003-project/):
#   docker build -f apps/api/Dockerfile -t bolha-api:local .
#
# Estágios: pruner (turbo prune: só a api e os pacotes de que ela depende) → builder
# (npm ci + build + remoção de devDependencies) → runtime (Node 24 Alpine, sem npm/corepack,
# usuário não-root, arquivos da aplicação somente leitura). Nenhum segredo entra na imagem:
# o .dockerignore barra .env/.secrets e as variáveis chegam em runtime pelo secret manager
# da plataforma (guia de desenvolvimento §3.3).
#
# Imagem base fixada por digest (atualizar junto com a de apps/worker/Dockerfile).
ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
ARG TURBO_VERSION=2.11.7

FROM ${NODE_IMAGE} AS pruner
ARG TURBO_VERSION
WORKDIR /repo
COPY . .
RUN npx --yes "turbo@${TURBO_VERSION}" prune @bolha/api --docker

FROM ${NODE_IMAGE} AS builder
ENV TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0 \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app
# Primeiro só os package.json + lockfile podado: a camada do npm ci fica em cache enquanto
# as dependências não mudam.
COPY --from=pruner /repo/out/json/ ./
RUN --mount=type=cache,id=bolha-npm,target=/root/.npm npm ci
COPY --from=pruner /repo/out/full/ ./
RUN npx turbo run build --filter=@bolha/api... --output-logs=errors-only
# Mantém só o que roda: sem devDependencies, sem fontes TS nem configs de build/teste.
RUN npm prune --omit=dev \
 && find apps packages -mindepth 2 -maxdepth 2 \
      \( -name src -o -name 'tsconfig*.json' -o -name 'vitest.config.*' -o -name 'nest-cli.json' \
         -o -name '.turbo' -o -name 'eslint.config.*' \) -exec rm -rf {} +

FROM ${NODE_IMAGE} AS runtime
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="bolha-api" \
      org.opencontainers.image.description="Bolha Venda — API NestJS (REST /api/v1)" \
      org.opencontainers.image.source="https://github.com/AlessonEvangelista/sales-bubble" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"
# Superfície mínima: aplica correções do Alpine e remove npm/corepack/yarn (não são usados
# em runtime e concentram a maior parte das CVEs reportadas pelo Trivy em imagens Node).
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    API_PORT=3001
WORKDIR /app
# Arquivos pertencem ao root (somente leitura para o usuário `node` que executa o processo).
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
WORKDIR /app/apps/api
USER node
EXPOSE 3001
# Liveness (não consulta Postgres/Redis); a readiness da plataforma usa /api/v1/health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "dist/main.js"]
