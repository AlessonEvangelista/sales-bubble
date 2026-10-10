import 'reflect-metadata';
import { Writable } from 'node:stream';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Module,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { findPii } from '@bolha/observability';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiLogger, setupObservability } from './observability.js';

/**
 * Teste de contrato de logs sem PII (CT-049 / SEC-05, ADR-0012 item 4): sobe a aplicação Nest
 * com a observabilidade real, simula cadastro, login e webhook com PII no corpo, na query,
 * nos cabeçalhos e nas mensagens de erro, e falha se algum e-mail/CPF/CNPJ/JWT aparecer no log.
 */
const EMAIL = 'ana.souza@exemplo.com.br';
const CPF = '529.982.247-25';
const CNPJ = '11.222.333/0001-81';
// JWT fictício montado em tempo de execução (um literal seria apontado pelo gitleaks).
const JWT = [
  Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url'),
  Buffer.from('{"sub":"u-1","email":"m@x.com"}').toString('base64url'),
  'c2lnbmF0dXJh',
].join('.');

@Controller('test')
class PiiController {
  private readonly logger = new Logger('identity');

  @Post('register')
  @HttpCode(201)
  register(@Body() body: Record<string, unknown>): { id: string } {
    // Código descuidado: loga o corpo inteiro e uma mensagem com PII.
    this.logger.log({ event: 'identity.register.received', body, payload: body });
    this.logger.log(`cadastro recebido de ${String(body.email)} documento ${String(body.cpf)}`);
    return { id: 'u-1' };
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }): never {
    // Erro inesperado (500) com PII na mensagem: vai para o log do Nest e do interceptor.
    // (Senha em texto livre não tem padrão detectável: nunca a interpole em mensagens.)
    this.logger.debug({ event: 'identity.login.attempt', credentials: body });
    throw new Error(`falha de login para ${body.email}`);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() body: Record<string, unknown>): { ok: true } {
    this.logger.warn({ event: 'webhook.received', raw: JSON.stringify(body) });
    return { ok: true };
  }

  @Get('profile')
  profile(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [PiiController] })
class TestModule {}

const lines: string[] = [];
const destination = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    lines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
    callback();
  },
});

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  app = await NestFactory.create(TestModule, { bufferLogs: true });
  const env = {
    APP_ENV: 'ci',
    APP_VERSION: 'test',
    LOG_LEVEL: 'debug',
    SENTRY_DSN: undefined,
  } as const;
  setupObservability(app, env, createApiLogger(env, destination));
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/api/v1/test/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('observabilidade da API (logs estruturados sem PII)', () => {
  it('cadastro, login e webhook com PII não vazam nada para o log', async () => {
    const register = await post(
      `register?email=${encodeURIComponent(EMAIL)}`,
      { email: EMAIL, cpf: CPF, cnpj: CNPJ, phone: '+55 11 91234-5678', password: 'S3nh@forte' },
      { authorization: `Bearer ${JWT}`, cookie: `bv_rt=${JWT}`, 'x-request-id': 'req-abc' },
    );
    expect(register.status).toBe(201);
    expect(register.headers.get('x-request-id')).toBe('req-abc');

    const login = await post('login', { email: EMAIL, password: 'S3nh@forte' });
    expect(login.status).toBe(500);

    const webhook = await post('webhook', { customer: { email: EMAIL, document: CNPJ } });
    expect(webhook.status).toBe(200);

    // O log de acesso é emitido no `finish` da resposta.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const raw = lines.join('\n');
    expect(lines.length).toBeGreaterThan(5);
    expect(findPii(raw)).toEqual([]);
    expect(raw).not.toMatch(/S3nh@forte|91234-5678|bv_rt=/);
  });

  it('cada linha é JSON com os campos fixos e o request_id da requisição', async () => {
    const response = await fetch(`${baseUrl}/api/v1/test/profile`);
    expect(response.status).toBe(200);
    const requestId = response.headers.get('x-request-id');
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    for (const entry of entries) {
      expect(entry).toMatchObject({ service: 'bolha-api', env: 'ci', version: 'test' });
      expect(typeof entry.time).toBe('string');
      expect(typeof entry.level).toBe('string');
    }
    const access = entries.find(
      (entry) => entry.event === 'http.request.completed' && entry.request_id === requestId,
    );
    expect(access).toMatchObject({
      level: 'info',
      http: { method: 'GET', path: '/api/v1/test/profile', status_code: 200 },
    });
    const failure = entries.find((entry) => entry.event === 'http.request.failed');
    expect(failure).toMatchObject({ level: 'error', err: { type: 'Error' } });
  });
});
