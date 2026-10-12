import 'reflect-metadata';
import { generateKeyPairSync } from 'node:crypto';
import { Module, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_BASE_PATH } from '@bolha/contracts';
import { configureHttpApp } from '../http/configure-app.js';
import { AuthModule } from '../modules/auth/index.js';
import { InMemoryThrottleStore } from '../modules/auth/login-throttle.js';
import type { JwtKeys } from '../modules/auth/token.service.js';
import { DatabaseModule } from '../modules/database/index.js';
import { createInMemoryPrisma, createTestPiiCrypto, type InMemoryDb } from './in-memory-prisma.js';

/** Par RS256 só de teste (gerado uma vez por processo). */
export const testJwtKeys = ((): JwtKeys => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey, publicKey, ttlSeconds: 900 };
})();

export interface TestAppOptions {
  /** Controllers extras (ex.: rotas fictícias da matriz de permissões). */
  controllers?: Type[];
  /** `false` = CAPTCHA recusado (padrão: aceita token não vazio, como `CAPTCHA_PROVIDER=none`). */
  captchaValid?: boolean;
}

export interface TestApp {
  db: InMemoryDb;
  /** `fetch` relativo a `/api/v1`. */
  request(path: string, init?: RequestInit): Promise<Response>;
  close(): Promise<void>;
}

/** Sobe a API (módulo de auth) em porta efêmera, com banco em memória e PII real. */
export async function startAuthApp(options: TestAppOptions = {}): Promise<TestApp> {
  const { prisma, db } = createInMemoryPrisma();
  const captchaValid = options.captchaValid ?? true;

  @Module({
    imports: [
      DatabaseModule.forClients(prisma, createTestPiiCrypto()),
      AuthModule.forTesting({
        keys: testJwtKeys,
        throttleStore: new InMemoryThrottleStore(),
        captcha: { verify: async (token) => captchaValid && token.length > 0 },
      }),
    ],
    controllers: options.controllers ?? [],
  })
  class TestAppModule {}

  const app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
  configureHttpApp(app, { TRUST_PROXY_HOPS: 0 });
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
