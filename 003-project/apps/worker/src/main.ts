import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PinoNestLogger } from '@bolha/observability/node';
import { loadDotEnv, parseWorkerEnv } from './config/env.js';
import { createWorkerLogger, initWorkerSentry } from './observability/observability.js';
import { WorkerModule } from './worker.module.js';

/**
 * Processo `worker` do monólito modular (ADR-0001): mesmo código de módulos da API,
 * iniciado sem servidor HTTP. Processadores BullMQ, relay do outbox e reconciliador
 * (ADR-0010, ADR-0011) entram nas histórias correspondentes. O OpenTelemetry já foi
 * iniciado pelo `--import ./dist/otel.js` (BV-108); jobs usam `consumeWithTraceContext`
 * de `@bolha/observability/node` para continuar o trace da requisição que os enfileirou.
 */
async function bootstrap(): Promise<void> {
  // Valida o ambiente antes de subir (o env tipado passa a ser injetado com as filas BullMQ).
  loadDotEnv();
  const env = parseWorkerEnv();
  initWorkerSentry(env);
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(new PinoNestLogger(createWorkerLogger(env)));
  app.enableShutdownHooks();
  // Enquanto não há filas BullMQ mantendo o processo vivo, segura o event loop.
  const keepAlive = setInterval(() => undefined, 60_000);
  process.once('SIGTERM', () => clearInterval(keepAlive));
  process.once('SIGINT', () => clearInterval(keepAlive));
}

void bootstrap();
