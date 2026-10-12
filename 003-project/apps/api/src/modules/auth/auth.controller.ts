import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RegisterPfRequest, type RegisterAcceptedResponse } from '@bolha/contracts';
import { ZodValidationPipe } from '../../http/zod-validation.pipe.js';
import { AuthService, type RegisterPfPayload, type RequestMeta } from './auth.service.js';

export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /** `POST /auth/register` (PF) → sempre `202` genérico (api-rest §2.1, SEC-08). */
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  register(
    @Body(new ZodValidationPipe(RegisterPfRequest)) body: RegisterPfPayload,
    @Req() req: Request,
  ): Promise<RegisterAcceptedResponse> {
    return this.authService.registerPf(body, requestMeta(req));
  }
}
