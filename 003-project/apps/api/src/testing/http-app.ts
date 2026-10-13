import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_BASE_PATH } from '@bolha/contracts';
import { AuthModule } from '../modules/auth/auth.module.js';
import { DatabaseModule } from '../modules/database/index.js';
import { createInMemoryPrisma, createTestPiiCrypto, type InMemoryDb } from './in-memory-prisma.js';

export interface TestApp {
  db: InMemoryDb;
  /** `fetch` relativo a `/api/v1`. */
  request(path: string, init?: RequestInit): Promise<Response>;
  close(): Promise<void>;
}

/** Sobe a API (módulo de auth) em porta efêmera, com banco em memória e PII real. */
export async function startAuthApp(): Promise<TestApp> {
  const { prisma, db } = createInMemoryPrisma();

  @Module({ imports: [DatabaseModule.forClients(prisma, createTestPiiCrypto()), AuthModule] })
  class TestAppModule {}

  const app: INestApplication = await NestFactory.create(TestAppModule, { logger: false });
  app.setGlobalPrefix(API_BASE_PATH.replace(/^\//, ''));
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}${API_BASE_PATH}`;

  return {
    db,
    request: (path, init) => fetch(`${base}${path}`, init),
    close: () => app.close(),
  };
}

export function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}
