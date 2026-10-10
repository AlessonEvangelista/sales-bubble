import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

/**
 * Processo `worker` do monólito modular (ADR-0001): mesmo código de módulos da API,
 * iniciado sem servidor HTTP. Processadores BullMQ, relay do outbox e reconciliador
 * (ADR-0010, ADR-0011) entram nas histórias correspondentes.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  // Enquanto não há filas BullMQ mantendo o processo vivo, segura o event loop.
  const keepAlive = setInterval(() => undefined, 60_000);
  process.once('SIGTERM', () => clearInterval(keepAlive));
  process.once('SIGINT', () => clearInterval(keepAlive));
}

void bootstrap();
