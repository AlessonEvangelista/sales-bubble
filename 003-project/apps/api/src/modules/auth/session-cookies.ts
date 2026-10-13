import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { ProblemException } from '../../http/problem.js';

/**
 * Cookies da sessão (api-rest §1.2; OWASP Session Management Cheat Sheet):
 * - `__Host-bv_rt`: refresh token — HttpOnly, Secure, SameSite=Strict, Path=/, sem Domain
 *   (o prefixo `__Host-` obriga o navegador a respeitar esses atributos);
 * - `bv_csrf`: token do double-submit, legível pelo front (não HttpOnly), que o devolve em
 *   `X-CSRF-Token` no `POST /auth/refresh` e `POST /auth/logout`.
 */
export const REFRESH_COOKIE = '__Host-bv_rt';
export const CSRF_COOKIE = 'bv_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

const BASE: CookieOptions = { secure: true, sameSite: 'strict', path: '/' };

export function setSessionCookies(res: Response, refreshToken: string): void {
  const maxAge = REFRESH_TTL_SECONDS * 1000;
  res.cookie(REFRESH_COOKIE, refreshToken, { ...BASE, httpOnly: true, maxAge });
  res.cookie(CSRF_COOKIE, randomBytes(32).toString('base64url'), {
    ...BASE,
    httpOnly: false,
    maxAge,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...BASE, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...BASE, httpOnly: false });
}

/**
 * Lê o refresh token exigindo o double-submit do CSRF. Sem cookie → `401 UNAUTHENTICATED`;
 * cabeçalho ausente ou diferente do cookie → `403 FORBIDDEN`.
 */
export function readRefreshToken(req: Request): string {
  const cookies = (req.cookies ?? {}) as Record<string, unknown>;
  const refresh = cookies[REFRESH_COOKIE];
  if (typeof refresh !== 'string' || refresh.length === 0) {
    throw new ProblemException('UNAUTHENTICATED');
  }
  const cookie = cookies[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (typeof cookie !== 'string' || !header || !safeEqual(cookie, header)) {
    throw new ProblemException('FORBIDDEN', { detail: 'Token CSRF ausente ou inválido.' });
  }
  return refresh;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
