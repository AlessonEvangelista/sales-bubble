# Criptografia de PII (`@bolha/database/pii`) — BV-109 / EN-029 / SEC-04

Implementa o [ADR-0012](../../../../../002-llm/002%20Docs/05-arquitetura/adr/0012-criptografia-pii.md)
e o [modelo de dados §3.8](../../../../../002-llm/002%20Docs/05-arquitetura/modelo-dados.md#38-colunas-cifradas-e-hash-como-funcionam).
Só `node:crypto`, sem dependências novas.

| Peça                                        | Papel                                                                                              |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| `KmsEnvelopeCipher` (porta `PiiCipherPort`) | AES-256-GCM em coluna, DEK por conta (_envelope encryption_), cache de DEK ≤ 5 min                 |
| `HmacBlindIndex`                            | HMAC-SHA256 determinístico (com _pepper_ versionado) para busca e unicidade                        |
| porta `KeyProvider`                         | _wrap_/_unwrap_ da DEK pela KEK + chaves de HMAC                                                   |
| `LocalKeyProvider`                          | dev/CI (`PII_KMS_PROVIDER=local`) e `secret-manager`; `local` é recusado com `NODE_ENV=production` |
| `CloudKmsKeyProvider`                       | KMS gerenciado via `KmsClient` injetado — **esqueleto até a escolha da nuvem (BV-104)**            |
| `createPiiCryptoFromEnv(env)`               | composição a partir das variáveis (ver `config.ts` e `.env.example`)                               |

## Uso (composição na api/worker)

```ts
import { createPiiCryptoFromEnv } from '@bolha/database/pii';

const { cipher, blindIndex } = createPiiCryptoFromEnv(process.env);

// cadastro
const wrappedDek = await cipher.createDataKey(accountId); // → accounts.pii_data_key
const key = { subjectId: accountId, wrappedDek };
const aad = { table: 'accounts', column: 'email_enc', rowId: accountId };
const emailEnc = await cipher.encrypt(email, key, aad);
const { hash: emailHash, version } = await blindIndex.hash('email', email); // → email_hash, pii_key_version

// login: WHERE email_hash = ANY($1) (durante a rotação do pepper há mais de um candidato)
const candidates = await blindIndex.lookupCandidates('email', typedEmail);
```

## Formatos de coluna (`bytea`) esperados pelo schema (BV-107)

| Coluna                                                                                              | Formato                                                                                                        |
| :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `*_enc` (`email_enc`, `document_enc`, `name_enc`, `phone_enc`, `triage_items.shipping_address_enc`) | `0x01 ‖ nonce(12) ‖ ciphertext ‖ tag(16)`; AAD do GCM = `0x01 ‖ "bv:pii:field\|<tabela>:<coluna>:<id>"`        |
| `*_hash` (`email_hash`, `document_hash`, `oauth_subject_hash`, `*.ip_hash`)                         | 32 bytes: `HMAC-SHA256(pepper_vN, "bv:pii:<tipo>:v1\0" ‖ valor normalizado)`                                   |
| `accounts.pii_key_version` (`smallint`)                                                             | versão do _pepper_ usada nos `*_hash` da linha                                                                 |
| **`accounts.pii_data_key` (`bytea NOT NULL`) — não está no DDL de modelo-dados §3.1**               | DEK cifrada: `0x01 ‖ len(kekId) ‖ kekId ‖ DEK cifrada pelo KMS`. O `kekId` no blob identifica a KEK na rotação |

O modelo-dados §3.8 diz "uma DEK por conta, cifrada pela KEK do KMS e guardada junto", mas o DDL
§3.1 não tem a coluna. Este módulo não altera o schema (BV-107): a coluna sugerida é
`accounts.pii_data_key bytea`. `triage_items.shipping_address_enc` usa a DEK da conta do comprador
(o _crypto-shredding_ da conta apaga também o endereço).

Normalização antes do HMAC: e-mail `lower(trim())` (com NFC); documento sem `.`, `-`, `/` e espaços,
em maiúsculas (CPF fica só com dígitos; aceita o CNPJ alfanumérico); `oauth_subject` `trim()`; IP
`trim()` + minúsculas.

## Operação

- **Rotação da KEK (anual):** configure a KEK nova como ativa e mantenha a antiga em
  `PII_DATA_KEYS_PREVIOUS` (local) ou `PII_KMS_KEY_NAMES_PREVIOUS` (nuvem). Um job percorre as contas
  com `cipher.needsRewrap(blob)` e grava `cipher.rewrapDataKey(...)`. Os dados não são recifrados.
  Ao terminar, retire a KEK antiga.
- **Rotação do _pepper_ (excepcional):** nova versão em `PII_HMAC_KEY_VERSION`/`PII_HMAC_KEY_BASE64`,
  a antiga em `PII_HMAC_KEYS_PREVIOUS`; a busca usa `lookupCandidates`; um job regrava `*_hash`
  (decifrando o `*_enc`) e `pii_key_version`.
- **Exclusão LGPD (_crypto-shredding_):** apagar `pii_data_key` (e os `*_enc`) da conta e chamar
  `cipher.forgetDataKey(...)`; leituras posteriores falham com erro controlado.
- **Sem PII em log:** nenhum método recebe logger; `PiiCryptoError` só tem código e mensagem
  genérica; chaves ficam em campos privados (`#`) e não aparecem em `JSON.stringify`/`util.inspect`.
