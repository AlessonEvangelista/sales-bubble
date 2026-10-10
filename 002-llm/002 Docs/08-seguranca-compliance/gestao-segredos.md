# Gestão de Segredos — Bolha Venda

**Versão:** 1.0 · **Data:** 09/10/2026 · **Status:** Rascunho para revisão
**Tarefa:** [BV-110](https://alessonevangelista.atlassian.net/browse/BV-110) (EN-030 / **SEC-10**, threat model TM-14)
**Base:** [Threat model §7](threat-model.md#7-gestão-de-segredos) · [Pipeline de CI/CD §2 e §4](../06-engenharia/pipeline-ci-cd.md) · [Guia de desenvolvimento §3.3](../06-engenharia/guia-desenvolvimento.md) · [LGPD/RIPD §7](lgpd-ripd.md) · ADR-0012 (criptografia de PII)

> Política operacional de segredos: onde cada segredo vive em cada ambiente, quem acessa, como
> rotaciona, como a varredura (gitleaks) funciona e como o CI se autentica na nuvem sem segredo de
> longa duração (OIDC). Detalha o quadro do threat model §7, que continua sendo o inventário de
> referência. A plataforma de contêiner (Railway × Cloud Run, DEC-12/BV-104) ainda não foi escolhida:
> tudo aqui vale para as duas, com o detalhe de cada uma onde diferem.

---

## 1. Princípios

1. **Nenhum segredo no repositório**, em imagem Docker, em log ou em variável `NEXT_PUBLIC_*`.
   O `.env` nunca é commitado; o `.env.example` só tem campos vazios ou valores de dev sem valor real.
2. **Segredos diferentes por ambiente.** Staging nunca acessa chave de produção; dev/CI usam
   chaves geradas localmente (`npm run keys:dev`) e sandboxes (Pagar.me `sk_test_…`).
3. **O consumidor busca o segredo; o CI não o carrega** (OWASP Secrets Management CS §3.2.3).
   O pipeline tem credencial só para *publicar imagem e criar revisão*; os segredos de aplicação
   chegam ao processo pela plataforma/secret manager, sob a identidade de serviço do processo.
4. **Credencial de CI efêmera**: GitHub OIDC → nuvem, por job (§5). Nenhuma chave JSON de
   conta de serviço em `secrets.*` do GitHub.
5. **Menor privilégio e um dono por segredo** (§2): cada processo só lê os segredos que usa.
6. **Rotação planejada e revogação imediata em incidente** (§3), com trilha de acesso.
7. **Mensagens de erro e logs citam nomes, nunca valores** (env.ts, loader de segredos, redaction
   de logs do BV-108).

## 2. Inventário: onde vive cada segredo

| Segredo (variável) | local (dev) | ci | staging | produção | Quem acessa (prod) | Rotação |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL`, `DATABASE_DIRECT_URL` (Postgres) | `.env` (compose, senha de dev) | service container, valor fixo de teste | Secret Manager do projeto de staging | Secret Manager do projeto de produção; usuário por serviço | identidade da api; do worker (só `DATABASE_URL`); job de migration (`DIRECT`) | 90 dias (ou credencial dinâmica) |
| `REDIS_URL` | `.env` | service container | Secret Manager | Secret Manager | api, worker | 90 dias |
| `PII_DATA_KEY_BASE64` / KEK de PII (ADR-0012) | `.secrets/` via `npm run keys:dev` | gerada no job | KMS (KEK não exportável) + DEK no Secret Manager | idem | api, worker | KEK anual; DEK por *envelope encryption* (BV-109) |
| `PII_HMAC_KEY_BASE64` | `.secrets/` (keys:dev) | gerada no job | Secret Manager | Secret Manager | api, worker | excepcional — exige recalcular hashes (job dedicado) |
| Chave de assinatura JWT (`JWT_ACCESS_PRIVATE_KEY_PATH`) | `.secrets/jwt-access.pem` | gerada no job | Secret Manager, montada como arquivo, `kid` no header | idem | api | 90 dias, 2 chaves ativas na transição |
| `PAGARME_SECRET_KEY` | vazio (`PAYMENT_PROVIDER=fake`) ou `sk_test_…` pessoal do sandbox | não usado (fake) | Secret Manager — **sandbox** | Secret Manager — **produção** | api, worker | 90 dias ou imediata em incidente |
| `PAGARME_WEBHOOK_SECRET` | vazio | não usado | Secret Manager | Secret Manager | api | 90 dias ou imediata |
| `OAUTH_GOOGLE_CLIENT_SECRET` | vazio ou app OAuth de dev | não usado | Secret Manager (app OAuth de staging) | Secret Manager (app de produção) | api | 180 dias |
| `CAPTCHA_SECRET` | vazio (`CAPTCHA_PROVIDER=none`) | não usado | Secret Manager | Secret Manager | api | 180 dias |
| `SENTRY_DSN` (baixo risco, tratado como segredo) | vazio | não usado | Secret Manager | Secret Manager | api, worker | sob demanda |
| Credencial de deploy | — | — | **OIDC** (§5), por job | **OIDC**, por job, environment `production` com revisores | pipeline | por job (efêmera) |
| `RAILWAY_TOKEN` (só se a escolha for Railway) | — | — | segredo do GitHub Environment `staging` | segredo do GitHub Environment `production` | pipeline | 90 dias (§5.3) |
| Tokens de ferramentas do dev (Jira, GitHub) | `003-project/.env` pessoal | — | — | — | o próprio dev | do provedor |

Regras do inventário:
- Os nomes acima que a api/worker leem estão em `apps/{api,worker}/src/config/secret-names.ts`.
  Segredo novo = linha nova nesta tabela **e** no `secret-names.ts` do processo que o usa.
- "Secret Manager" = GCP Secret Manager (Cloud Run) **ou** variáveis seladas (*sealed*) do Railway,
  conforme a plataforma escolhida. Em ambos o valor só é visível para quem administra o projeto da
  plataforma (Tech Lead + DevOps); desenvolvedores não têm leitura em produção.
- Logs do CI pesquisáveis por ≥ 90 dias (threat model §7).

## 3. Rotação, revogação e incidente

**Rotação planejada.** Calendário trimestral (90 dias) do DevOps para os segredos de 90 dias;
os demais conforme a tabela. Procedimento: criar a nova versão no secret manager → novo deploy (ou
reinício) para os processos lerem `latest` → validar (smoke) → revogar a versão antiga no provedor
(Pagar.me, Google, Postgres) → registrar data no inventário. A chave JWT convive em 2 versões
(`kid`) durante a troca.

**Exposição suspeita ou confirmada** (gitleaks no CI, alerta de *secret scanning* do GitHub,
segredo em log), seguindo o OWASP Secrets Management CS §9.2 e o
[plano de incidentes](../09-operacao/resposta-incidentes.md):
1. **Revogar** imediatamente no provedor (não basta apagar o commit).
2. **Rotacionar**: gerar novo valor e publicar no secret manager do ambiente afetado; novo deploy.
3. **Remover** o valor do código/log. Reescrever histórico do git só com decisão do Tech Lead
   (quebra links de commits); o segredo já revogado deixa de ser o problema.
4. **Registrar**: quem tinha acesso, quando foi usado, última rotação — e, se for dado pessoal
   envolvido (chaves de PII), seguir o fluxo de comunicação da LGPD ([lgpd-ripd.md §7](lgpd-ripd.md)).

Contato do incidente: on-call + Tech Lead (RACI do plano de incidentes).

## 4. Varredura de segredos (gitleaks)

| Onde | O quê | Bloqueia? |
| :--- | :--- | :--- |
| CI, job **Segurança** (`.github/workflows/ci.yml`) | `gitleaks-action` nos commits do PR/push com `.gitleaks.toml` (gitleaks 8.30.1 fixado) | **Sim** — qualquer achado não suprimido com justificativa |
| CI, mesmo job | `npm run test:secrets`: prova que cada regra do projeto detecta o seu segredo e não dispara nos casos legítimos; confere que as cópias do loader da api e do worker são iguais | Sim |
| Local, opcional | hook `pre-commit` (`npm run hooks:install`) com gitleaks sobre o *staged* | Só local; sem gitleaks instalado o hook avisa e deixa passar |

**Configuração** (`/.gitleaks.toml`, raiz do repositório): regras padrão do gitleaks
(`useDefault`) + regras do projeto:
- `pagarme-api-key` — `sk_live_`/`sk_test_`/`ak_live_`/`ak_test_` do Pagar.me (as chaves públicas
  `pk_` não são segredo e não entram);
- `bolha-pii-key` — chave de PII em base64 de 32 bytes atribuída a `PII_*KEY*`;
- `bolha-env-secret-assignment` — valor em variável terminada em `SECRET`, `SECRET_KEY`,
  `PASSWORD`, `TOKEN` ou `API_KEY` no formato `.env`.

**Allowlist mínima** (só nessa última regra, justificada no arquivo): referências `$VAR`/`${VAR}`
(não são valores) e placeholders explícitos (`changeme`, `<...>`). Não há allowlist global de
caminhos. Para um falso positivo pontual:
1. preferir corrigir o conteúdo (placeholder em vez de valor de verdade);
2. senão, comentário `gitleaks:allow` na linha, com o motivo ao lado; ou
3. a *fingerprint* em `/.gitleaksignore`, com comentário de motivo, dono e data.
Toda supressão passa por revisão no PR (aprovação dupla quando tocar workflows, pipeline §2).

**Hook local.** `npm run hooks:install` aponta o `core.hooksPath` do clone para
`003-project/tools/git-hooks/` (`npm run hooks:uninstall` desfaz). Precisa do gitleaks no PATH
(`winget install gitleaks`, `brew install gitleaks` ou o binário da
[release](https://github.com/gitleaks/gitleaks/releases)); `SKIP_GITLEAKS=1` pula uma vez. O guia
de desenvolvimento prevê Husky (lint-staged + commitlint); quando ele entrar, o `.husky/pre-commit`
chama o mesmo script e o instalador acima deixa de ser usado.

## 5. Autenticação do CI na nuvem (OIDC)

A action composta [`.github/actions/oidc-cloud-auth`](../../../.github/actions/oidc-cloud-auth/action.yml)
é a única forma de os workflows de deploy (BV-105 staging, BV-106 produção) se autenticarem na
nuvem. Ela valida a configuração (sem imprimir valores) e falha com mensagem clara enquanto o lado
da nuvem não estiver configurado. O workflow manual **"Verificar autenticação na nuvem"**
(`cloud-auth-check.yml`) prova a configuração sem fazer deploy.

Uso no job: `permissions: { contents: read, id-token: write }` + `environment: staging|production`
+ as variáveis abaixo expostas como `env` do job (`PLATFORM`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`,
`GCP_PROJECT_ID`; composite actions não leem `vars`, então cada input da action, se vazio, cai para
a env do job) + `uses: ./.github/actions/oidc-cloud-auth` (com `railway-token` se Railway).

### 5.1 Variáveis do repositório / environment (não são segredos)

| Variável (`vars.*`) | Exemplo | Onde definir |
| :--- | :--- | :--- |
| `DEPLOY_PLATFORM` (env `PLATFORM`) | `cloudrun` ou `railway` (vazia = deploy pendente, BV-106) | repositório |
| `GCP_WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/sales-bubble` | repositório |
| `GCP_DEPLOY_SA` | `deploy-staging@bolha-staging.iam.gserviceaccount.com` | **por environment** (staging/production) |
| `GCP_PROJECT_ID` | `bolha-staging` / `bolha-prod` | por environment |
| `CLOUD_RUN_REGION` | `southamerica-east1` | repositório |
| `GCP_ARTIFACT_REGISTRY` | `southamerica-east1-docker.pkg.dev` | repositório |

### 5.2 GCP (Cloud Run) — Workload Identity Federation

Lado da nuvem (**HITL** — feito por quem administra o GCP, uma vez por projeto/ambiente):

```bash
PROJECT_ID=bolha-staging            # repetir para bolha-prod
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
REPO=AlessonEvangelista/sales-bubble
ENVIRONMENT=staging                 # production no projeto de produção

gcloud iam workload-identity-pools create github --project "$PROJECT_ID" \
  --location global --display-name "GitHub Actions"

# Só tokens deste repositório são aceitos (attribute-condition); o sub inclui o environment.
gcloud iam workload-identity-pools providers create-oidc sales-bubble --project "$PROJECT_ID" \
  --location global --workload-identity-pool github \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository == '$REPO'"

gcloud iam service-accounts create "deploy-$ENVIRONMENT" --project "$PROJECT_ID"
SA="deploy-$ENVIRONMENT@$PROJECT_ID.iam.gserviceaccount.com"

# Só jobs do GitHub Environment certo personificam a conta (staging não vira produção).
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/subject/repo:$REPO:environment:$ENVIRONMENT"

# Permissão mínima de deploy (pipeline §4): publicar imagem, criar revisão, rodar job de migration.
for ROLE in roles/run.developer roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA" --role "$ROLE"
done
# + roles/iam.serviceAccountUser APENAS nas contas de runtime da api/worker (actAs), não no projeto.
```

Contas de **runtime** (separadas da de deploy): `api@…` e `worker@…`, cada uma com
`roles/secretmanager.secretAccessor` **só nos segredos do inventário que usa** (§2) e
`roles/cloudkms.cryptoKeyEncrypterDecrypter` na chave de PII. A conta de deploy não lê segredos.

Entrega dos segredos ao processo (duas opções, ambas suportadas pelo loader):
- **Recomendada:** `gcloud run deploy … --set-secrets DATABASE_URL=DATABASE_URL:latest,…` — o
  Cloud Run injeta como variável; a app usa `SECRETS_PROVIDER=env` (sem código de nuvem).
- **Alternativa:** `SECRETS_PROVIDER=gcp-secret-manager` + `SECRETS_GCP_PROJECT` (+ opcional
  `SECRETS_GCP_PREFIX`): o processo lê cada segredo do Secret Manager no arranque, com o token da
  própria identidade de serviço (metadata server). Adapter em `apps/{api,worker}/src/config/secrets.ts`
  — **esqueleto**: testado com respostas simuladas, ainda não validado contra projeto real.

### 5.3 Railway — equivalente

O Railway **não oferece federação OIDC** para o GitHub Actions. O equivalente:
- um **project token** por environment do Railway (staging, production), criado no painel do
  projeto → *Settings → Tokens*, escopado a um único environment;
- guardado como segredo `RAILWAY_TOKEN` no **GitHub Environment** correspondente (não no
  repositório), de modo que só jobs com `environment: production` — e, portanto, com aprovação dos
  revisores — o recebem;
- rotação a cada 90 dias e revogação imediata em incidente (§3); é a **única exceção** à regra
  "sem segredo de longa duração", aceita enquanto o Railway não suportar OIDC;
- segredos de aplicação ficam nas variáveis **seladas** do serviço no Railway (injetadas como env;
  a app usa `SECRETS_PROVIDER=env`).

A mesma action atende: `PLATFORM=railway` + `railway-token: ${{ secrets.RAILWAY_TOKEN }}` exporta
`RAILWAY_TOKEN` (mascarado) para os passos seguintes do job, onde a CLI do Railway o lê.

## 6. Loader de segredos na api e no worker

Arranque de cada processo (`main.ts`): `loadDotEnv()` (só se houver `.env`, i.e. dev) →
`resolveSecrets(<SECRET_NAMES>)` → validação Zod do `env.ts` (não sobe se faltar obrigatório).

| `SECRETS_PROVIDER` | Uso | Comportamento |
| :--- | :--- | :--- |
| `env` (padrão) | local, ci, Railway, Cloud Run com `--set-secrets` | lê do ambiente; nenhuma chamada externa |
| `gcp-secret-manager` | Cloud Run lendo em tempo de arranque | busca `projects/<SECRETS_GCP_PROJECT>/secrets/<PREFIX><NOME>/versions/latest`; o valor remoto prevalece; segredo inexistente fica para o schema decidir; em staging/produção avisa (só nomes) se o mesmo segredo também estiver como variável comum |

A porta é `SecretStore` (`get(name)`); um adapter novo (ex.: AWS, Vault) é uma classe nova e um
valor novo em `SECRETS_PROVIDER`. O arquivo é idêntico na api e no worker (apps não importam umas
às outras); `npm run test:secrets` falha se divergirem.

## 7. Pendências (HITL)

1. **Escolha da plataforma** (DEC-12 / BV-104): define `DEPLOY_PLATFORM` e qual de §5.2/§5.3 aplicar.
2. **Configuração do lado da nuvem** (§5.2 ou §5.3) e preenchimento das variáveis de §5.1
   (repositório e environments `staging`/`production`, este com revisores obrigatórios).
3. Rodar o workflow **"Verificar autenticação na nuvem"** para cada environment.
4. Criar os segredos de staging/produção no secret manager conforme o inventário (§2).
5. Ativar *Secret scanning* + *Push protection* do GitHub no repositório (Settings → Code security),
   complementar ao gitleaks.

## Fontes consultadas (AlterEgo)

- **seguranca-informacao** — OWASP *Secrets Management Cheat Sheet* (Jim Manico): §3.2.3 (o
  consumidor busca o segredo, o CI não o toca — base do §1.3 e do loader), §8.3–8.4 (documentar
  quem acessa, como rotaciona, dependências e contato — estrutura do §2/§3), §9.2 (revogar →
  rotacionar → remover → registrar — §3).
- **seguranca-informacao** — Notas de estudo, Fase 09 (Cripto prática) §4: rotação de chaves de API
  em 90 dias e detecção de segredos por hook de pre-commit com gitleaks (§3, §4).
- **devops-sre-cloud** — documentação de Secrets do Kubernetes e guias de Secrets Manager: acesso
  de menor privilégio por workload e segredo por serviço (contas de runtime separadas, §5.2).
- **asias-supply-chain-security** — OWASP *Software Supply Chain Security* / *NPM Security* CS:
  restringir, escopar e rotacionar tokens de CI e fixar dependências do pipeline (actions fixadas
  por SHA na `oidc-cloud-auth`; gitleaks fixado por versão + checksum no CI).
