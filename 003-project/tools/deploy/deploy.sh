#!/usr/bin/env bash
# Deploy de api/worker por imagem imutável (BV-105 / EN-025) — pipeline-ci-cd.md §4 e §6.
#
# Uso: tools/deploy/deploy.sh <ambiente> <api|worker> <imagem@sha256:digest>
#
# Implanta exatamente a imagem verificada (por digest; nunca `latest`). A plataforma é
# escolhida no BV-104 e chega em PLATFORM:
#   - cloudrun: api como serviço Cloud Run, worker como worker pool (sem HTTP).
#               Cloud Run não lê do GHCR: IMAGE_MIRROR (ex.: um repositório remoto do
#               Artifact Registry apontando para ghcr.io) substitui o prefixo `ghcr.io`.
#               Usa GCP_PROJECT_ID, GCP_REGION e a credencial OIDC (.github/actions/oidc-cloud-auth, BV-110).
#   - railway:  troca a imagem do serviço via API GraphQL e dispara o deploy. Usa
#               RAILWAY_TOKEN (token de projeto), RAILWAY_ENVIRONMENT_ID e
#               RAILWAY_<API|WORKER>_SERVICE_ID.
# Segredos de aplicação continuam no secret manager da plataforma; aqui só se troca a imagem.
set -euo pipefail

ENVIRONMENT="${1:?uso: deploy.sh <ambiente> <api|worker> <imagem>}"
COMPONENT="${2:?uso: deploy.sh <ambiente> <api|worker> <imagem>}"
IMAGE="${3:?uso: deploy.sh <ambiente> <api|worker> <imagem>}"
PLATFORM="${PLATFORM:-}"
SERVICE="bolha-${COMPONENT}-${ENVIRONMENT}"

case "$COMPONENT" in api | worker) ;; *) echo "Componente inválido: $COMPONENT" >&2; exit 2 ;; esac
case "$IMAGE" in *@sha256:*) ;; *) echo "A imagem precisa ser referenciada por digest: $IMAGE" >&2; exit 2 ;; esac

case "$PLATFORM" in
  cloudrun)
    : "${GCP_REGION:?GCP_REGION ausente}"
    image="$IMAGE"
    if [ -n "${IMAGE_MIRROR:-}" ]; then image="${IMAGE/#ghcr.io/$IMAGE_MIRROR}"; fi
    common=(--image="$image" --region="$GCP_REGION" --quiet
      --labels="app=bolha-venda,component=${COMPONENT},env=${ENVIRONMENT}"
      --update-env-vars="APP_ENV=${ENVIRONMENT},APP_VERSION=${APP_VERSION:-unknown}")
    [ -n "${GCP_PROJECT_ID:-}" ] && common+=(--project="$GCP_PROJECT_ID")
    if [ "$COMPONENT" = api ]; then
      gcloud run deploy "$SERVICE" "${common[@]}" --port=3001
    else
      gcloud run worker-pools deploy "$SERVICE" "${common[@]}"
    fi
    ;;
  railway)
    : "${RAILWAY_TOKEN:?RAILWAY_TOKEN ausente}"
    : "${RAILWAY_ENVIRONMENT_ID:?RAILWAY_ENVIRONMENT_ID ausente}"
    var="RAILWAY_$(echo "$COMPONENT" | tr '[:lower:]' '[:upper:]')_SERVICE_ID"
    service_id="${!var:?$var ausente}"
    gql() {
      curl --fail-with-body -sS https://backboard.railway.com/graphql/v2 \
        -H "Project-Access-Token: ${RAILWAY_TOKEN}" -H 'Content-Type: application/json' \
        --data "$1"
    }
    gql "$(jq -nc --arg s "$service_id" --arg e "$RAILWAY_ENVIRONMENT_ID" --arg i "$IMAGE" \
      '{query: "mutation($s:String!,$e:String!,$i:String!){serviceInstanceUpdate(serviceId:$s,environmentId:$e,input:{source:{image:$i}})}",
        variables: {s: $s, e: $e, i: $i}}')"
    gql "$(jq -nc --arg s "$service_id" --arg e "$RAILWAY_ENVIRONMENT_ID" \
      '{query: "mutation($s:String!,$e:String!){serviceInstanceDeployV2(serviceId:$s,environmentId:$e)}",
        variables: {s: $s, e: $e}}')"
    ;;
  '')
    msg="PLATFORM vazio (BV-104 pendente) — deploy de $COMPONENT em $ENVIRONMENT pulado."
    if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::warning title=Plataforma não definida::$msg"; else echo "AVISO: $msg"; fi
    ;;
  *)
    echo "Plataforma desconhecida: $PLATFORM (esperado: cloudrun | railway)" >&2
    exit 2
    ;;
esac
