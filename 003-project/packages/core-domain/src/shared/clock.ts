/**
 * Porta `Clock` (guia §5.4): o domínio nunca lê o relógio do sistema (`Date.now()`,
 * `new Date()`), o que torna expirações e prazos testáveis de forma determinística.
 * Adapter de produção: `SystemClock` (apps/*). Fake: `FixedClock` (`@bolha/core-domain/testing`).
 * Sempre UTC.
 */
export interface Clock {
  now(): Date;
}
