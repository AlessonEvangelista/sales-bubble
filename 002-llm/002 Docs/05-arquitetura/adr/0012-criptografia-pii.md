# ADR-0012 — Criptografia de PII em coluna (AES-256-GCM, chave no KMS) + hash HMAC-SHA256 para busca; logs sem PII

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RNF03 e §4.1](../../../PRD.MD) · [Spec v1.1 F1](../../../SPEC.md) · Detalhe: [modelo-dados.md §3.8](../modelo-dados.md#38-colunas-cifradas-e-hash-como-funcionam)
**Decisores:** Tech Lead, Jurídico (DPO) · **Revisar em:** RIPD (S0) e pentest (S8)

## Contexto

- RNF03: CPF, CNPJ e e-mail cifrados; LGPD (art. 46: medidas de segurança; art. 18: direitos do titular; incidente comunicado à ANPD); R6 (vazamento) com impacto alto.
- O sistema precisa **buscar** por e-mail (login) e garantir **unicidade** de documento sem decifrar a tabela inteira.
- No canvas e nos lances só aparece o pseudônimo; nome e endereço aparecem só às partes do mesmo negócio, após a captura (Spec F1).
- Cifragem de disco do provedor protege contra roubo de mídia, mas não contra *dump* lógico, réplica mal configurada ou acesso indevido ao banco.

## Decisão

1. **Cifragem em coluna (envelope):** cada conta tem uma DEK (AES-256) cifrada pela KEK do **KMS**; os campos `email_enc`, `document_enc`, `name_enc`, `phone_enc` e `triage_items.shipping_address_enc` usam **AES-256-GCM** (nonce de 96 bits aleatório, AAD = `tabela:coluna:id`). Formato: `versão‖nonce‖ciphertext‖tag`.
2. **Hash para busca/unicidade:** `email_hash`, `document_hash` = **HMAC-SHA256** com *pepper* no secret manager (não é hash simples, para evitar dicionário de CPFs). Índices `UNIQUE` sobre os hashes.
3. Decifragem só no adapter `KmsEnvelopeCipher` (porta `PiiCipherPort`); cache de DEK decifrada em memória por até 5 min; o domínio usa value objects com `toJSON()`/`toString()` mascarados.
4. **Logs sem PII:** logger (pino) com *redaction* por lista de campos e por padrão (CPF/CNPJ/e-mail); teste automatizado na CI falha se um log de teste contiver PII. Traces OTel sem atributos de PII. Sentry com `beforeSend` que remove dados de requisição.
5. **Rotação:** KEK anual (rewrap das DEKs, sem recifrar dados); *pepper* versionado (`pii_key_version`), com recálculo em lote se rotacionado.
6. **Exclusão (LGPD):** *crypto-shredding*: descartar a DEK da conta torna os campos ilegíveis em banco, réplicas e backups; mantém-se o pseudônimo nos registros com retenção legal.
7. **Acesso:** papel da aplicação sem acesso ao KMS fora do *service account* de produção; leitura de PII por suporte/moderação gera `audit_log` (`pii.read`).

## Alternativas consideradas

| Critério | **A. Envelope em coluna na app + HMAC (escolhida)** | B. Só cifragem de disco do provedor | C. `pgcrypto` no banco | D. Tokenização em cofre externo |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●● chamadas ao KMS (com cache) | ●●● | ●●● | ● serviço pago |
| Reversibilidade | ●● migrar o formato exige recifrar | ●●● | ●● | ●● |
| Complexidade | ●● | ●●● | ●● chave trafega para o banco nas queries | ● |
| Risco | ●●● *dump* do banco não expõe PII; chave fora do banco | ● *dump* lógico expõe tudo | ●● chave aparece em logs de query e `pg_stat_statements` | ●●● |

## Consequências

**Positivas (+)** Um vazamento do banco não expõe CPF/CNPJ/e-mail; exclusão efetiva via *crypto-shredding*; unicidade e login sem decifrar.
**Negativas (−)** Não dá para fazer `LIKE`/ordenação nesses campos (o suporte busca por hash exato) → aceitável. Dependência do KMS no login e no cadastro → cache de DEK e *timeouts*; falha do KMS degrada só os fluxos que leem PII. Erros de implementação de cripto → biblioteca padrão (`node:crypto`), revisão e testes de vetor conhecidos.

## Verificação

Teste: `pg_dump` do banco de staging sem nenhum CPF/e-mail em claro (busca por regex); teste de redação de logs; teste de *crypto-shredding* (após descartar a DEK, a leitura falha de forma controlada).

## Fontes

- Projeto: PRD v2.1 §4.1, RNF03; Spec v1.1 F1; plano v2 §7 (R6), E1, E9.
- **architect** — *MS Engineering Playbook*, guia de requisitos não funcionais: privacidade (cifragem segundo padrões, anonimização, conformidade regulatória) e segurança como atributos com métricas verificáveis.
- **asias-arquitetura-hexagonal** — *Skill*: a cifragem fica num adapter atrás de porta, fora do domínio.
