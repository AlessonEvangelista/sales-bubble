import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { ProblemException } from '../../../http/problem.js';
import { TokenService, type TokenPayload } from '../token.service.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Rota aberta a visitantes num controller protegido (ex.: `GET /bubbles`). */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Exige `Authorization: Bearer <access token>` válido (RS256). Ausente/inválido →
 * `401 UNAUTHENTICATED`; expirado → `401 TOKEN_EXPIRED` (o front então chama o refresh).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new ProblemException('UNAUTHENTICATED');
    try {
      request.user = this.tokens.verifyAccessToken(header.slice('Bearer '.length));
      return true;
    } catch (error) {
      throw new ProblemException(
        error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED',
      );
    }
  }
}
