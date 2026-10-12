import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountType, Role as RoleSchema } from '@bolha/contracts';
import type { z } from 'zod';
import { ProblemException } from '../../../http/problem.js';
import { IS_PUBLIC_KEY, type AuthenticatedRequest } from './auth.guard.js';

export type Role = z.infer<typeof RoleSchema>;

export const ROLES_KEY = 'auth:roles';
export const ACCOUNT_TYPES_KEY = 'auth:accountTypes';

/** Papéis aceitos na rota (api-rest §1.2: `user`, `moderator`, `admin`). */
export const Roles = (...roles: Role[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

/** Tipos de conta aceitos na rota (ex.: só PJ dá lance — Spec §2). */
export const AccountTypes = (...types: AccountType[]): CustomDecorator<string> =>
  SetMetadata(ACCOUNT_TYPES_KEY, types);

/**
 * Autorização por perfil no servidor (US-008). Usar depois do `AuthGuard`:
 * `@UseGuards(AuthGuard, RolesGuard)`. Sem usuário autenticado → 401; perfil fora do
 * permitido → `403 FORBIDDEN`. Rota sem `@Roles`/`@AccountTypes` aceita qualquer autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const types = this.reflector.getAllAndOverride<AccountType[] | undefined>(
      ACCOUNT_TYPES_KEY,
      targets,
    );
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new ProblemException('UNAUTHENTICATED');

    const roleOk = !roles?.length || roles.includes(user.role.toLowerCase() as Role);
    const typeOk = !types?.length || types.includes(user.account_type as AccountType);
    if (!roleOk || !typeOk) throw new ProblemException('FORBIDDEN');
    return true;
  }
}
