import { Module } from '@nestjs/common';
import { ObservabilityModule } from './observability/observability.js';
import { WorkerStatus } from './worker-status.js';

/** Módulo raiz do worker. Os processadores de fila serão registrados aqui. */
@Module({
  imports: [ObservabilityModule],
  providers: [WorkerStatus],
})
export class WorkerModule {}
