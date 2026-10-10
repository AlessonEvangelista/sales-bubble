/**
 * Porta `KeyProvider` — acesso à KEK (KMS) e às chaves do HMAC de busca (*pepper*), ADR-0012.
 *
 * - A KEK nunca sai do provedor: a aplicação só pede wrap/unwrap de DEKs.
 * - O `context` é dado autenticado adicional (AAD / *encryption context* do KMS): amarra a DEK
 *   cifrada ao seu dono (ex.: `account:<id>`), então copiar a DEK de uma conta para outra falha.
 * - As chaves de HMAC são versionadas; a versão ativa calcula hashes novos e as anteriores
 *   continuam disponíveis para busca durante o recálculo em lote (rotação do *pepper*).
 *
 * Adapters: `LocalKeyProvider` (dev/CI e `secret-manager`) e `CloudKmsKeyProvider` (KMS gerenciado,
 * cliente do provedor a definir — BV-104).
 */
export interface WrappedDataKeyParts {
  /** Identificador da KEK que cifrou a DEK (id local ou nome/alias da chave no KMS). */
  readonly kekId: string;
  /** DEK cifrada, no formato próprio do provedor. */
  readonly wrapped: Buffer;
}

export interface KeyProvider {
  readonly kind: 'local' | 'secret-manager' | 'cloud-kms';
  /** KEK usada para cifrar DEKs novas e no *rewrap*. */
  readonly activeKekId: string;
  /** Versão do *pepper* usada para calcular hashes novos (coluna `pii_key_version`). */
  readonly activeHmacVersion: number;

  wrapDataKey(dek: Buffer, context: Buffer): Promise<WrappedDataKeyParts>;
  unwrapDataKey(parts: WrappedDataKeyParts, context: Buffer): Promise<Buffer>;

  /** Todas as versões de HMAC disponíveis (ativa primeiro). */
  hmacVersions(): readonly number[];
  /** Chave de HMAC de uma versão; `UNKNOWN_KEY` se não existir. */
  hmacKey(version: number): Promise<Buffer>;
}
