import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  LoginRequest,
  RegisterPfRequest,
  type RegisterAcceptedResponse,
  type SessionResponse,
} from '@bolha/contracts';
import { ZodValidationPipe } from '../../http/zod-validation.pipe.js';
import { AuthService, type RegisterPfPayload, type RequestMeta } from './auth.service.js';
import { SessionService, type LoginPayload } from './session.service.js';
import { clearSessionCookies, readRefreshToken, setSessionCookies } from './session-cookies.js';

export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  /** `POST /auth/register` (PF) → sempre `202` genérico (api-rest §2.1, SEC-08). */
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  register(
    @Body(new ZodValidationPipe(RegisterPfRequest)) body: RegisterPfPayload,
    @Ip() ip: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<RegisterAcceptedResponse> {
    return this.authService.registerPf(body, { ip, userAgent });
  }

  /** `POST /auth/login` → `200` + cookies de refresh e CSRF (US-004). */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequest)) body: LoginPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const { session, refreshToken } = await this.sessions.login(body, requestMeta(req));
    setSessionCookies(res, refreshToken);
    res.setHeader('Cache-Control', 'no-store');
    return session;
  }

  /** `POST /auth/refresh` — cookie de refresh + `X-CSRF-Token`; rotaciona o refresh (US-005). */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const raw = readRefreshToken(req);
    try {
      const { session, refreshToken } = await this.sessions.refresh(raw, requestMeta(req));
      setSessionCookies(res, refreshToken);
      res.setHeader('Cache-Control', 'no-store');
      return session;
    } catch (error) {
      clearSessionCookies(res);
      throw error;
    }
  }

  /** `POST /auth/logout` — revoga a família do refresh → `204`. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.logout(readRefreshToken(req));
    clearSessionCookies(res);
  }
}
