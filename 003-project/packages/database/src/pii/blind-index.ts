import { createHmac, timingSafeEqual } from 'node:crypto';
import { PiiCryptoError } from './errors.js';
import type { KeyProvider } from './key-provider.js';

/**
 * Tipos de valor com hash de busca/unicidade (modelo-dados §3.8). O tipo entra no HMAC como
 * separação de domínio: o mesmo texto em campos diferentes gera hashes diferentes.
 */
export type PiiHashKind = 'email' | 'document' | 'oauth_subject' | 'ip';

const DOCUMENT_SEPARATORS = /[\s.\-/]/g;
const DOCUMENT_ALLOWED = /^[0-9A-Z]{11,14}$/;

/**
 * Normalização antes do HMAC (modelo-dados §3.1/§3.8):
 * - `email`: `lower(trim())` (com NFC antes, para que formas Unicode equivalentes coincidam);
 * - `document`: CPF/CNPJ sem pontuação (`.`, `-`, `/`, espaços). Mantém letras maiúsculas para o
 *   CNPJ alfanumérico (IN RFB 2.229/2024, emissão a partir de jul/2026); CPF fica só com dígitos;
 * - `oauth_subject`: `trim()` (o `sub` do Google diferencia maiúsculas);
 * - `ip`: `trim()` + minúsculas (IPv6). Truncamento do IP, se houver, é feito pelo chamador.
 *
 * Validação de dígito verificador NÃO é feita aqui (é regra de domínio, no value object).
 * Erros nunca incluem o valor.
 */
export function normalizeForHash(kind: PiiHashKind, value: string): string {
  let normalized: string;
  switch (kind) {
    case 'email':
      normalized = value.normalize('NFC').trim().toLowerCase();
      break;
    case 'document':
      normalized = value.normalize('NFC').replace(DOCUMENT_SEPARATORS, '').toUpperCase();
      if (!DOCUMENT_ALLOWED.test(normalized)) {
        throw new PiiCryptoError('INVALID_INPUT', 'Documento em formato inválido para o hash.');
      }
      break;
    case 'oauth_subject':
      normalized = value.trim();
      break;
    case 'ip':
      normalized = value.trim().toLowerCase();
      break;
  }
  if (normalized.length === 0 || normalized.length > 512) {
    throw new PiiCryptoError(
      'INVALID_INPUT',
      `Valor vazio ou grande demais para o hash (${kind}).`,
    );
  }
  return normalized;
}

export interface BlindIndexValue {
  /** Versão do *pepper* (gravar em `pii_key_version`). */
  readonly version: number;
  /** HMAC-SHA256 (32 bytes) para a coluna `*_hash bytea`. */
  readonly hash: Buffer;
}

/**
 * HMAC-SHA256 determinístico para busca e unicidade (ADR-0012 item 2): mesmo valor normalizado +
 * mesma versão de chave → mesmo hash. Com chave secreta (não é SHA-256 puro), o espaço de CPFs
 * (~10⁹) não pode ser enumerado offline sem a chave (threat-model TM-06).
 *
 * Entrada do HMAC: `bv:pii:<kind>:v1\0<valor normalizado>`.
 */
export class HmacBlindIndex {
  readonly #provider: KeyProvider;

  constructor(provider: KeyProvider) {
    this.#provider = provider;
  }

  /** Hash com a versão ativa (gravação) ou com uma versão específica. */
  async hash(kind: PiiHashKind, value: string, version?: number): Promise<BlindIndexValue> {
    const v = version ?? this.#provider.activeHmacVersion;
    const key = await this.#provider.hmacKey(v);
    const hash = createHmac('sha256', key)
      .update(`bv:pii:${kind}:v1\0`, 'utf8')
      .update(normalizeForHash(kind, value), 'utf8')
      .digest();
    return { version: v, hash };
  }

  /**
   * Hashes do valor em todas as versões de chave disponíveis (ativa primeiro). Durante a rotação do
   * *pepper*, a busca usa `WHERE email_hash = ANY($1)` até o recálculo em lote terminar.
   */
  async lookupCandidates(kind: PiiHashKind, value: string): Promise<BlindIndexValue[]> {
    const out: BlindIndexValue[] = [];
    for (const version of this.#provider.hmacVersions()) {
      out.push(await this.hash(kind, value, version));
    }
    return out;
  }

  toJSON(): Record<string, unknown> {
    return { adapter: 'HmacBlindIndex', activeVersion: this.#provider.activeHmacVersion };
  }
}

/** Comparação em tempo constante de hashes/tags (para comparações em memória). */
export function hashEquals(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
