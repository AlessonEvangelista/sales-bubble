import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { API_BASE_PATH } from '@bolha/contracts';
import type { ApiEnv } from '../config/env.js';

/**
 * Configuração HTTP comum à API e aos testes HTTP: prefixo `/api/v1`, leitura de cookies
 * (refresh e CSRF — BV-15) e `trust proxy` para `req.ip` ser o IP do cliente atrás do
 * balanceador (throttling por IP e hash de IP no aceite).
 */
export function configureHttpApp(
  app: NestExpressApplication,
  env: Pick<ApiEnv, 'TRUST_PROXY_HOPS'>,
): void {
  app.setGlobalPrefix(API_BASE_PATH.replace(/^\//, ''));
  app.use(cookieParser());
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
}
