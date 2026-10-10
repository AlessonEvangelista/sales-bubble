import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import {
  checkReadiness,
  READINESS_PROBES,
  type ReadinessProbes,
  type ReadinessReport,
} from './readiness.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(READINESS_PROBES) private readonly probes: ReadinessProbes) {}

  /** Liveness: o processo está de pé (não consulta dependências). */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: Postgres e Redis respondem; 503 com o mesmo corpo se algum estiver fora. */
  @Get('ready')
  async ready(): Promise<ReadinessReport> {
    const report = await checkReadiness(this.probes);
    if (report.status !== 'ok') {
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
