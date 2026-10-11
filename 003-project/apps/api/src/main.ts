import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { API_BASE_PATH } from '@bolha/contracts';
import { AppModule } from './app.module.js';
import { loadDotEnv, parseApiEnv } from './config/env.js';
import { API_SECRET_NAMES } from './config/secret-names.js';
import { resolveSecrets } from './config/secrets.js';
import { setupObservability } from './observability/observability.js';

/**
 * Processo `api` do monólito modular (ADR-0001): HTTP REST + (futuramente) gateway Socket.io.
 * O ambiente é validado antes de qualquer coisa: sem as variáveis obrigatórias a API não sobe.
 * O OpenTelemetry já foi iniciado pelo `--import ./dist/otel.js` (BV-108).
 */
async function bootstrap(): Promise<void> {
  loadDotEnv();
  // Segredos: em produção podem vir do secret manager (BV-110, gestao-segredos.md).
  const env = parseApiEnv(await resolveSecrets(API_SECRET_NAMES));
  const app = await NestFactory.create(AppModule.register(env), { bufferLogs: true });
  setupObservability(app, env);
  app.setGlobalPrefix(API_BASE_PATH.replace(/^\//, ''));
  app.enableShutdownHooks();
  await app.listen(env.API_PORT);
}

void bootstrap();
