# syntax=docker/dockerfile:1
# Imagem do worker (BV-105 / EN-025) — pipeline-ci-cd.md §1, §4 e §6.
#
# Build (contexto = 003-project/):
#   docker build -f apps/worker/Dockerfile -t bolha-worker:local .
#
# Mesma estrutura de apps/api/Dockerfile (pruner → builder → runtime não-root, sem npm e sem
# segredos). O worker não expõe HTTP (ADR-0001), então não há EXPOSE.
#
# Imagem base fixada por digest (atualizar junto com a de apps/api/Dockerfile).
ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
ARG TURBO_VERSION=2.11.7

FROM ${NODE_IMAGE} AS pruner
ARG TURBO_VERSION
WORKDIR /repo
COPY . .
RUN npx --yes "turbo@${TURBO_VERSION}" prune @bolha/worker --docker

FROM ${NODE_IMAGE} AS builder
ENV TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0 \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app
COPY --from=pruner /repo/out/json/ ./
RUN --mount=type=cache,id=bolha-npm,target=/root/.npm npm ci
COPY --from=pruner /repo/out/full/ ./
RUN npx turbo run build --filter=@bolha/worker... --output-logs=errors-only
RUN npm prune --omit=dev \
 && find apps packages -mindepth 2 -maxdepth 2 \
      \( -name src -o -name 'tsconfig*.json' -o -name 'vitest.config.*' -o -name 'nest-cli.json' \
         -o -name '.turbo' -o -name 'eslint.config.*' \) -exec rm -rf {} +

FROM ${NODE_IMAGE} AS runtime
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="bolha-worker" \
      org.opencontainers.image.description="Bolha Venda — worker NestJS (BullMQ, outbox, reconciliador)" \
      org.opencontainers.image.source="https://github.com/AlessonEvangelista/sales-bubble" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker
WORKDIR /app/apps/worker
USER node
# Sem HTTP: o healthcheck só confirma que o processo principal responde a sinais. Um
# heartbeat real (fila/Redis) entra com os processadores BullMQ (ADR-0011).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "process.kill(1, 0)"]
# SIGTERM → enableShutdownHooks/worker.close() drena os jobs ativos (pipeline-ci-cd.md §6).
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "dist/main.js"]
