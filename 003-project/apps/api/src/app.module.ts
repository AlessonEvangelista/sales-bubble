import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';

/**
 * Módulo raiz da API. Os módulos por bounded context (identity, bubble, bidding, …)
 * serão registrados aqui conforme as histórias forem implementadas.
 */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
