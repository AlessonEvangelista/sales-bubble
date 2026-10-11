import {
  FEATURE_FLAGS,
  FLAG_KEYS,
  type FlagContext,
  type FlagKey,
  type FlagOverride,
  type FlagRules,
} from '@bolha/contracts';

/** Overrides em vigor, por chave (só as flags alteradas em runtime aparecem). */
export type FlagOverrides = Partial<Record<FlagKey, FlagOverride>>;

/** Valores-base: catálogo (default seguro) sobreposto por `FLAGS_DEFAULTS` do ambiente. */
export type FlagBaseline = Record<FlagKey, boolean>;

export function buildBaseline(envDefaults: Partial<Record<FlagKey, boolean>> = {}): FlagBaseline {
  return Object.fromEntries(
    FLAG_KEYS.map((key) => [key, envDefaults[key] ?? FEATURE_FLAGS[key].defaultEnabled]),
  ) as FlagBaseline;
}

function hasCriteria(rules: FlagRules | undefined): rules is FlagRules {
  return Boolean(rules?.accountIds?.length || rules?.accountTypes?.length || rules?.roles?.length);
}

function matches(rules: FlagRules, ctx: FlagContext | undefined): boolean {
  if (!ctx) return false;
  if (ctx.accountId && rules.accountIds?.includes(ctx.accountId)) return true;
  if (ctx.accountType && rules.accountTypes?.includes(ctx.accountType)) return true;
  if (ctx.roles?.some((role) => rules.roles?.includes(role))) return true;
  return false;
}

/**
 * Avalia uma flag. Precedência: override em runtime > `FLAGS_DEFAULTS` > catálogo.
 * Um override LIGADO com regras só vale para quem casa com alguma delas; sem contexto
 * (ex.: `GET /flags` anônimo, jobs do worker) a flag segmentada é avaliada como desligada.
 */
export function evaluateFlag(
  key: FlagKey,
  baseline: FlagBaseline,
  overrides: FlagOverrides,
  ctx?: FlagContext,
): boolean {
  const override = overrides[key];
  if (!override) return baseline[key];
  if (!override.enabled) return false;
  return hasCriteria(override.rules) ? matches(override.rules, ctx) : true;
}
