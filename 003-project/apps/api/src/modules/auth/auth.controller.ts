import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  PipeTransform,
  BadRequestException,
} from '@nestjs/common';
import {
  RegisterPfRequest,
  GENERIC_REGISTER_RESPONSE,
  type RegisterAcceptedResponse,
} from '@bolha/contracts';
import { AuthService } from './auth.service.js';

class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: { safeParse: (data: unknown) => { success: boolean; data?: any; error?: any } }) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        errors: result.error.issues,
      });
    }
    return result.data;
  }
}

type RegisterPfPayload = typeof RegisterPfRequest._output;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ZodValidationPipe(RegisterPfRequest))
  async register(@Body() body: RegisterPfPayload): Promise<RegisterAcceptedResponse> {
    return this.authService.registerPf(body);
  }
}
