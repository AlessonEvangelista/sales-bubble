import { z } from 'zod';

/**
 * Catálogo tipado de feature flags e kill switches (BV-113 / EN-033).
 *
 * Fontes: guia de desenvolvimento §9 ("toda flag nova entra em `packages/contracts/src/flags.ts`
 * com dono e data de remoção prevista. Flag sem dono reprova o PR") e plano de release §3
 * (tabela de kill switches: padrão, efeito quando desligada e quem pode acionar).
 *
 * Tipos (guia §9):
 * - `release`  — esconde funcionalidade incompleta; remover até 2 sprints depois de 100%;
 * - `ops`      — kill switch permanente, alterável por on-call sem deploy (efeito ≤ 10 s);
 * - `permission` — permissão/beta (allowlist do beta fechado).
 *
 * `defaultEnabled` é o valor SEGURO usado quando não há override (Redis/tabela) nem
 * `FLAGS_DEFAULTS` no ambiente. `public` indica se o valor é exposto em `GET /api/v1/flags`
 * (lido pelo front com `useFlag`). Flags internas (ex.: `captures_paused`) nunca vão ao front.
 *
 * Este arquivo só contém dados e tipos (o pacote `contracts` não importa nada além de `zod`);
 * a avaliação fica em `@bolha/database` (adapters) e o uso em `apps/*`.
 */

export const FLAG_KINDS = ['release', 'ops', 'permission'] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/** Quem pode acionar (plano de release §3, coluna "Quem pode acionar"). */
export const FLAG_TOGGLERS = [
  'on-call',
  'payments-owner',
  'tech-lead',
  'incident-commander',
] as const;
export type FlagToggler = (typeof FLAG_TOGGLERS)[number];

export interface FlagDefinition {
  readonly kind: FlagKind;
  /** Valor seguro na ausência de qualquer configuração. */
  readonly defaultEnabled: boolean;
  /** Exposto ao front em `GET /api/v1/flags`. */
  readonly public: boolean;
  /** Dono da flag (papel responsável — guia §9). */
  readonly owner: string;
  /** Data prevista de remoção (AAAA-MM-DD) ou `null` para flags de operação permanentes. */
  readonly removeBy: string | null;
  /** Quem pode alterar em produção. */
  readonly togglers: readonly FlagToggler[];
  /** O que acontece para o usuário quando a flag está DESLIGADA (ou ligada, se `inverted`). */
  readonly effect: string;
  /**
   * `true` quando a flag é um "freio" que age ao ser LIGADA (`captures_paused`,
   * `maintenance_mode`, `realtime_degraded_mode`, `beta_allowlist`).
   */
  readonly inverted?: boolean;
}

export const FEATURE_FLAGS = {
  bubble_creation_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: true,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['on-call'],
    effect:
      'Botão "Criar bolha" desabilitado com aviso; POST /bubbles e /publish → 503 problem+json.',
  },
  quota_acquisition_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: true,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['on-call'],
    effect: '"Entrar na bolha" desabilitado; bolhas ativas continuam e explodem normalmente.',
  },
  payments_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: true,
    owner: 'payments-owner',
    removeBy: null,
    togglers: ['on-call', 'payments-owner'],
    effect: 'Novas adesões e lances bloqueados; capturas e estornos continuam.',
  },
  pix_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: true,
    owner: 'payments-owner',
    removeBy: null,
    togglers: ['on-call'],
    effect: 'Só cartão disponível na adesão.',
  },
  card_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: true,
    owner: 'payments-owner',
    removeBy: null,
    togglers: ['on-call'],
    effect: 'Só Pix disponível.',
  },
  captures_paused: {
    kind: 'ops',
    defaultEnabled: false,
    public: false,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['tech-lead'],
    inverted: true,
    effect:
      'Quando LIGADA, capturas pós-explosão ficam em fila sem executar (respeitando a validade da pré-autorização).',
  },
  purchase_bubbles_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: true,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['on-call'],
    effect: 'Bolhas de compra e lances novos bloqueados.',
  },
  public_signup_enabled: {
    kind: 'ops',
    // Dark launch: v1.0.0 sobe com flags públicas fechadas; abertura em 01/03/2027 por flag.
    defaultEnabled: false,
    public: true,
    owner: 'product-owner',
    removeBy: null,
    togglers: ['on-call'],
    effect: 'Fecha o cadastro de novas contas.',
  },
  beta_allowlist: {
    kind: 'permission',
    // Beta fechado (16–26/02/2027): cadastro só por convite. Desligar na abertura pública.
    defaultEnabled: true,
    public: true,
    owner: 'product-owner',
    removeBy: '2027-03-29',
    togglers: ['on-call'],
    inverted: true,
    effect: 'Quando LIGADA, o cadastro fica restrito a convidados.',
  },
  realtime_degraded_mode: {
    kind: 'ops',
    defaultEnabled: false,
    public: true,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['on-call'],
    inverted: true,
    effect:
      'Quando LIGADA, agregação por bolha passa de 100 ms para 1 s e o cliente reduz rooms de tile.',
  },
  notifications_email_enabled: {
    kind: 'ops',
    defaultEnabled: true,
    public: false,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['on-call'],
    effect: 'Só notificações in-app.',
  },
  maintenance_mode: {
    kind: 'ops',
    defaultEnabled: false,
    public: true,
    owner: 'tech-lead',
    removeBy: null,
    togglers: ['incident-commander'],
    inverted: true,
    effect: 'Quando LIGADA, só leitura do canvas + banner; todas as escritas → 503.',
  },
} as const satisfies Record<string, FlagDefinition>;

export type FlagKey = keyof typeof FEATURE_FLAGS;

export const FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FlagKey[];

export const flagKeySchema = z.enum(FLAG_KEYS as [FlagKey, ...FlagKey[]]);

export type PublicFlagKey = {
  [K in FlagKey]: (typeof FEATURE_FLAGS)[K]['public'] extends true ? K : never;
}[FlagKey];

export const PUBLIC_FLAG_KEYS = FLAG_KEYS.filter(
  (key): key is PublicFlagKey => FEATURE_FLAGS[key].public,
);

export function isFlagKey(value: string): value is FlagKey {
  return Object.hasOwn(FEATURE_FLAGS, value);
}

/** Valores seguros do catálogo (sem override e sem `FLAGS_DEFAULTS`). */
export function catalogDefaults(): Record<FlagKey, boolean> {
  return Object.fromEntries(FLAG_KEYS.map((k) => [k, FEATURE_FLAGS[k].defaultEnabled])) as Record<
    FlagKey,
    boolean
  >;
}

// ---------------------------------------------------------------------------------------------
// Regras de segmentação (coluna `rules jsonb` proposta no guia §9)
// ---------------------------------------------------------------------------------------------

/**
 * Restringe uma flag LIGADA a parte dos usuários. Critérios combinados com OU: basta o contexto
 * casar com um deles. Sem critérios (ou `rules` ausente) → vale para todos.
 */
export const flagRulesSchema = z
  .object({
    accountIds: z.array(z.uuid()).max(1_000).optional(),
    accountTypes: z.array(z.enum(['PF', 'PJ'])).optional(),
    roles: z.array(z.string().min(1).max(64)).max(32).optional(),
  })
  .strict();

export type FlagRules = z.infer<typeof flagRulesSchema>;

/** Override persistido de uma flag (Redis hoje; tabela `feature_flags` quando existir). */
export const flagOverrideSchema = z.object({
  enabled: z.boolean(),
  rules: flagRulesSchema.optional(),
  updatedBy: z.string().min(1).max(128),
  updatedAt: z.iso.datetime(),
  reason: z.string().max(500).optional(),
});

export type FlagOverride = z.infer<typeof flagOverrideSchema>;

/** Contexto opcional de avaliação (usuário/perfil). Nunca carrega PII. */
export interface FlagContext {
  accountId?: string;
  accountType?: 'PF' | 'PJ';
  roles?: readonly string[];
}

/**
 * Porta de avaliação de flags para a camada de aplicação (guia §9: `flags.isEnabled('x', ctx)`
 * em casos de uso; nunca no core-domain). Implementações em `@bolha/database`.
 */
export interface FeatureFlags {
  isEnabled(key: FlagKey, ctx?: FlagContext): Promise<boolean>;
  /** Valores das flags públicas (para `GET /api/v1/flags`). */
  publicFlags(ctx?: FlagContext): Promise<PublicFlags>;
}

// ---------------------------------------------------------------------------------------------
// `FLAGS_DEFAULTS` (guia §3.3): "chave:true,chave:false"
// ---------------------------------------------------------------------------------------------

/**
 * Lê `FLAGS_DEFAULTS` (ex.: `bubble_creation_enabled:true,payments_enabled:false`).
 * Chave desconhecida ou valor diferente de true/false gera erro (o processo não sobe com
 * configuração inválida — mesma regra das demais variáveis).
 */
export function parseFlagDefaults(raw: string | undefined): Partial<Record<FlagKey, boolean>> {
  const result: Partial<Record<FlagKey, boolean>> = {};
  if (!raw?.trim()) return result;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [key, value, ...rest] = trimmed.split(':').map((part) => part.trim());
    if (!key || !isFlagKey(key) || rest.length > 0 || (value !== 'true' && value !== 'false')) {
      throw new Error(`FLAGS_DEFAULTS inválido na entrada "${trimmed}" (use chave:true|false).`);
    }
    result[key] = value === 'true';
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// `GET /api/v1/flags` (público)
// ---------------------------------------------------------------------------------------------

export const publicFlagsSchema = z.object(
  Object.fromEntries(PUBLIC_FLAG_KEYS.map((k) => [k, z.boolean()])) as Record<
    PublicFlagKey,
    z.ZodBoolean
  >,
);

export type PublicFlags = Record<PublicFlagKey, boolean>;

export const publicFlagsResponseSchema = z.object({
  flags: publicFlagsSchema,
  evaluated_at: z.iso.datetime(),
});

export type PublicFlagsResponse = z.infer<typeof publicFlagsResponseSchema>;

/** Valores seguros das flags públicas (fallback do front quando a API não responde). */
export function publicCatalogDefaults(): PublicFlags {
  return Object.fromEntries(
    PUBLIC_FLAG_KEYS.map((k) => [k, FEATURE_FLAGS[k].defaultEnabled]),
  ) as PublicFlags;
}

/** Caminho do endpoint público (relativo a `API_BASE_PATH`). */
export const FLAGS_PATH = '/flags' as const;
