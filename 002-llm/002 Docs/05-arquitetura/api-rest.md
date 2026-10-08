# Contrato da API REST — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · [Plano de Projeto v2](../planing-project.md)

> Contrato HTTP entre `apps/web` (Next.js) e `apps/api` (NestJS). Os tipos de request/response serão gerados a partir dele em `packages/contracts` (OpenAPI 3.1 + Zod). Eventos em tempo real estão em [api-websocket.md](api-websocket.md). Em conflito com a [Spec](../../SPEC.md), **a Spec prevalece**.
> Decisões assumidas (status **Proposto**, aguardam Gate A): ADR-0002 (concorrência da cota), ADR-0003 (Pagar.me v5 atrás de `PaymentPort`), ADR-0004 (degraus de preço), ADR-0005 (lance C2B), ADR-0006 (teto PJ), ADR-0007 (score), ADR-0008 (CNPJ), ADR-0009 (máquina de estados), ADR-0012 (PII).

---

## 1. Convenções gerais

### 1.1 Base, formato e versionamento

| Item | Regra |
| :--- | :--- |
| Base URL | `https://api.bolhavenda.com.br/api/v1` (staging: `https://api.staging.bolhavenda.com.br/api/v1`) |
| Formato | JSON UTF-8 (`Content-Type: application/json`). Erros: `application/problem+json` (RFC 9457) |
| Nomes de campos | `snake_case`, iguais às colunas canônicas (`filled_quotas`, `max_pj_share`, `expires_at`…) |
| IDs | UUID v7 (string) |
| Datas | ISO 8601 em UTC com `Z` (`2026-11-23T18:00:00Z`). A UI converte para `America/Sao_Paulo` |
| Dinheiro | Inteiro em **centavos** (`129900` = R$ 1.299,00) + `currency: "BRL"` no objeto que contém valores |
| Versionamento | Versão maior no path (`/api/v1`). Mudanças **aditivas** (novo campo, endpoint ou código de erro) não mudam a versão — o cliente ignora campos desconhecidos (*tolerant reader*). Remoção, renomeação ou mudança de semântica → `/api/v2`, mantendo `v1` por ≥ 90 dias com cabeçalhos `Deprecation` e `Sunset` |
| Rastreamento | Toda resposta inclui `X-Request-Id` e `traceparent` (W3C/OpenTelemetry). O `trace_id` também aparece no corpo de erro |
| Concorrência otimista | Recursos editáveis (bolha, perfil) retornam `ETag: "v{version}"`; `PATCH` exige `If-Match`. Divergência → `412 VERSION_CONFLICT` |
| Compressão | `gzip`/`br` |

### 1.2 Autenticação e autorização

- **Access token:** JWT (RS256), validade **15 min**, em `Authorization: Bearer <token>`. Claims: `sub` (account_id), `typ` (`PF`|`PJ`), `roles` (`user`, `moderator`, `admin`), `verification` (`VERIFIED`|`PENDING_VERIFICATION`|`IRREGULAR`, só PJ), `sv` (session version — invalidação em massa).
- **Refresh token:** opaco, rotativo, validade **30 dias**, em cookie `__Host-bv_rt` (`HttpOnly; Secure; SameSite=Strict; Path=/`). Cada uso emite um novo e invalida o anterior; reuso de token já rotacionado revoga a família inteira (`401 REFRESH_TOKEN_REUSED`) e gera auditoria. O logout revoga o refresh.
- **CSRF:** como o refresh usa cookie, `POST /auth/refresh` e `POST /auth/logout` exigem `X-CSRF-Token` (double-submit; cookie `bv_csrf` não-HttpOnly). As demais rotas usam Bearer e não dependem de cookie.
- **OAuth2 (Google):** Authorization Code + PKCE (`GET /auth/oauth/google` → callback). Conta nova via Google fica `INCOMPLETE` até informar CPF (e CNPJ, se PJ).

**Escopos usados nas tabelas**

| Escopo | Significado |
| :--- | :--- |
| `público` | sem token (rate limit por IP) — visitante pode navegar e ver detalhes públicos (Spec §2) |
| `autenticado` | qualquer conta `ACTIVE` |
| `PF` / `PJ` | tipo de conta exigido |
| `PJ verificada` | PJ com CNPJ `ATIVA` validado nos últimos 30 dias (ADR-0008). `PENDING_VERIFICATION` ou `IRREGULAR` → `403 ACCOUNT_NOT_VERIFIED` em ações novas (criar bolha, entrar em cota, dar lance); bolhas e triagens em andamento continuam |
| `PF recebedora` | PF com cadastro de recebedor aprovado no gateway — exigido para publicar bolha de **venda** C2C (Spec §2, nota 1) |
| `criador` | `creator_id` da bolha = `sub` |
| `participante` | possui cota `ACTIVE` ou `RESERVED` na bolha |
| `parte da triagem` | vendedor ou comprador do item de triagem |
| `moderator` / `admin` | papéis internos (MFA obrigatório) |

Contas `SUSPENDED` recebem `403 ACCOUNT_SUSPENDED` em qualquer rota de escrita.

### 1.3 Idempotência (`Idempotency-Key`)

- **Obrigatório** (sem ele → `400 IDEMPOTENCY_KEY_MISSING`): `POST /bubbles/{id}/quotas`, `POST /bubbles/{id}/publish` de bolha de compra (envolve pagamento da cota do criador), `POST /bubbles/{id}/bids`, `POST /bubbles/{id}/bids/{bidId}/select`, `POST /triage/items/{id}/cancellation`, `POST /triage/items/{id}/withdrawal`, `POST /triage/items/{id}/return-confirmation`, todas as ações `/admin/*` que movimentam dinheiro (suspender bolha, decidir caso de triagem).
- **Recomendado** (aceito e respeitado): `POST /bubbles`, `POST /bubbles/{id}/publish` (venda), `POST /triage/items/{id}/shipment`, `POST /triage/items/{id}/cases`, `POST /score-events/{id}/disputes`, `POST /bubbles/{id}/reports`.
- Formato: UUID gerado pelo cliente **por intenção do usuário** (um clique em "Confirmar" = uma chave; retentativas reutilizam a mesma).
- Escopo: `(account_id, método, rota, chave)`; armazenada por **24 h** com hash SHA-256 do corpo e a resposta final.

| Situação | Resposta |
| :--- | :--- |
| Primeira chamada | Processa normalmente |
| Mesma chave + mesmo corpo, concluída | Devolve a **mesma** resposta com `Idempotent-Replayed: true` |
| Mesma chave + mesmo corpo, em processamento | `409 IDEMPOTENCY_IN_PROGRESS` + `Retry-After: 1` |
| Mesma chave + corpo diferente | `422 IDEMPOTENCY_KEY_REUSED` |

Erros `5xx` **não** são memorizados (pode repetir com a mesma chave); erros de negócio `4xx` **são**. Assim, "PF abre duas abas e confirma nas duas" resulta em 1 cota: a segunda aba recebe `PF_QUOTA_LIMIT` ou, se reutilizar a chave, a mesma resposta (Spec §6).

### 1.4 Erros — RFC 9457 (`application/problem+json`)

```json
{
  "type": "https://api.bolhavenda.com.br/problems/quota-sold-out",
  "title": "Cotas esgotadas",
  "status": 409,
  "detail": "As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.",
  "instance": "/api/v1/bubbles/0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44/quotas",
  "code": "QUOTA_SOLD_OUT",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "bubble_id": "0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44",
  "available_quotas": 0
}
```

- `code` é o contrato estável que o front usa para escolher a microcopy ([especificacao-telas.md §3](../04-design/especificacao-telas.md)); `detail` traz a mensagem da Spec quando ela existe, mas o front não depende dele.
- Validação: `422 VALIDATION_FAILED` com `errors: [{ "field": "price_tiers[2].unit_price", "code": "NOT_NON_INCREASING", "message": "…" }]`.
- Nenhum erro inclui PII (CPF, CNPJ, e-mail) nem stack trace (ADR-0012). Bug → `500 INTERNAL_ERROR` genérico; detalhe só no log/trace.
- Toda recusa **depois** de uma autorização de pagamento cancela a pré-autorização (ou estorna o Pix) automaticamente (Spec F5).

#### 1.4.1 Catálogo de códigos de erro

Os códigos e mensagens marcados com **(Spec F5/F8)** são normativos — usar exatamente estes textos.

**Genéricos e de plataforma**

| `code` | HTTP | Quando |
| :--- | :--- | :--- |
| `VALIDATION_FAILED` | 422 | Corpo/query inválido (ver `errors[]`) |
| `UNAUTHENTICATED` | 401 | Sem token ou token inválido |
| `TOKEN_EXPIRED` | 401 | Access token expirado → cliente chama `/auth/refresh` |
| `REFRESH_TOKEN_REUSED` | 401 | Reuso de refresh rotacionado (família revogada) |
| `FORBIDDEN` | 403 | Escopo/papel insuficiente |
| `ACCOUNT_SUSPENDED` | 403 | Conta suspensa por moderação |
| `ACCOUNT_INCOMPLETE` | 403 | Conta OAuth sem documento |
| `NOT_FOUND` | 404 | Recurso inexistente ou invisível ao solicitante |
| `VERSION_CONFLICT` | 412 | `If-Match` divergente |
| `IDEMPOTENCY_KEY_MISSING` | 400 | Rota exige `Idempotency-Key` |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Mesma chave, corpo diferente |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | Requisição original em processamento |
| `RATE_LIMITED` | 429 | Limite excedido (`Retry-After`) |
| `CAPTCHA_REQUIRED` | 428 | Anti-bot adaptativo (R8): reenviar com `X-Captcha-Token` |
| `SERVICE_UNAVAILABLE` | 503 | Manutenção/dependência fora |
| `INTERNAL_ERROR` | 500 | Erro não previsto |

**Identidade e LGPD (F1)**

| `code` | HTTP | Quando · mensagem |
| :--- | :--- | :--- |
| `INVALID_CREDENTIALS` | 401 | E-mail/senha incorretos (não revela qual) |
| — | 202 | **Não há erro de "já cadastrado"** no cadastro: e-mail ou documento existente recebem a mesma resposta genérica (anti-enumeração, §2.1) |
| `DOCUMENT_ALREADY_REGISTERED` | 409 | Somente em `PATCH /me` de conta autenticada `INCOMPLETE` (OAuth), onde a enumeração exige sessão e é limitada por rate limit |
| `CPF_INVALID` / `CNPJ_INVALID` | 422 | Dígito verificador inválido |
| `CNPJ_NOT_ACTIVE` | 422 | Situação inativa, suspensa ou baixada · "CNPJ com situação cadastral irregular" (Spec F1) |
| `CNPJ_PROVIDER_UNAVAILABLE` | 202* | *Não é erro: cadastro concluído como `PENDING_VERIFICATION`, nova tentativa a cada 15 min por 24 h |
| `ACCOUNT_NOT_VERIFIED` | 403 | PJ não verificada tenta ação nova · "Conclua a verificação do CNPJ para participar." **(Spec F5)** |
| `RECIPIENT_NOT_REGISTERED` | 403 | PF publica bolha de venda sem recebedor aprovado no gateway |
| `CONSENT_REQUIRED` | 422 | Termos/política vigentes não aceitos |
| `NICKNAME_UNAVAILABLE` | 409 | Apelido do pseudônimo já usado ou vetado |
| `EXPORT_ALREADY_IN_PROGRESS` | 409 | Já existe exportação pendente |
| `DELETION_BLOCKED_OBLIGATIONS` | 409 | Exclusão com cota ativa ou triagem aberta (lista `blocking_items[]`) |

**Bolha (F3, F4)**

| `code` | HTTP | Quando |
| :--- | :--- | :--- |
| `BUBBLE_NOT_FOUND` | 404 | Inexistente (ou `DRAFT` de outra conta) |
| `BUBBLE_NOT_DRAFT` | 409 | Publicar bolha que não está em `DRAFT` |
| `FIELD_LOCKED_AFTER_PUBLISH` | 409 | Tentativa de alterar preço, cotas ou prazo após publicar (oferta vinculante — CDC art. 30) |
| `BUBBLE_NOT_ACTIVE` | 409 | Cota/lance/saída em bolha não `ACTIVE` · "Esta bolha já foi encerrada." **(Spec F5)** |
| `BUBBLE_EXIT_LOCKED` | 409 | Saída de cota na última hora (`is_expiring = true`) · "Saídas são bloqueadas na última hora para proteger o grupo" **(Spec F5)** |
| `BUBBLE_HAS_QUOTAS` | 409 | Criador cancela bolha `ACTIVE` com `filled_quotas > 0` |
| `INVALID_PRICE_TIERS` | 422 | 1–10 degraus; 1º em 0 cotas; limites estritamente crescentes; preços não crescentes; preço ≥ R$ 1,00 (100 centavos); limite ≤ `max_quotas` |
| `INVALID_DURATION` | 422 | Duração < 1 h ou > 5 dias |
| `INVALID_QUOTA_RANGE` | 422 | `max_quotas` fora de 2–10.000 ou `min_quotas` fora de 1–`max_quotas` |
| `INVALID_PJ_SHARE` | 422 | `max_pj_share` fora de 10%–100% |
| `INVALID_SHIPPING_DAYS` | 422 | `shipping_days` fora de 1–30 |
| `WRONG_BUBBLE_TYPE` | 409 | Lance em bolha `SALE`, degraus em bolha `PURCHASE` etc. |

**Cota e pagamento (F5)**

| `code` | HTTP | Mensagem ao usuário |
| :--- | :--- | :--- |
| `QUOTA_SOLD_OUT` | 409 | "As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado." **(Spec F5)**. Quando as vagas restantes estão só reservadas (`pending_reservations > 0` no corpo): "Cotas esgotadas — N reservas aguardando pagamento" **(Spec F5)** |
| `PIX_UNAVAILABLE_LATE` | 422 | Pix pedido com menos de 5 min para o fim da bolha · "Faltam menos de 5 minutos: use cartão para entrar." |
| `PIX_TEMPORARILY_BLOCKED` | 429 | Conta com 3 reservas Pix expiradas em 24 h, ou já com 3 reservas abertas · "Pix temporariamente indisponível para sua conta. Use cartão ou tente mais tarde." (corpo traz `retry_after`) |
| `CREATOR_QUOTA_NOT_AUTHORIZED` | 402 | Cartão da cota automática do criador (bolha de compra) recusado; bolha continua `DRAFT` · "Não foi possível autorizar sua cota. A bolha não foi publicada." **(Spec F4)** |
| `PF_QUOTA_LIMIT` | 409 | "Você já participa desta bolha (limite de 1 cota por pessoa)." **(Spec F5)** |
| `PJ_SHARE_EXCEEDED` | 409 | "Sua empresa pode ocupar no máximo N cotas nesta bolha." **(Spec F5)** — corpo traz `max_allowed`, `already_held` |
| `CREATOR_CANNOT_JOIN` | 409 | "Você não pode participar da própria bolha." **(Spec F5)** — também para lance na própria bolha |
| `PAYMENT_DECLINED` | 402 | "O pagamento não foi autorizado. Tente outra forma de pagamento." **(Spec F5)** |
| `QUOTA_EXCEEDS_AVAILABLE` | 409 | PJ pede N > cotas disponíveis (corpo traz `available_quotas`) |
| `QUOTA_NOT_FOUND` | 404 | Saída sem cota ativa |
| `PAYMENT_METHOD_UNSUPPORTED` | 422 | Método não aceito |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | Gateway fora; nada é reservado (falha rápida) |
| `PIX_RESERVATION_EXPIRED` | 409 | Pix não pago no prazo `min(15 min, tempo restante)`; reserva liberada sem penalidade (status em `GET /payments/{id}`) |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Assinatura do webhook inválida |

**Lances (F8 — ADR-0005)**

| `code` | HTTP | Quando · mensagem |
| :--- | :--- | :--- |
| `BID_ABOVE_TARGET` | 422 | "O lance precisa ser igual ou menor que o preço-alvo de R$ X" **(Spec F8)** |
| `BID_NOT_FOUND` | 404 | Lance inexistente |
| `BID_WITHDRAW_NOT_ALLOWED` | 409 | Retirada/substituição após a explosão |
| `BID_SELECTION_NOT_OPEN` | 409 | Seleção fora de `EXPIRED_SUCCESS` |
| `BID_SELECTION_WINDOW_CLOSED` | 409 | Passaram as 24 h; seleção automática já aplicada |

**Triagem, score e moderação (F9, F10, F12)**

| `code` | HTTP | Quando |
| :--- | :--- | :--- |
| `TRIAGE_INVALID_TRANSITION` | 409 | Ação incompatível com o status do item |
| `SHIPPING_DEADLINE_PASSED` | 409 | Envio após `shipping_deadline` (item já cancelado) |
| `WITHDRAWAL_WINDOW_CLOSED` | 409 | Arrependimento após 7 dias do recebimento |
| `TRIAGE_CASE_ALREADY_OPEN` | 409 | Já existe caso aberto para o item |
| `TRIAGE_CASE_WINDOW_CLOSED` | 409 | Caso fora de `SHIPPED`/`DELIVERED` ou após o fim da janela de arrependimento |
| `TRIAGE_NOT_LATE` | 409 | Comprador tenta cancelar item que não está atrasado |
| `DISPUTE_WINDOW_CLOSED` | 409 | Contestação após 5 dias do evento |
| `DISPUTE_ALREADY_OPEN` | 409 | Já existe contestação para o evento |
| `SCORE_EVENT_NOT_DISPUTABLE` | 409 | Evento positivo ou de outra conta |
| `REPORT_ALREADY_SUBMITTED` | 409 | Mesma conta já denunciou a bolha |

### 1.5 Paginação por cursor

- Query: `?limit=20&cursor=<opaco>` (`limit` padrão 20, máx. 100).
- Ordenação estável por chave composta (ex.: `created_at DESC, id DESC`), codificada em base64url no cursor junto com os filtros — trocar filtro com cursor antigo → `422 VALIDATION_FAILED`.

```json
{
  "data": [ { "…": "…" } ],
  "page": { "next_cursor": "eyJjIjoiMjAyNi0xMS0yM1QxODowMDowMFoiLCJpIjoiMDE5MiJ9", "has_more": true, "limit": 20 }
}
```

- A busca por viewport (`GET /bubbles?bbox=…`) **não** é paginada: devolve no máximo 500 bolhas (RNF01), priorizando as maiores/mais próximas do centro, e sinaliza `truncated: true`.

### 1.6 Rate limits

*Sliding window* em Redis, por conta (autenticado) ou IP (público). Cabeçalhos: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; no `429`, `Retry-After` (s). Valores iniciais, a recalibrar no teste de carga (S7).

| Grupo de rotas | Limite | Chave | Observação |
| :--- | :--- | :--- | :--- |
| `POST /auth/login` | 5/min e 20/h | IP + hash do e-mail | Após 3 falhas → `CAPTCHA_REQUIRED` |
| `POST /auth/register` | 3/h | IP | CAPTCHA sempre |
| `POST /auth/refresh` | 30/h | família do token | |
| `GET /bubbles` (viewport/lista) | 120/min | conta ou IP | Pan/zoom com *debounce* ≥ 250 ms no cliente |
| `GET /bubbles/{id}` | 300/min | conta ou IP | |
| `POST /bubbles/{id}/quotas` | 10/min e 60/h; 3/min por bolha | conta | Anti-bot (R8). Pix: máx. 3 reservas abertas por conta; 3 reservas expiradas em 24 h → `PIX_TEMPORARILY_BLOCKED` |
| `DELETE /bubbles/{id}/quotas/me` | 10/h | conta | Evita "entra-e-sai" para manipular preço/flag |
| `POST /bubbles`, `/publish` | 20/dia | conta | |
| `POST`/`PUT` lances | 30/h | conta | |
| `POST /bubbles/{id}/reports` | 10/dia | conta | |
| `POST /score-events/{id}/disputes` | 10/dia | conta | |
| `POST /me/data-exports` | 2/dia | conta | |
| `POST /webhooks/payments/pagarme` | 600/min | IP do gateway (allowlist) | |
| `/admin/*` | 600/min | conta | Papel + MFA |
| Demais rotas autenticadas | 300/min | conta | |

### 1.7 Representações comuns

**`BubbleSummary`** (canvas, listas):

```json
{
  "id": "0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44",
  "type": "SALE",
  "title": "Fone Bluetooth XT-500",
  "category": { "id": "eletronicos", "name": "Eletrônicos" },
  "image_url": "https://cdn.bolhavenda.com.br/b/0192f1c2/thumb.webp",
  "status": "ACTIVE",
  "creator": { "pseudonym": "TecnoLotes#9C1D", "account_type": "PJ", "score_band": "BOM" },
  "currency": "BRL",
  "initial_price": 10000,
  "target_price": 7500,
  "current_price": 9000,
  "next_tier": { "min_filled_quotas": 70, "unit_price": 8000, "quotas_to_go": 5 },
  "min_quotas": 40,
  "max_quotas": 100,
  "filled_quotas": 65,
  "reserved_quotas": 2,
  "available_quotas": 33,
  "is_near_full": false,
  "is_expiring": false,
  "starts_at": "2026-11-23T12:00:00Z",
  "expires_at": "2026-11-26T12:00:00Z",
  "exploded_at": null,
  "canvas_x": 10240,
  "canvas_y": -3584,
  "radius": 96,
  "version": 141
}
```

- `current_price` = `unit_price` do maior degrau cujo `min_filled_quotas ≤ filled_quotas` (Spec F6). Reservas Pix pendentes (`reserved_quotas`) **não** contam para preço nem para meta — só ocupam capacidade (`available_quotas = max_quotas − filled_quotas − reserved_quotas`).
- Em bolha `PURCHASE`: `initial_price`/`next_tier` são `null`, `target_price` é o preço máximo por cota e `current_price` é o menor lance ativo (ou `null`).
- `is_near_full` (≥ 80% de `max_quotas`) e `is_expiring` (últimos 60 min) são **flags derivadas**, nunca `status` (ADR-0009).
- `radius` é proporcional a `max_quotas` em escala logarítmica, com mínimo e máximo (Spec F2) — calculado no servidor para o cliente e o posicionamento usarem o mesmo valor.
- `version` é monotônico por bolha e o mesmo dos eventos WebSocket.

**`BubbleDetail`** = `BubbleSummary` + `description`, `images[]` (até 5), `price_tiers[]`, `max_pj_share`, `shipping_days`, `outcome` (`SUCCESS`|`FAILED`|`null`), `explosion_reason` (`TIME`|`FULL`|`null`), `final_price`, `selected_bid_id`, `winner` (razão social revelada **após** a seleção), `bids_count`, `bid_selection_deadline`, `my_participation` (autenticado) e `allowed_actions[]` — o front habilita botões a partir daqui, sem recalcular regra:

```json
"my_participation": { "quota_count": 1, "quota_id": "0192f…", "quota_status": "ACTIVE", "reserved_amount": 10000, "payment_status": "AUTHORIZED" },
"allowed_actions": ["LEAVE_QUOTA", "REPORT"]
```

Valores de `allowed_actions`: `JOIN_QUOTA`, `LEAVE_QUOTA`, `SUBMIT_BID` (quando já há lance ativo, a UI rotula "Substituir meu lance"), `WITHDRAW_BID`, `SELECT_BID`, `PUBLISH`, `EDIT`, `EDIT_CONTENT` (só descrição/imagens), `CANCEL`, `REPORT`. Quando a saída está bloqueada na última hora, `LEAVE_QUOTA` não aparece e `blocked_actions: [{ "action": "LEAVE_QUOTA", "code": "BUBBLE_EXIT_LOCKED" }]` permite à UI mostrar o botão desabilitado com a explicação.

---

## 2. Identidade (`identity` — F1)

### 2.1 `POST /auth/register` — cadastro PF ou PJ
- **Auth:** público · **Rate:** 3/h por IP + CAPTCHA

Request (PF):
```json
{
  "account_type": "PF",
  "name": "Carlos Silva",
  "email": "carlos@example.com",
  "password": "••••••••••••",
  "cpf": "123.456.789-09",
  "accepted_terms_version": "2026-10-01",
  "accepted_privacy_version": "2026-10-01",
  "marketing_opt_in": false,
  "captcha_token": "…"
}
```

Request (PJ): os mesmos dados da **PF responsável** + `"cnpj": "12.345.678/0001-95"`.

Response **`202`** — sempre a mesma, exista ou não conta com aquele e-mail/documento (anti-enumeração):
```json
{ "status": "PENDING_EMAIL_CONFIRMATION", "message": "Se os dados forem válidos, enviaremos a confirmação por e-mail." }
```
- Dados novos → conta criada em `PENDING_EMAIL_CONFIRMATION` e e-mail com link de confirmação (24 h).
- E-mail ou documento já cadastrado → nenhuma conta criada; o titular do e-mail recebe "Você já tem uma conta — entre ou recupere a senha". O tempo de resposta é equalizado nos dois caminhos.
- Erros de **formato** (dígito verificador, senha fraca, termos não aceitos) continuam síncronos (`422`), pois não revelam a existência de contas. A consulta de CNPJ (situação cadastral) também é síncrona: é dado público da Receita, não da plataforma.

### 2.1.1 `POST /auth/email/confirm` — confirmar e-mail e entrar
- **Auth:** público · `{ "token": "…" }` → `201`:
```json
{
  "account": {
    "id": "0192f0aa-…",
    "account_type": "PJ",
    "pseudonym": "TecnoLotes#9C1D",
    "status": "ACTIVE",
    "company": { "verification_status": "VERIFIED", "legal_name": "TECNOLOTES LTDA", "cnae": "4651-6/01", "verified_at": "2026-10-06T15:00:00Z", "next_revalidation_at": "2026-11-05T15:00:00Z" }
  },
  "access_token": "eyJ…",
  "expires_in": 900
}
```
+ `Set-Cookie: __Host-bv_rt=…`.
- Provedores de CNPJ indisponíveis no cadastro → a conta confirma normalmente com `verification_status: "PENDING_VERIFICATION"` e `next_attempt_at` (+15 min; tentativas por 24 h). Navega, mas ações novas retornam `ACCOUNT_NOT_VERIFIED`. O resultado chega por notificação.
- Erros: `TOKEN_EXPIRED` (link vencido → `POST /auth/email/resend`, sempre `202`).

Erros de `POST /auth/register`: `VALIDATION_FAILED`, `CPF_INVALID`, `CNPJ_INVALID`, `CNPJ_NOT_ACTIVE`, `CONSENT_REQUIRED`, `CAPTCHA_REQUIRED`, `RATE_LIMITED`.

> O pseudônimo é gerado pelo servidor (`Bolhista#4F2A`). O usuário pode trocar o apelido; o sufixo `#XXXX` é fixo (§2.8). Nome, CPF/CNPJ e e-mail nunca aparecem em rotas públicas.

### 2.2 `POST /auth/login`
- **Auth:** público · Request: `{ "email": "…", "password": "…", "captcha_token": null }`
- Response `200`: `{ "access_token": "eyJ…", "expires_in": 900, "account": { "id": "…", "account_type": "PF", "pseudonym": "Bolhista#4F2A" } }` + cookie de refresh.
- Erros: `INVALID_CREDENTIALS`, `CAPTCHA_REQUIRED`, `ACCOUNT_SUSPENDED`, `RATE_LIMITED`.

### 2.3 `POST /auth/refresh`
- **Auth:** cookie de refresh + `X-CSRF-Token` · corpo vazio → `200` com novo `access_token` + novo cookie (rotação). Erros: `UNAUTHENTICATED`, `REFRESH_TOKEN_REUSED`.

### 2.4 `POST /auth/logout`
- Cookie + CSRF. Revoga a família do refresh token → `204`.

### 2.5 `GET /auth/oauth/google` e `GET /auth/oauth/google/callback`
- Redireciona ao Google (PKCE). Conta nova → `status: "INCOMPLETE"`; o front leva ao passo de documento (`PATCH /me`).

### 2.6 `POST /auth/password/forgot` e `POST /auth/password/reset`
- `forgot`: `{ "email": "…" }` → sempre `202`. `reset`: `{ "token": "…", "password": "…" }` → `204`; revoga todas as sessões.

### 2.7 `GET /me`
- **Auth:** autenticado
```json
{
  "id": "0192f0aa-…",
  "account_type": "PF",
  "pseudonym": "Bolhista#4F2A",
  "name": "Carlos Silva",
  "email": "c•••••@example.com",
  "document_masked": "***.456.789-**",
  "status": "ACTIVE",
  "roles": ["user"],
  "score": { "value": 512, "band": "REGULAR", "model_version": "score-v1" },
  "company": null,
  "payout_recipient": { "status": "NOT_REGISTERED" },
  "consents": { "terms": "2026-10-01", "privacy": "2026-10-01", "marketing": false },
  "preferences": { "reduce_motion": false }
}
```

### 2.8 `PATCH /me`
- **Auth:** autenticado · `If-Match` · Campos: `name`, `phone`, `shipping_address`, `nickname` (parte antes do `#`), `preferences.reduce_motion`, `cpf`/`cnpj` (apenas se `INCOMPLETE`).
- Erros: `VALIDATION_FAILED`, `VERSION_CONFLICT`, `NICKNAME_UNAVAILABLE`, `CPF_INVALID`, `CNPJ_INVALID`, `CNPJ_NOT_ACTIVE`, `DOCUMENT_ALREADY_REGISTERED`.

### 2.9 `POST /me/company/verification` — revalidar CNPJ agora
- **Auth:** PJ · **Rate:** 5/dia → `202 { "verification_status": "PENDING_VERIFICATION", "check_id": "…" }`; resultado em `GET /me` e por notificação. A revalidação automática roda a cada 30 dias.

### 2.10 `POST /me/payout-recipient` — cadastro de recebedor (vendedor)
- **Auth:** autenticado (obrigatório para PF vender em C2C; PJ também o usa para receber repasses)
- `{ "bank_account": { "bank": "341", "branch": "0001", "account": "12345-6", "type": "CHECKING" }, "holder_document": "…" }` → `202 { "status": "PENDING_REVIEW" }`; aprovado pelo gateway → `APPROVED` (notificação).
- `GET /me/payout-recipient` → status atual.

### 2.11 Consentimentos — `GET /me/consents`, `POST /me/consents`
- `GET`: histórico versionado `[{ "purpose": "terms", "version": "2026-10-01", "granted": true, "at": "…", "channel": "web" }]`.
- `POST`: `{ "purpose": "marketing", "granted": false }` → `201`. Revogar `terms`/`privacy` não é feito por aqui (equivale a encerrar conta → §2.13).

### 2.12 Exportar meus dados (LGPD art. 18)
- `POST /me/data-exports` · **Rate:** 2/dia → `202 { "id": "…", "status": "PROCESSING", "due_by": "<+15 dias>" }`. Prazo máximo de 15 dias (Spec F1); a meta operacional é horas.
- `GET /me/data-exports/{id}` → `{ "status": "READY", "download_url": "https://…", "expires_at": "…" }` (URL assinada, **JSON**).
- Erros: `EXPORT_ALREADY_IN_PROGRESS`.

### 2.13 Excluir conta
- `POST /me/deletion-request` · Corpo: `{ "reason": "opcional", "password": "…" }` → `202 { "status": "SCHEDULED", "effective_at": "<+7 dias>" }` (desistência via `DELETE /me/deletion-request`).
- Dados pessoais são **anonimizados**; registros fiscais e transacionais ficam retidos pelo prazo legal. O pseudônimo passa a "Conta removida".
- Erros: `DELETION_BLOCKED_OBLIGATIONS` com `blocking_items[]` (cotas ativas, triagens abertas).

---

## 3. Bolhas (`bubble` — F2, F3, F4)

### 3.1 `GET /categories`
- **Auth:** público → `[{ "id": "eletronicos", "name": "Eletrônicos", "prohibited": false }]`. Categorias proibidas seguem a lista dos Termos (Spec Q3).

### 3.2 `POST /bubbles` — criar rascunho
- **Auth:** autenticado (SALE: PJ verificada ou PF recebedora; PURCHASE: PF ou PJ verificada) · **Idempotência:** recomendada
- O front salva automaticamente o rascunho (Spec F3): cria na primeira alteração e depois usa `PATCH`.

Request (SALE com degraus — exemplo da Spec F6):
```json
{
  "type": "SALE",
  "title": "Fone Bluetooth XT-500",
  "description": "Novo, lacrado, garantia de 12 meses. NF emitida.",
  "category_id": "eletronicos",
  "image_upload_ids": ["0192f…", "0192f…"],
  "max_quotas": 100,
  "min_quotas": 40,
  "max_pj_share": 0.5,
  "price_tiers": [
    { "min_filled_quotas": 0,   "unit_price": 10000 },
    { "min_filled_quotas": 40,  "unit_price": 9000 },
    { "min_filled_quotas": 70,  "unit_price": 8000 },
    { "min_filled_quotas": 100, "unit_price": 7500 }
  ],
  "duration_minutes": 4320,
  "shipping_days": 7
}
```

| Campo | Regra (Spec F3) |
| :--- | :--- |
| `title` | 5–80 caracteres |
| `description` | até 2.000 caracteres |
| `category_id` | obrigatório |
| `image_upload_ids` | até 5 (SALE: ao menos 1) |
| `max_quotas` | 2–10.000 |
| `min_quotas` | 1–`max_quotas`; padrão 50% de `max_quotas` (arredondado para cima) |
| `max_pj_share` | 0,10–1,00; padrão 0,50 |
| `price_tiers` | 1–10 degraus; 1º em 0 cotas; limites estritamente crescentes; preços não crescentes; mínimo 100 centavos |
| `duration_minutes` | 60–7.200 (1 h–5 dias); `expires_at = starts_at + duração`, calculado na publicação |
| `shipping_days` | 1–30; padrão 7 |

- `initial_price` (1º degrau) e `target_price` (último degrau) são **derivados**.
- A posição no canvas é **definida pelo sistema** na publicação (espaço livre próximo ao cluster da categoria); o criador não escolhe.

Request (PURCHASE — F4):
```json
{
  "type": "PURCHASE",
  "title": "30 cadeiras ergonômicas",
  "description": "Encosto em tela, regulagem lombar, entrega em SP capital.",
  "category_id": "moveis",
  "image_upload_ids": [],
  "max_quotas": 30,
  "min_quotas": 10,
  "max_pj_share": 0.5,
  "target_price": 89000,
  "duration_minutes": 4320,
  "suggested_suppliers": [ { "cnpj": "98.765.432/0001-10" }, { "email": "vendas@fornecedor.com.br" } ]
}
```
- `price_tiers` é proibido em PURCHASE (`WRONG_BUBBLE_TYPE`). `suggested_suppliers`: até 5 CNPJs ou e-mails, convidados por e-mail **na publicação**.

Response `201`: `BubbleDetail` com `status: "DRAFT"` + `ETag: "v1"`. Rascunho só é visível ao criador.
Erros: `VALIDATION_FAILED`, `INVALID_PRICE_TIERS`, `INVALID_DURATION`, `INVALID_QUOTA_RANGE`, `INVALID_PJ_SHARE`, `INVALID_SHIPPING_DAYS`, `ACCOUNT_NOT_VERIFIED`, `RECIPIENT_NOT_REGISTERED`, `CONSENT_REQUIRED`, `RATE_LIMITED`.

### 3.3 `PATCH /bubbles/{id}` — editar
- **Auth:** criador · `If-Match` obrigatório
- `DRAFT`: todos os campos de 3.2.
- `ACTIVE`: **somente** `description` e `image_upload_ids`. Qualquer outro campo → `409 FIELD_LOCKED_AFTER_PUBLISH` (oferta vinculante).
- Erros: `FIELD_LOCKED_AFTER_PUBLISH`, `VERSION_CONFLICT`, validações de 3.2.

### 3.4 `POST /uploads/images`
- **Auth:** autenticado · `{ "content_type": "image/webp", "size_bytes": 482133, "purpose": "BUBBLE|EVIDENCE" }` → `201 { "upload_id", "upload_url", "expires_at" }` (PUT direto no storage; máx. 5 MB; jpeg/png/webp — e PDF para `EVIDENCE`; servidor gera thumbnails e remove EXIF).

### 3.5 `POST /bubbles/{id}/publish` — `DRAFT → ACTIVE`
- **Auth:** criador · **Idempotência:** recomendada (venda) / **obrigatória** (compra)
- Revalida todas as regras, define `starts_at = agora` e `expires_at = agora + duração`, calcula `canvas_x/y` e `radius`, agenda `bubble-expiring` (T−60 min) e `bubble-expire` (ADR-0011) e grava `BubblePublished` no outbox.
- **Bolha de compra:** o criador **ocupa automaticamente 1 cota** (Spec F4), paga **só com cartão** (sem reserva Pix): `{ "payment": { "method": "CARD", "card_token": "…" } }`, pré-autorizando o preço-alvo. A pré-autorização ocorre antes da publicação; se for recusada, nada é publicado e a bolha continua `DRAFT`.
- Response `200`: `BubbleDetail` com `status: "ACTIVE"`.
- Erros: `BUBBLE_NOT_DRAFT`, `INVALID_DURATION`, `ACCOUNT_NOT_VERIFIED`, `RECIPIENT_NOT_REGISTERED`, `CREATOR_QUOTA_NOT_AUTHORIZED`, `PAYMENT_METHOD_UNSUPPORTED` (Pix na cota do criador), `PAYMENT_PROVIDER_UNAVAILABLE`.

### 3.6 `POST /bubbles/{id}/cancel`
- **Auth:** criador · `{ "reason": "Estoque indisponível" }`
- `DRAFT → CANCELLED` (descarte) ou `ACTIVE → CANCELLED` **somente com `filled_quotas = 0`** (reservas Pix pendentes são liberadas).
- Erros: `BUBBLE_HAS_QUOTAS`, `BUBBLE_NOT_ACTIVE`.

### 3.7 `GET /bubbles` — canvas (viewport) e lista acessível
- **Auth:** público · **Rate:** 120/min

**Modo viewport** (canvas):
`GET /bubbles?bbox=minX,minY,maxX,maxY&zoom=0.8&type=SALE,PURCHASE&category=eletronicos&price_min=0&price_max=50000&participating=true`
```json
{
  "data": [ { "…BubbleSummary…": true } ],
  "bbox": [8192, -8192, 16384, 0],
  "zoom": 0.8,
  "lod": "MEDIUM",
  "truncated": false,
  "server_time": "2026-11-24T14:03:11Z",
  "tiles": ["tile:3:5:-3", "tile:3:6:-3"]
}
```
- `zoom` ∈ [0,1; 4] (Spec F2). O servidor ajusta a projeção pelo nível de detalhe (LOD):

| `lod` | Zoom | Campos devolvidos |
| :--- | :--- | :--- |
| `LOW` | < 0,4× | `id`, `type`, `status`, `canvas_x/y`, `radius`, `filled_quotas`, `reserved_quotas`, `max_quotas`, flags, `version` |
| `MEDIUM` | 0,4×–1× | + `title` (curto), `current_price`, `expires_at` |
| `HIGH` | > 1× | `BubbleSummary` completo (meta, `next_tier`, flags, `creator`) |

- `server_time` permite corrigir *clock skew* do contador. `tiles` são as rooms correspondentes (mesma função de tiling do WebSocket).
- `participating=true` (filtro "só as que participo") exige token.
- `status` padrão `ACTIVE`; o canvas também pede `recently_exploded=true` para incluir bolhas explodidas há < 24 h (exibidas esmaecidas).

**Modo lista** (alternância "Canvas | Lista" — mesma área visível):
`GET /bubbles?view=list&bbox=…&sort=expires_at|current_price|-progress&type=&category=&limit=20&cursor=…`
→ página por cursor de `BubbleSummary` (LOD `HIGH`). Sem `bbox`, vira busca global (`q=fone`).

Erros: `VALIDATION_FAILED` (bbox acima da área máxima, zoom fora de 0,1–4).

### 3.8 `GET /bubbles/{id}`
- **Auth:** público (com token inclui `my_participation`, `allowed_actions`, `blocked_actions`).
```json
{
  "id": "0192f1c2-…",
  "type": "SALE",
  "status": "ACTIVE",
  "title": "Fone Bluetooth XT-500",
  "description": "Novo, lacrado…",
  "images": [ { "url": "…", "alt": "Fone preto sobre a caixa" } ],
  "creator": { "pseudonym": "TecnoLotes#9C1D", "account_type": "PJ", "score_band": "BOM", "score": 702 },
  "price_tiers": [
    { "min_filled_quotas": 0, "unit_price": 10000, "reached": true },
    { "min_filled_quotas": 40, "unit_price": 9000, "reached": true },
    { "min_filled_quotas": 70, "unit_price": 8000, "reached": false },
    { "min_filled_quotas": 100, "unit_price": 7500, "reached": false }
  ],
  "current_price": 9000,
  "next_tier": { "min_filled_quotas": 70, "unit_price": 8000, "quotas_to_go": 5 },
  "min_quotas": 40, "max_quotas": 100, "filled_quotas": 65, "reserved_quotas": 2, "available_quotas": 33,
  "max_pj_share": 0.5, "shipping_days": 7,
  "is_near_full": false, "is_expiring": false,
  "expires_at": "2026-11-26T12:00:00Z",
  "participants_preview": ["Bolhista#4F2A", "Bolhista#77B0", "Mercadao#12EF"],
  "my_participation": null,
  "allowed_actions": ["JOIN_QUOTA", "REPORT"],
  "blocked_actions": [],
  "version": 141,
  "server_time": "2026-11-24T14:03:11Z"
}
```
Erros: `BUBBLE_NOT_FOUND`.

### 3.9 `GET /me/bubbles` — bolhas que criei
- **Auth:** autenticado · `?status=&type=&limit&cursor` → página de `BubbleSummary` + `pending_actions` (ex.: `{ "SELECT_BID": "2026-11-27T09:41:07Z" }`, `{ "REGISTER_SHIPMENTS": 12 }`).

### 3.10 `POST /bubbles/{id}/reports` — denunciar bolha (F12)
- **Auth:** autenticado · **Rate:** 10/dia
- `{ "category": "PROHIBITED|MISLEADING|FRAUD|OTHER", "details": "até 1.000 caracteres" }` → `201 { "id": "…", "status": "RECEIVED" }`.
- Entra na fila de moderação (§8). O denunciante não vê quem mais denunciou.
- Erros: `REPORT_ALREADY_SUBMITTED`, `BUBBLE_NOT_FOUND`.

---

## 4. Cotas e pagamento (`bubble` + `payment` — F5, F6)

### 4.1 `POST /bubbles/{id}/quotas` — entrar na bolha
- **Auth:** autenticado (PF: `quantity` = 1; PJ verificada: 1 até o limite) · **Idempotência: obrigatória** · **Rate:** 10/min, 3/min por bolha

Request (cartão — pré-autorização):
```json
{ "quantity": 1, "payment": { "method": "CARD", "card_token": "card_tok_8Jk…", "installments": 1 } }
```
Request (Pix):
```json
{ "quantity": 1, "payment": { "method": "PIX" } }
```

- `card_token` é gerado no navegador pelo SDK do gateway (dados de cartão nunca passam pela API — PCI SAQ-A).
- Valor: `valor_reserva × quantity`, com `valor_reserva` = **preço inicial** (venda) ou **preço-alvo** (compra).
- **Cartão:** pré-autoriza → transação atômica (ADR-0002): `UPDATE bubbles SET filled_quotas = filled_quotas + :n … WHERE status='ACTIVE' AND filled_quotas + reserved_quotas + :n <= max_quotas` + `INSERT quotas (status ACTIVE)` + checagem de `max_pj_share` + outbox `QuotaAcquired` (e `BubbleExploded{FULL}` se lotou). Falha após autorizar → autorização cancelada.
- **Pix:** a cota é **reservada** pelo prazo `min(15 min, expires_at − agora)`: `reserved_quotas + :n` (mesma condição de capacidade) + `INSERT quotas (status RESERVED)`. Pix **não é aceito** quando faltam menos de 5 min para o fim (`PIX_UNAVAILABLE_LATE`). Ao confirmar o pagamento (webhook), na mesma transação: `reserved_quotas − n`, `filled_quotas + n`, cota `ACTIVE`, `QuotaAcquired` — e, se `filled_quotas = max_quotas`, `BubbleExploded{FULL}`. Sem pagamento no prazo, a reserva expira, a vaga reabre e não há penalidade. Reservas pendentes no fim do prazo são canceladas; Pix pago depois disso é estornado automaticamente.
- **Lotação com reservas:** se `filled_quotas + reserved_quotas = max_quotas` mas `filled_quotas < max_quotas`, novas entradas recebem `QUOTA_SOLD_OUT` com `pending_reservations: N` e a mensagem "Cotas esgotadas — N reservas aguardando pagamento". A explosão por lotação só ocorre quando o último Pix é pago.

Response `201` (cartão):
```json
{
  "quota": { "id": "0192f3…", "bubble_id": "0192f1c2-…", "quantity": 1, "status": "ACTIVE", "acquired_at": "2026-11-24T14:03:12Z" },
  "payment": { "id": "0192f3…", "method": "CARD", "status": "AUTHORIZED", "authorized_amount": 10000, "currency": "BRL" },
  "bubble": { "filled_quotas": 66, "available_quotas": 32, "current_price": 9000, "next_tier": { "min_filled_quotas": 70, "unit_price": 8000, "quotas_to_go": 4 }, "is_near_full": false, "status": "ACTIVE", "version": 142 }
}
```
Response `201` (Pix): `quota.status: "RESERVED"`, `payment.status: "PENDING"`, `pix: { "qr_code": "000201…", "qr_code_image_url": "…", "expires_at": "<agora + min(15 min, tempo restante)>" }`.

Erros: `BUBBLE_NOT_ACTIVE`, `QUOTA_SOLD_OUT`, `PIX_UNAVAILABLE_LATE`, `QUOTA_EXCEEDS_AVAILABLE`, `PF_QUOTA_LIMIT`, `PJ_SHARE_EXCEEDED`, `CREATOR_CANNOT_JOIN`, `ACCOUNT_NOT_VERIFIED`, `PAYMENT_DECLINED`, `PAYMENT_METHOD_UNSUPPORTED`, `PAYMENT_PROVIDER_UNAVAILABLE`, `IDEMPOTENCY_*`, `CAPTCHA_REQUIRED`, `RATE_LIMITED`.

> Exceção: o criador da bolha de compra **não** usa esta rota — sua cota é criada na publicação (§3.5). Para ele, `POST …/quotas` retorna `CREATOR_CANNOT_JOIN` (não pode ter mais de 1 cota, mesmo sendo PJ — a confirmar no Gate A).

### 4.2 `DELETE /bubbles/{id}/quotas/me` — sair da bolha
- **Auth:** participante · idempotência natural (2ª chamada → `404 QUOTA_NOT_FOUND`, que o front trata como sucesso)
- Permitido enquanto `ACTIVE` e **fora da última hora**. Libera a pré-autorização (cartão) ou estorna o Pix integralmente; cancela uma reserva Pix pendente. Recalcula o preço para todos (`QuotaReleased`). PJ pode informar `?quantity=3`.
- Response `200`: `{ "released_quantity": 1, "refund": { "status": "PROCESSING", "amount": 10000 }, "bubble": { "filled_quotas": 65, "current_price": 9000, "version": 143 } }`.
- Erros: `BUBBLE_NOT_ACTIVE`, `BUBBLE_EXIT_LOCKED`, `QUOTA_NOT_FOUND`, `RATE_LIMITED`.

### 4.3 `GET /me/quotas` — minhas cotas
- **Auth:** autenticado · `?status=RESERVED,ACTIVE,CAPTURED,RELEASED,REFUNDED&limit&cursor`
```json
{
  "data": [{
    "quota_id": "0192f3…", "quantity": 1, "status": "ACTIVE",
    "bubble": { "id": "0192f1c2-…", "type": "SALE", "title": "Fone Bluetooth XT-500", "status": "ACTIVE", "current_price": 9000, "expires_at": "…", "is_expiring": false },
    "payment": { "method": "CARD", "status": "AUTHORIZED", "authorized_amount": 10000 },
    "triage_item_id": null
  }],
  "page": { "next_cursor": null, "has_more": false, "limit": 20 }
}
```

### 4.4 `GET /payments/{id}` e `GET /me/payments`
- **Auth:** dono. `status`: `PENDING`, `AUTHORIZED`, `CAPTURED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`, `EXPIRED` (Pix não pago), `CANCELLED`; valores autorizado/capturado/liberado; linha do tempo `events[]`. Cartão: só bandeira + 4 últimos dígitos.

### 4.5 `GET /me/payouts` — repasses (vendedor)
- **Auth:** autenticado · lista com `status` (`SCHEDULED`, `ON_HOLD` — caso de triagem aberto ou conta suspensa em revisão, `RELEASED`, `FAILED`), `gross_amount`, `platform_fee` (6% sobre o valor dos itens `COMPLETED` — GMV concluído, já descontados estornos e arrependimentos; hipótese), `gateway_fee`, `net_amount`, `release_at`.

### 4.6 `POST /webhooks/payments/pagarme`
- **Auth:** validação da autenticidade do webhook **conforme a documentação do Pagar.me v5** (mecanismo e nome de cabeçalho a confirmar na homologação — não assumidos aqui), com comparação em tempo constante quando houver assinatura, + allowlist de IP se o gateway publicar faixas · **Idempotência:** por `id` do evento do gateway em `webhook_events` (único).
- `200` imediato após persistir o evento bruto. O processamento assíncrono **nunca confia só no payload**: antes de qualquer transição (`PaymentAuthorized`, `PaymentCaptured`, `PaymentRefunded`, `PaymentFailed`, reserva → cota), o worker **reconsulta a cobrança na API do gateway** e usa o status retornado. Duplicado → `200` sem efeito. Autenticação inválida → `401 WEBHOOK_SIGNATURE_INVALID`.

### 4.7 Captura na explosão (sem endpoint — comportamento)
- **Venda:** captura imediata do preço final de todos os participantes. Captura que falhar (ex.: pré-autorização expirada) cancela **só o item daquele comprador**, sem afetar os demais e **sem** penalizar o score do comprador (Spec F7/§6).
- **Compra:** captura após a seleção do lance, pelo preço do lance; a diferença para o preço-alvo é liberada.
- Na explosão por tempo, reservas Pix ainda pendentes são descartadas e **não contam** para a meta (Spec §6).

---

## 5. Lances (`bidding` — F8, ADR-0005)

### 5.1 `GET /bubbles/{id}/bids`
- **Auth:** público (bolhas `PURCHASE`) · ordenação `unit_price ASC, submitted_at ASC` · cursor
```json
{
  "data": [
    { "id": "0192f5…", "bidder": { "pseudonym": "Fornecedor#A31F", "score_band": "EXCELENTE", "score": 845 }, "unit_price": 79900, "delivery_days": 12, "conditions": "Frete incluso SP capital; garantia 2 anos.", "status": "ACTIVE", "submitted_at": "2026-11-24T10:00:00Z", "valid_until": "2026-11-26T23:00:00Z", "is_mine": false }
  ],
  "summary": { "bids_count": 4, "best_price": 79900, "target_price": 89000 },
  "page": { "next_cursor": null, "has_more": false, "limit": 20 }
}
```
- Empresas aparecem **só por pseudônimo** até a seleção; depois, o nome da vencedora é revelado aos participantes (`BubbleDetail.winner`).

### 5.2 `POST /bubbles/{id}/bids` — enviar ou substituir lance
- **Auth:** PJ verificada · **Idempotência: obrigatória** · **Rate:** 30/h
```json
{ "unit_price": 79900, "delivery_days": 12, "conditions": "Frete incluso SP capital; garantia 2 anos." }
```
- Regras: bolha `PURCHASE` em `ACTIVE`; `unit_price ≤ target_price`; `conditions` até 1.000 caracteres; validade = fim da bolha; criadora não pode dar lance.
- **Um lance ativo por empresa (Spec F8):** se a empresa já tem lance ativo, o novo lance **o substitui** numa única transação — o anterior vira `WITHDRAWN` (`BidWithdrawn`) e o novo fica `ACTIVE` (`BidSubmitted`). Não há erro de "lance já existe". A antiguidade (critério de desempate) passa a ser a do novo lance.
- Response `201`: `{ "bid": { …novo… }, "replaced_bid_id": "0192f5…" | null }`. WS: `bid.withdrawn` (se substituiu) seguido de `bid.submitted`.
- Erros: `WRONG_BUBBLE_TYPE`, `BUBBLE_NOT_ACTIVE`, `BID_ABOVE_TARGET`, `CREATOR_CANNOT_JOIN`, `ACCOUNT_NOT_VERIFIED`, `IDEMPOTENCY_*`.

### 5.3 `DELETE /bubbles/{id}/bids/{bidId}` — retirar lance
- **Auth:** autor do lance · permitido só com bolha `ACTIVE` → `200 { "status": "WITHDRAWN" }`. Erros: `BID_NOT_FOUND`, `BID_WITHDRAW_NOT_ALLOWED`.

### 5.4 `POST /bubbles/{id}/bids/{bidId}/select` — escolher vencedor
- **Auth:** criador · **Idempotência: obrigatória**
- Permitido em `EXPIRED_SUCCESS` dentro de `bid_selection_deadline` (24 h). Aviso ao criador em T−2 h. Sem escolha, o job `bid-selection-timeout` seleciona o menor preço (empate: o mais antigo). Sem lance válido → `CANCELLED` com estorno de 100%.
- Efeito: `BidSelected` → captura de cada participante pelo `unit_price` (diferença liberada) → `TriageOpened` → bolha `IN_TRIAGE`; vencedora revelada aos participantes; perdedoras notificadas.
- Response `200`: `{ "bubble": { "status": "IN_TRIAGE", "selected_bid_id": "0192f5…", "final_price": 79900, "winner": { "pseudonym": "Fornecedor#A31F", "legal_name": "FORNECEDORA ABC LTDA" }, "version": 210 } }`
- Erros: `BID_SELECTION_NOT_OPEN`, `BID_SELECTION_WINDOW_CLOSED`, `BID_NOT_FOUND`, `IDEMPOTENCY_*`.

### 5.5 `GET /me/bids` — meus lances (PJ)
- `?status=ACTIVE,WITHDRAWN,SELECTED,NOT_SELECTED&cursor`.

---

## 6. Triagem (`triage` — F9)

Cada participante tem **um item de triagem** (1 por cota ou grupo de cotas da mesma conta). Vendedor = criador da bolha de venda ou empresa vencedora da bolha de compra.

**Estados do item** (somente estes): `PENDING_SHIPMENT`, `SHIPPED`, `DELIVERED`, `WITHDRAWAL_REQUESTED`, `COMPLETED`, `CANCELLED`. Estorno e repasse são **efeitos** (registrados em `payments`/`refunds`/`payouts`), não estados. Flags derivadas: `is_late` (passou `shipping_deadline` sem envio, dentro da tolerância de +3 dias) e `has_open_case`.

```text
PENDING_SHIPMENT ──rastreio no prazo (+5)──► SHIPPED ──confirmação ou auto 7 d──► DELIVERED ──janela 7 d encerra──► COMPLETED (repasse)
      │ shipping_days esgotado                                                       │
      ▼                                                                              └─ arrependimento ─► WITHDRAWAL_REQUESTED
PENDING_SHIPMENT [is_late] ──rastreio na tolerância (−15)──► SHIPPED                                          │ devolução confirmada → CANCELLED (estorno)
      │ +3 d esgotados, ou comprador cancela no atraso                                                         │ 10 d sem confirmação → fila de moderação
      ▼
 CANCELLED (estorno 100%, vendedor −60)
```

- Captura que falhou na explosão (ex.: pré-autorização expirada) gera o item já `CANCELLED`, sem penalidade ao comprador.
- Um **caso** aberto (§6.8) pausa prazos automáticos e o repasse do item.

### 6.1 `GET /triage/items`
- **Auth:** autenticado · `?role=seller|buyer&bubble_id=&status=&late=true&cursor`
```json
{
  "data": [{
    "id": "0192f7…",
    "bubble": { "id": "0192f1c2-…", "title": "Fone Bluetooth XT-500", "type": "SALE" },
    "role": "seller",
    "counterparty": { "pseudonym": "Bolhista#4F2A", "name": "Carlos Silva" },
    "quantity": 1, "unit_price": 8000, "amount": 8000,
    "status": "PENDING_SHIPMENT",
    "is_late": false,
    "shipping_deadline": "2026-12-03T12:00:00Z",
    "late_tolerance_until": "2026-12-06T12:00:00Z",
    "auto_confirm_at": null,
    "withdrawal_deadline": null,
    "has_open_case": false,
    "allowed_actions": ["REGISTER_SHIPMENT"]
  }],
  "summary": { "pending_shipment": 52, "late": 0, "shipped": 14, "delivered": 6, "withdrawal_requested": 0, "open_cases": 1, "completed": 0, "cancelled": 0 },
  "page": { "next_cursor": "…", "has_more": true, "limit": 50 }
}
```
- Nome e endereço de entrega da contraparte aparecem **só** para as partes do próprio negócio e **só a partir da captura** (Spec F1); são ocultados após a conclusão.

### 6.2 `GET /triage/items/{id}` — detalhe + endereço (vendedor) + linha do tempo `events[]` (inclui estornos e repasse como eventos).

### 6.3 `POST /triage/items/{id}/shipment` — registrar envio
- **Auth:** vendedor · **Idempotência:** recomendada
- `{ "carrier": "CORREIOS", "tracking_code": "QB123456789BR", "estimated_delivery": "2026-12-04" }`
- Lote: `POST /triage/shipments:batch` com `{ "items": [{ "triage_item_id": "…", "carrier": "…", "tracking_code": "…" }] }` (máx. 200) → `207` com resultado por item.
- Response `200`: item `SHIPPED` (`ShipmentRegistered`): +5 se no prazo; −15 se `is_late` (tolerância).
- Erros: `TRIAGE_INVALID_TRANSITION`, `SHIPPING_DEADLINE_PASSED` (tolerância esgotada — item já `CANCELLED`).

### 6.4 `POST /triage/items/{id}/cancellation` — comprador cancela item atrasado
- **Auth:** comprador · **Idempotência: obrigatória** · permitido só com `status = PENDING_SHIPMENT` e `is_late = true`.
- Efeito: item `CANCELLED`, estorno de 100% (efeito), vendedor −60 (mesmo efeito do fim da tolerância).
- Erros: `TRIAGE_NOT_LATE`, `TRIAGE_INVALID_TRANSITION`.

### 6.5 `POST /triage/items/{id}/delivery-confirmation` — confirmar recebimento
- **Auth:** comprador · `{ "received_at": "2026-12-03T18:20:00Z" }` → `DELIVERED` (`DeliveryConfirmed`), abre a janela de arrependimento de 7 dias.
- Sem ação: confirmação automática 7 dias após a entrega rastreada (ou após o prazo estimado).

### 6.6 `POST /triage/items/{id}/withdrawal` — arrependimento (CDC art. 49)
- **Auth:** comprador · **Idempotência: obrigatória** · `{ "reason": "opcional" }` (o direito independe de justificativa)
- Até 7 dias após `DELIVERED` → `WITHDRAWAL_REQUESTED` + instruções de devolução. Sem penalidade ao comprador. O comprador informa o rastreio da devolução em `POST /triage/items/{id}/return-shipment` (`{ "carrier", "tracking_code" }`) — o item **continua** `WITHDRAWAL_REQUESTED`.
- Erros: `WITHDRAWAL_WINDOW_CLOSED`, `TRIAGE_INVALID_TRANSITION`.

### 6.7 `POST /triage/items/{id}/return-confirmation` — vendedor confirma a devolução
- **Auth:** vendedor · **Idempotência: obrigatória** → item `CANCELLED` (`TriageItemCancelled`) com estorno integral como efeito (`PaymentRefunded`).
- **Sem confirmação em 10 dias:** o item vai para a **fila de moderação** (não há estorno automático); a moderação decide.

### 6.8 Casos de triagem — `POST /triage/items/{id}/cases`
- **Auth:** comprador · **Idempotência:** recomendada
- Permitido com o item em `SHIPPED` ou `DELIVERED`, **até o fim da janela de arrependimento**.
- `{ "type": "NOT_RECEIVED|DIFFERENT_PRODUCT|DEFECTIVE", "description": "…", "evidence_upload_ids": ["…"] }` → `201 { "id": "…", "status": "OPEN" }`.
- Pausa os prazos automáticos e o repasse; entra na fila de moderação. `GET /triage/cases/{id}` mostra status e decisão; `POST /triage/cases/{id}/messages` (comprador ou vendedor) adiciona evidências.
- Decisões possíveis (§8.3): **estorno total** → item `CANCELLED`; **estorno parcial** → item `COMPLETED` com valor capturado reduzido (taxa e score de "transação concluída" usam o valor final); **improcedente** → o item retoma os prazos de onde parou. Caso procedente contra o vendedor: −30.
- Erros: `TRIAGE_CASE_ALREADY_OPEN`, `TRIAGE_CASE_WINDOW_CLOSED`.

---

## 7. Reputação (`reputation` — F10, ADR-0007)

### 7.1 `GET /accounts/{id}/score`
- **Auth:** público (`{id}` = UUID ou pseudônimo) → `{ "pseudonym": "TecnoLotes#9C1D", "score": 702, "band": "BOM", "model_version": "score-v1", "completed_transactions": 318, "member_since": "2026-10" }`.
- R1: o score é **apenas informativo** — nenhuma rota bloqueia por score.

### 7.2 `GET /me/score/events` — "por que meu score mudou"
```json
{
  "data": [{
    "id": "0192f9…", "type": "SHIPPING_LATE", "points": -15, "decay_factor": 0.97,
    "occurred_at": "2026-12-04T00:00:00Z", "bubble_id": "0192f1c2-…",
    "explanation": "Envio registrado 2 dias após o prazo da bolha.",
    "model_version": "score-v1",
    "status": "COUNTED",
    "dispute": { "status": null, "deadline": "2026-12-09T00:00:00Z", "can_dispute": true }
  }],
  "current": { "score": 687, "band": "BOM" }
}
```
`decay_factor = 0,5^(idade/180)`. `status`: `COUNTED`, `UNDER_REVIEW` (não conta até a decisão), `REVERSED`.

`type` (Spec F10 v1.1): `TRANSACTION_COMPLETED` (+20 comprador / +30 vendedor), `SHIPPED_ON_TIME` (+5), `SHIPPING_LATE` (−15, envio na tolerância), `CANCELLED_NO_SHIPMENT` (−60), `CHARGEBACK_UNFOUNDED` (−40, comprador), `TRIAGE_CASE_UPHELD` (−30, vendedor). **Não geram evento:** reserva Pix expirada, saída de cota, arrependimento e falha de captura por pré-autorização expirada.

### 7.3 `POST /score-events/{id}/disputes` — contestar
- **Auth:** dono do evento · **Idempotência:** recomendada
- `{ "argument": "O atraso foi da transportadora; anexo o comprovante de postagem.", "evidence_upload_ids": ["…"] }` → `201 { "id": "…", "status": "UNDER_REVIEW", "decision_due_by": "<+5 dias úteis>" }`. O evento passa a `UNDER_REVIEW` e **sai do cálculo** até a decisão (`ScoreDisputeOpened`).
- Erros: `DISPUTE_WINDOW_CLOSED`, `DISPUTE_ALREADY_OPEN`, `SCORE_EVENT_NOT_DISPUTABLE`.

### 7.4 `GET /me/score-disputes` — `status` (`UNDER_REVIEW`, `UPHELD` — procedente, evento revertido; `REJECTED`) + `decision_reason`.

---

## 8. Notificações e moderação

### 8.1 Notificações (F11)
- `GET /me/notifications?unread=true&cursor` → `[{ "id", "type", "title", "body", "link", "read_at", "created_at" }]`.
- `type`: `QUOTA_CONFIRMED`, `QUOTA_RELEASED`, `PRICE_TIER_REACHED`, `BUBBLE_EXPIRING`, `BUBBLE_EXPLODED_SUCCESS`, `BUBBLE_EXPLODED_FAILED`, `BID_RECEIVED`, `BID_SELECTION_DEADLINE`, `BID_SELECTED`, `BID_NOT_SELECTED`, `TRIAGE_DEADLINE`, `TRIAGE_ITEM_LATE`, `TRIAGE_CASE_DECIDED`, `REFUND_ISSUED`, `SCORE_CHANGED`, `DISPUTE_DECIDED`, `CNPJ_VERIFICATION_RESULT`.
- `POST /me/notifications/{id}/read` → `204`; `POST /me/notifications/read-all` → `204`.
- `GET/PUT /me/notification-preferences`: só os e-mails **não transacionais** podem ser desligados; tentar desligar cobrança, estorno ou prazos → `422 VALIDATION_FAILED`.

### 8.2 Fila de moderação (F12)
- `GET /admin/moderation-queue?type=REPORT|TRIAGE_CASE|SCORE_DISPUTE|RETURN_TIMEOUT&status=OPEN&cursor` — **Auth:** moderator. Itens com prioridade (valor envolvido, nº de denúncias, prazo).
- `GET /admin/moderation-queue/{itemId}` — contexto completo (bolha, partes por pseudônimo + dados necessários, evidências, histórico).

### 8.3 Ações de moderação
Todas exigem `reason` (texto) e geram registro **imutável** em `audit_log`.

| Rota | Auth | Efeito |
| :--- | :--- | :--- |
| `POST /admin/bubbles/{id}/suspend` | moderator · Idempotência obrigatória | `ACTIVE → CANCELLED` (`CANCELLED_BY_MODERATION`) com estorno de 100% de tudo; `{ "reason": "…", "report_ids": ["…"] }` |
| `POST /admin/reports/{id}/dismiss` | moderator | Arquiva denúncia improcedente |
| `POST /admin/accounts/{id}/suspend` / `…/reinstate` | moderator · Idempotência obrigatória | Suspensão (Spec §6): sessões revogadas; bolhas `ACTIVE` criadas pela conta → `CANCELLED` com estorno 100%; cotas da conta em bolhas ativas são liberadas; triagens em andamento seguem acompanhadas pela moderação e o repasse fica `ON_HOLD` até a revisão |
| `POST /admin/triage/cases/{id}/decision` | moderator · Idempotência obrigatória | `{ "decision": "FULL_REFUND|PARTIAL_REFUND|UNFOUNDED", "refund_amount": 4000, "reason": "…" }` — total → item `CANCELLED`; parcial → item `COMPLETED` com valor reduzido; improcedente → item retoma os prazos e o repasse. Procedente contra o vendedor gera −30 |
| `POST /admin/triage/items/{id}/return-decision` | moderator · Idempotência obrigatória | Devolução sem confirmação do vendedor em 10 dias: `{ "decision": "REFUND_BUYER|RELEASE_PAYOUT", "reason": "…" }` |
| `POST /admin/score-disputes/{id}/decision` | moderator (diferente do que gerou o caso original) | `{ "decision": "UPHELD|REJECTED", "reason": "…" }` em até 5 dias úteis → `ScoreDisputeResolved` (procedente reverte o evento). No R1 a decisão é final na plataforma. Mesmo moderador do caso original → `403 FORBIDDEN` |

### 8.4 Operação
| Rota | Auth | Descrição |
| :--- | :--- | :--- |
| `GET /admin/jobs/health` | admin | Atraso das filas BullMQ, bolhas vencidas não processadas (reconciliador), webhooks com falha |
| `GET /admin/audit-log?actor=&entity=&cursor` | admin | Trilha de auditoria (somente leitura) |
| `GET /health/live`, `GET /health/ready` | rede interna | Liveness/readiness (Postgres, Redis) |

---

## 9. Notas e pendências

1. **Reserva Pix e o modelo de dados canônico:** a Spec v1.1 define a cota reservada, que ocupa capacidade mas **não** conta para preço nem meta. Este contrato introduz `bubbles.reserved_quotas` e o status de cota `RESERVED`, e a condição do ADR-0002 passa a `filled_quotas + reserved_quotas + :n <= max_quotas`. O índice único parcial de PF precisa cobrir `status IN ('RESERVED','ACTIVE')`. Atualizar ADR-0002 e o modelo de dados.
2. **Criador PJ de bolha de compra** ocupa exatamente 1 cota (Spec F4); confirmar se pode adquirir mais.
3. **Taxa de 6%** e repasse dependem do contrato com o gateway (R4/R5, Spec Q1/Q5).
4. OpenAPI em `packages/contracts/openapi.yaml`; testes de contrato (Supertest) validam cada exemplo deste documento.

---

## Fontes consultadas (AlterEgo)

- **senior-backend-nodejs** — *Data Table — Software Engineering and Design Pattern Key Concepts (NotebookLM)*: "Tolerant Reader" (evolução de contrato sem quebrar consumidores → versionamento aditivo §1.1); "Operational vs Programmer Errors" (erro de negócio previsto × bug → `4xx` com `code` × `500 INTERNAL_ERROR`, §1.4); "Distributed tracing" (identificador único por requisição → `X-Request-Id`/`trace_id`); "Statelessness" (estado em Redis → rate limit e idempotência fora da instância); "CSRF Prevention" (token em requisições que mudam estado → `X-CSRF-Token` no refresh).
- **senior-backend-nodejs** — *Skill §4 Segurança*: `crypto.timingSafeEqual` para comparar segredos (validação de assinatura do webhook §4.6).
- **senior-backend-nodejs** — *Architecture Flashcards (NotebookLM)*: "Health check API" (§8.4) e "Circuit Breaker" (falhar rápido com `PAYMENT_PROVIDER_UNAVAILABLE` em vez de travar a requisição).
