import { Module, type DynamicModule } from '@nestjs/common';
import type { ApiEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { FeatureFlagsModule } from './modules/platform/index.js';

/**
 * Módulo raiz da API. Os módulos por bounded context (identity, bubble, bidding, …)
 * serão registrados aqui conforme as histórias forem implementadas.
 */
@Module({})
export class AppModule {
  static register(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [HealthModule.register(env), FeatureFlagsModule.register(env)],
    };
  }
}
