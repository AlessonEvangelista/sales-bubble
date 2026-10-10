import { Module } from '@nestjs/common';
import { WorkerStatus } from './worker-status.js';

/** Módulo raiz do worker. Os processadores de fila serão registrados aqui. */
@Module({
  providers: [WorkerStatus],
})
export class WorkerModule {}
