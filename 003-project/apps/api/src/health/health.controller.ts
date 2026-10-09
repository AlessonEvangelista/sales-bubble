import { Controller, Get } from '@nestjs/common';

/**
 * Liveness mínimo do walking skeleton. A prontidão com checagem de Postgres e Redis
 * (`/health/ready`) depende da infraestrutura local (BV-102) e entra depois.
 */
@Controller('health')
export class HealthController {
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
