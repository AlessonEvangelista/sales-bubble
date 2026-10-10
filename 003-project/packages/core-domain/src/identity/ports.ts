import type { Result } from '../shared/result.js';
import type { Cnpj } from './cnpj.js';

/** Situação cadastral normalizada (ADR-0008 item 3). Só `ATIVA` ativa a conta PJ (Spec F1). */
export type CnpjSituation = 'ATIVA' | 'SUSPENSA' | 'INAPTA' | 'BAIXADA' | 'NULA';

export type CnpjProvider = 'BRASILAPI' | 'RECEITAWS' | 'FAKE';

export interface CnpjRegistration {
  readonly cnpj: Cnpj;
  readonly situation: CnpjSituation;
  readonly legalName: string;
  /** CNAE principal (código). */
  readonly mainCnae: string;
  /** Provedor que respondeu (vai para `company_profiles`). */
  readonly provider: CnpjProvider;
  /** `cnpj_checked_at` — instante da consulta, vindo do `Clock`. */
  readonly checkedAt: Date;
}

/**
 * Falhas esperadas da consulta:
 * - `NOT_FOUND`: o CNPJ não existe na base do provedor → cadastro bloqueado;
 * - `PROVIDER_UNAVAILABLE`: primário e fallback fora (timeout/circuit breaker) → a conta fica
 *   `PENDING_VERIFICATION`, com novas tentativas a cada 15 min por 24 h (ADR-0008 item 5).
 */
export type CnpjLookupFailure =
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'PROVIDER_UNAVAILABLE'; readonly reason: string };

/**
 * Porta `CnpjPort` (`CnpjLookupPort` no ADR-0008): "consultar a situação cadastral".
 * Adapters (fora do domínio): `BrasilApiCnpjAdapter` (primário), `ReceitaWsCnpjAdapter`
 * (fallback), compostos por `FallbackCnpjLookup` com timeout de 3 s e circuit breaker; cache
 * Redis de 24 h. Fake: `FakeCnpjPort` (`@bolha/core-domain/testing`, `CNPJ_PROVIDER=fake`).
 *
 * Recebe um `Cnpj` já validado (dígito verificador checado localmente).
 */
export interface CnpjPort {
  lookup(cnpj: Cnpj): Promise<Result<CnpjRegistration, CnpjLookupFailure>>;
}

/** Nome usado no ADR-0008. */
export type CnpjLookupPort = CnpjPort;
