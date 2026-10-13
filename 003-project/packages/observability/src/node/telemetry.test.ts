import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { trace } from '@opentelemetry/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findPii } from '../index.js';
import { shutdownTelemetry, startTelemetry } from './telemetry.js';

/**
 * Exportação OTLP/HTTP de ponta a ponta contra um coletor falso (servidor HTTP local que guarda
 * os corpos recebidos) — sem subir o profile `obs` do compose. Arquivo próprio porque o
 * `NodeSDK` registra providers globais (o vitest isola cada arquivo).
 */
interface Received {
  path: string;
  body: string;
}

const received: Received[] = [];
let collector: Server;
let endpoint: string;

beforeAll(async () => {
  collector = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      received.push({ path: req.url ?? '', body: Buffer.concat(chunks).toString('utf8') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(collector.address() as AddressInfo).port}/`;
});

afterAll(async () => {
  await shutdownTelemetry();
  await new Promise<void>((resolve) => collector.close(() => resolve()));
});

describe('startTelemetry + coletor OTLP falso', () => {
  it('exporta spans com service.name/version/ambiente e sem PII nos atributos', async () => {
    const handle = startTelemetry({
      serviceName: 'bolha-worker',
      serviceVersion: '9.9.9',
      environment: 'ci',
      otlpEndpoint: endpoint,
      metricExportIntervalMs: 60_000,
    });
    expect(handle.enabled).toBe(true);
    // Idempotente: uma segunda chamada devolve o mesmo handle.
    expect(
      startTelemetry({ serviceName: 'bolha-api', serviceVersion: 'x', environment: 'ci' }),
    ).toBe(handle);

    trace.getTracer('test').startActiveSpan('bubble.expire', (span) => {
      span.setAttributes({
        'bubble.id': 'b-42',
        'account.email': 'carla@exemplo.com',
        note: 'CPF 529.982.247-25',
      });
      span.end();
    });

    // shutdown força o flush do BatchSpanProcessor e do leitor de métricas.
    await shutdownTelemetry();

    const traces = received.filter((r) => r.path === '/v1/traces');
    expect(traces.length).toBeGreaterThan(0);
    const body = traces.map((r) => r.body).join('\n');
    expect(body).toContain('bubble.expire');
    expect(body).toContain('bolha-worker');
    expect(body).toContain('9.9.9');
    expect(body).toContain('b-42');
    expect(findPii(body)).toEqual([]);
    expect(received.some((r) => r.path === '/v1/metrics')).toBe(true);
  });
});
