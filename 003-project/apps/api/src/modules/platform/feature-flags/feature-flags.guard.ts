import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureFlags, FlagContext, FlagKey } from '@bolha/contracts';
import { ALLOW_IN_MAINTENANCE_METADATA, FEATURE_GATE_METADATA } from './feature-gate.decorator.js';
import { FeatureDisabledException } from './feature-disabled.exception.js';
import { FEATURE_FLAGS } from './tokens.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  /** Preenchido pelo guard de autenticação (onda 2). Só id, tipo e papéis — nunca PII. */
  user?: { id?: unknown; accountType?: unknown; roles?: unknown };
}

/** Contexto de avaliação a partir do usuário autenticado, se houver. */
export function flagContextFromRequest(request: RequestLike): FlagContext | undefined {
  const user = request.user;
  if (!user) return undefined;
  const ctx: FlagContext = {};
  if (typeof user.id === 'string') ctx.accountId = user.id;
  if (user.accountType === 'PF' || user.accountType === 'PJ') ctx.accountType = user.accountType;
  if (Array.isArray(user.roles)) {
    ctx.roles = user.roles.filter((role): role is string => typeof role === 'string');
  }
  return ctx;
}

/**
 * Guard global de flags (registrado como APP_GUARD pelo `FeatureFlagsModule`):
 * 1. `maintenance_mode` ligada → toda escrita (POST/PUT/PATCH/DELETE) → 503, exceto rotas com
 *    `@AllowInMaintenance()`; leituras seguem (canvas só leitura — plano de release §3);
 * 2. `@FeatureGate(...)` → cada flag listada precisa estar ligada.
 */
@Injectable()
export class FeatureFlagsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<RequestLike>();
    const targets = [context.getHandler(), context.getClass()];
    const instance = request.originalUrl ?? request.url;
    const ctx = flagContextFromRequest(request);

    const method = (request.method ?? 'GET').toUpperCase();
    if (
      WRITE_METHODS.has(method) &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_IN_MAINTENANCE_METADATA, targets) &&
      (await this.flags.isEnabled('maintenance_mode', ctx))
    ) {
      throw new FeatureDisabledException('maintenance_mode', instance);
    }

    const required = this.reflector.getAllAndMerge<FlagKey[]>(FEATURE_GATE_METADATA, targets);
    for (const key of required ?? []) {
      if (!(await this.flags.isEnabled(key, ctx))) {
        throw new FeatureDisabledException(key, instance);
      }
    }
    return true;
  }
}
