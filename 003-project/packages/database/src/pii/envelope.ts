import { PiiCryptoError } from './errors.js';

/**
 * Formatos binários versionados (colunas `bytea`). O primeiro byte é sempre a versão do formato,
 * para permitir migrar o formato no futuro sem ambiguidade (ADR-0012: `versão‖nonce‖ciphertext‖tag`).
 *
 * Campo cifrado (`*_enc`):
 *   0x01 ‖ nonce(12) ‖ ciphertext(n) ‖ tag(16)
 *   AAD do GCM = 0x01 ‖ utf8("bv:pii:field|<tabela>:<coluna>:<id da linha>")
 *
 * DEK cifrada (coluna esperada `pii_data_key` / `*_dek_wrapped`, ver README do módulo):
 *   0x01 ‖ len(kekId)(1) ‖ utf8(kekId) ‖ DEK cifrada pelo provedor (KMS ou local)
 *   O `kekId` dentro do envelope é o que permite girar a KEK: DEKs antigas continuam
 *   decifráveis pela KEK que as cifrou até o *rewrap*.
 */
export const FIELD_FORMAT_V1 = 0x01;
export const DATA_KEY_FORMAT_V1 = 0x01;

const KEK_ID_PATTERN = /^[A-Za-z0-9._:/@-]{1,255}$/;
const AAD_PART_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface PiiAad {
  /** Tabela, ex.: `accounts`. */
  readonly table: string;
  /** Coluna cifrada, ex.: `email_enc`. */
  readonly column: string;
  /** Id da linha (uuid). Impede mover o ciphertext para outra linha. */
  readonly rowId: string;
}

export function fieldAad(version: number, aad: PiiAad): Buffer {
  if (!AAD_PART_PATTERN.test(aad.table) || !AAD_PART_PATTERN.test(aad.column)) {
    throw new PiiCryptoError('INVALID_INPUT', 'Tabela/coluna do AAD em formato inválido.');
  }
  if (aad.rowId.length === 0 || aad.rowId.length > 128) {
    throw new PiiCryptoError('INVALID_INPUT', 'Id da linha do AAD inválido.');
  }
  return Buffer.concat([
    Buffer.of(version),
    Buffer.from(`bv:pii:field|${aad.table}:${aad.column}:${aad.rowId}`, 'utf8'),
  ]);
}

export function assertKekId(kekId: string): void {
  if (!KEK_ID_PATTERN.test(kekId)) {
    throw new PiiCryptoError('INVALID_CONFIG', 'Identificador de KEK inválido.');
  }
}

export function encodeWrappedDataKey(kekId: string, wrapped: Buffer): Buffer {
  assertKekId(kekId);
  const id = Buffer.from(kekId, 'utf8');
  return Buffer.concat([Buffer.of(DATA_KEY_FORMAT_V1, id.length), id, wrapped]);
}

export function decodeWrappedDataKey(blob: Uint8Array): { kekId: string; wrapped: Buffer } {
  const buf = Buffer.from(blob);
  if (buf.length < 3) {
    throw new PiiCryptoError('INVALID_FORMAT', 'DEK cifrada curta demais.');
  }
  if (buf[0] !== DATA_KEY_FORMAT_V1) {
    throw new PiiCryptoError('UNSUPPORTED_VERSION', 'Versão de formato da DEK não suportada.');
  }
  const idLength = buf[1] ?? 0;
  if (idLength === 0 || buf.length <= 2 + idLength) {
    throw new PiiCryptoError('INVALID_FORMAT', 'DEK cifrada malformada.');
  }
  const kekId = buf.subarray(2, 2 + idLength).toString('utf8');
  assertKekId(kekId);
  return { kekId, wrapped: buf.subarray(2 + idLength) };
}

/** Lê só a versão de formato de um campo cifrado (para migrações futuras). */
export function fieldFormatVersion(ciphertext: Uint8Array): number {
  const version = ciphertext[0];
  if (version === undefined) {
    throw new PiiCryptoError('INVALID_FORMAT', 'Campo cifrado vazio.');
  }
  return version;
}
