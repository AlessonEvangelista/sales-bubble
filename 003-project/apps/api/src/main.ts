import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { API_BASE_PATH } from '@bolha/contracts';
import { AppModule } from './app.module.js';

/**
 * Processo `api` do monólito modular (ADR-0001): HTTP REST + (futuramente) gateway Socket.io.
 * A validação de variáveis de ambiente com Zod (`src/config/env.ts`) entra junto do
 * `.env.example` (BV-102).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_BASE_PATH.replace(/^\//, ''));
  app.enableShutdownHooks();
  const port = Number(process.env['API_PORT'] ?? 3001);
  await app.listen(port);
}

void bootstrap();
