/**
 * API pública do módulo `auth` (guia §2.2). Outros módulos protegem rotas com
 * `@UseGuards(AuthGuard, RolesGuard)` e `@Roles(...)` / `@AccountTypes(...)` / `@Public()`.
 */
export { AuthModule } from './auth.module.js';
export { AuthGuard, Public, type AuthenticatedRequest } from './guards/auth.guard.js';
export { AccountTypes, Roles, RolesGuard, type Role } from './guards/roles.guard.js';
export { TokenService, type TokenPayload } from './token.service.js';
