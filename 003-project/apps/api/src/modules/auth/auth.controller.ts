import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Ip, Post } from '@nestjs/common';
import { RegisterPfRequest, type RegisterAcceptedResponse } from '@bolha/contracts';
import { ZodValidationPipe } from '../../http/zod-validation.pipe.js';
import { AuthService, type RegisterPfPayload } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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
}
