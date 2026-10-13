#!/usr/bin/env bash
# Job de migration (BV-105 / EN-025) — pipeline-ci-cd.md §5.1.
#
# Uso: tools/deploy/run-migrations.sh <ambiente>        (ex.: staging)
#
# Roda `npm run db:deploy` (prisma migrate deploy, script do BV-107) ANTES de qualquer
# revisão nova receber tráfego, com o código do mesmo commit das imagens. A URL do banco
# (DATABASE_DIRECT_URL, sem pooler) NÃO fica no GitHub: é lida do secret manager da
# plataforma escolhida no BV-104 (variável PLATFORM):
#   - cloudrun: Secret Manager do GCP (credencial OIDC via .github/actions/oidc-cloud-auth, BV-110);
#               segredo em DB_DIRECT_URL_SECRET (padrão: bolha-<ambiente>-database-direct-url).
#   - railway:  `railway run` injeta as variáveis do serviço RAILWAY_MIGRATION_SERVICE
#               (padrão: api) no ambiente; exige RAILWAY_TOKEN (token de projeto).
# Enquanto o script db:deploy não existir (BV-107), sai com aviso "Gate pendente".
set -euo pipefail

ENVIRONMENT="${1:?uso: run-migrations.sh <ambiente>}"
PLATFORM="${PLATFORM:-}"
cd "$(dirname "$0")/../.."   # 003-project/

warn() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::warning title=$1::$2"; else echo "AVISO ($1): $2"; fi; }

if ! node -e "process.exit(require('./package.json').scripts?.['db:deploy'] ? 0 : 1)"; then
  warn "Gate pendente" "Script db:deploy ainda não existe (BV-107) — migrations de $ENVIRONMENT puladas."
  exit 0
fi

# Sessão da migration: falha rápida em vez de travar o banco (pipeline-ci-cd.md §5.1).
export PGOPTIONS="${PGOPTIONS:--c lock_timeout=5s -c statement_timeout=60s}"

case "$PLATFORM" in
  cloudrun)
    secret="${DB_DIRECT_URL_SECRET:-bolha-${ENVIRONMENT}-database-direct-url}"
    url="$(gcloud secrets versions access latest --secret="$secret" ${GCP_PROJECT_ID:+--project="$GCP_PROJECT_ID"})"
    [ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$url"
    DATABASE_DIRECT_URL="$url" DATABASE_URL="$url" npm run db:deploy
    ;;
  railway)
    : "${RAILWAY_TOKEN:?RAILWAY_TOKEN ausente (token de projeto do Railway, environment staging)}"
    railway run --service "${RAILWAY_MIGRATION_SERVICE:-api}" --environment "$ENVIRONMENT" -- \
      sh -c 'DATABASE_DIRECT_URL="${DATABASE_DIRECT_URL:-$DATABASE_URL}" npm run db:deploy'
    ;;
  '')
    warn "Plataforma não definida" "PLATFORM vazio (BV-104 pendente) — migrations de $ENVIRONMENT puladas."
    ;;
  *)
    echo "Plataforma desconhecida: $PLATFORM (esperado: cloudrun | railway)" >&2
    exit 2
    ;;
esac
