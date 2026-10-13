# Changelog

## 1.0.0 (2026-10-13)


### Funcionalidades

* **auth:** BV-11 cadastro de pessoa fisica com PII cifrada e anti-enumeracao ([91eed99](https://github.com/AlessonEvangelista/sales-bubble/commit/91eed9955cb1e023afebdef8db0f6837a11ff615))
* **auth:** BV-11 cadastro de pessoa física com PII cifrada e anti-enumeração ([90e114e](https://github.com/AlessonEvangelista/sales-bubble/commit/90e114e6c07780d98f3f0c80da3814adc29933bb))
* **auth:** BV-14 BV-15 BV-18 BV-139 BV-141 BV-153 login, sessão, RBAC e anti-enumeração ([8403bbb](https://github.com/AlessonEvangelista/sales-bubble/commit/8403bbb4c775ee5fdad34f8bfd2c21ee8906c8ce))
* **auth:** login, sessão segura, refresh rotativo, RBAC e anti-enumeração (BV-14, BV-15, BV-18, BV-139, BV-141, BV-153) ([48717a9](https://github.com/AlessonEvangelista/sales-bubble/commit/48717a960896c00c6ec9bca2b2ed8e604b4fc4d6))
* **contracts:** BV-111 DTOs Zod, OpenAPI, erros RFC 9457 e eventos WS/domínio ([87fe80d](https://github.com/AlessonEvangelista/sales-bubble/commit/87fe80d6708211059e871346f34b508f60ddbb4d))
* **core-domain:** BV-112 portas do domínio e fakes determinísticos ([36d8b14](https://github.com/AlessonEvangelista/sales-bubble/commit/36d8b14e4f06004fbb7fcd705ea49be3433a4969))
* **database:** BV-107 schema Prisma inicial e migrations (identity, bubble, quota, outbox) ([62beae8](https://github.com/AlessonEvangelista/sales-bubble/commit/62beae8cae8e263d195a2ea412f350891dabf818))
* **database:** BV-107 schema Prisma inicial e migrations (identity, bubble, quota, outbox) ([aefca04](https://github.com/AlessonEvangelista/sales-bubble/commit/aefca04da7e359ce0d29bb08f318ec06bdbc9ebf))
* **database:** BV-109 criptografia de PII (AES-256-GCM + HMAC de busca, porta KMS) ([db431ac](https://github.com/AlessonEvangelista/sales-bubble/commit/db431acd7a9e0df7b6ab0072ee0f0aea480ed594))
* **docs:** adiciona especificacoes tecnicas, arquitetura, diagramas e readmes do projeto ([adb674d](https://github.com/AlessonEvangelista/sales-bubble/commit/adb674d9f485da83e896edb61c07548c3cd8bb79))
* **monorepo:** BV-100 estrutura Turborepo com apps e packages ([c9ddbf7](https://github.com/AlessonEvangelista/sales-bubble/commit/c9ddbf7d49cb14fa4c253a40d319fe143a732c94))
* **observability:** BV-108 OpenTelemetry, logs estruturados sem PII e Sentry ([6fa7067](https://github.com/AlessonEvangelista/sales-bubble/commit/6fa7067f3d1d70b871a65fcd241f10e70f1739e7))
* **observability:** BV-108 OpenTelemetry, logs estruturados sem PII e Sentry ([f44ba0a](https://github.com/AlessonEvangelista/sales-bubble/commit/f44ba0ab1769db5d2a6f8bdfc4c46151a8630d9c))
* **platform:** feature flags e kill switches em runtime (BV-113) ([fcb680f](https://github.com/AlessonEvangelista/sales-bubble/commit/fcb680fc830f5df51421ab1ce648f0cb21ee57b7))
* **security:** BV-110 gestão de segredos, gitleaks do projeto e OIDC na nuvem ([b435460](https://github.com/AlessonEvangelista/sales-bubble/commit/b43546044f9616362690c210ea2cf8463fbc6d34))


### Correções

* **auth:** BV-11 corrige reprovação do teste do cadastro PF ([6a25251](https://github.com/AlessonEvangelista/sales-bubble/commit/6a252517fd383439bcfffffaeee9893560f2d5b6))
* **auth:** BV-11 lê IP e user agent pelos decorators do Nest (sem tipos do Express) ([aebe457](https://github.com/AlessonEvangelista/sales-bubble/commit/aebe4576c2117ad537e36052d4da1bb6a710169e))
* **deploy:** BV-105 copia tsconfig.base.json para o estágio de build ([fa9023e](https://github.com/AlessonEvangelista/sales-bubble/commit/fa9023e4f261ea6b0a44b0de22a249fc60942175))
* **observability:** BV-108 corrige ReDoS do redact e reprovação do teste ([0ef04db](https://github.com/AlessonEvangelista/sales-bubble/commit/0ef04dba03cea4e89eb3b0b155e92cc6b500b4d3))
* **observability:** BV-108 ReDoS do endpoint OTLP, web com @sentry/browser e exceção LIC-0001 ([b4984bf](https://github.com/AlessonEvangelista/sales-bubble/commit/b4984bf794d7587df4d6b5338d22b8ca2f24d08a))
* **security:** BV-110 gerador sem viés no teste do gitleaks (CodeQL js/biased-cryptographic-random) ([3d3188b](https://github.com/AlessonEvangelista/sales-bubble/commit/3d3188b9f133c099272e73361a1c87d83f2d8c86))
* **tools:** BV-102 cria chaves de dev com flag exclusiva (corrige alerta CodeQL de race condition) ([8f575c0](https://github.com/AlessonEvangelista/sales-bubble/commit/8f575c086b6a461dddf844d2efae887c1743706d))
