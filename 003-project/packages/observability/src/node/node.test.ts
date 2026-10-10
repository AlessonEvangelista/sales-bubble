import { Writable } from 'node:stream';
import { context, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { findPii, REDACTED } from '../index.js';
import {
  captureError,
  consumeWithTraceContext,
  createLogger,
  flushSentry,
  initSentry,
  RedactingSpanProcessor,
  resolveRequestId,
  runWithRequestContext,
  startTelemetry,
  withTraceContext,
} from './index.js';

const EMAIL = 'joao.pereira@exemplo.com';
const CPF = '529.982.247-25';
const CNPJ = '11.222.333/0001-81';

const exporter = new InMemorySpanExporter();
const tracer = () => trace.getTracer('test');

beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({
      spanProcessors: [new RedactingSpanProcessor(new SimpleSpanProcessor(exporter))],
    }),
  );
});

afterAll(() => {
  trace.disable();
  propagation.disable();
  context.disable();
});

beforeEach(() => exporter.reset());

/** Destino em memória: cada linha JSON emitida pelo pino. */
function memoryDestination() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
      callback();
    },
  });
  return {
    stream,
    lines,
    json: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const loggerConfig = { service: 'bolha-api', env: 'ci', version: '1.2.3', level: 'debug' } as const;

describe('createLogger (pino estruturado sem PII)', () => {
  it('emite JSON com os campos fixos e correlação trace/request', () => {
    const out = memoryDestination();
    const logger = createLogger(loggerConfig, out.stream);

    tracer().startActiveSpan('quota.acquire', (span) => {
      runWithRequestContext({ requestId: 'req-123' }, () => {
        logger.info({ event: 'quota.acquire.rejected', module: 'bubble' }, 'cota recusada');
      });
      span.end();
    });

    const [line] = out.json();
    const spanContext = exporter.getFinishedSpans()[0]!.spanContext();
    expect(line).toMatchObject({
      level: 'info',
      service: 'bolha-api',
      env: 'ci',
      version: '1.2.3',
      event: 'quota.acquire.rejected',
      module: 'bubble',
      msg: 'cota recusada',
      request_id: 'req-123',
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
    });
    expect(typeof line!.time).toBe('string');
    expect(new Date(line!.time as string).toISOString()).toBe(line!.time);
  });

  it('não vaza PII por campo, por texto, em erros nem em cabeçalhos (CT-049)', () => {
    const out = memoryDestination();
    const logger = createLogger(loggerConfig, out.stream);

    logger.info({ email: EMAIL, cpf: CPF, account: { document: CNPJ, phone: '11 91234-5678' } });
    logger.info(`novo cadastro ${EMAIL} com CPF ${CPF}`);
    logger.info('interpolado %s', `${EMAIL}`);
    logger.warn({ req: { headers: { authorization: 'Bearer abcdefghij123', cookie: 'bv_rt=x' } } });
    logger.error({ err: new Error(`falha ao validar CNPJ ${CNPJ} de ${EMAIL}`) }, 'erro');
    logger.error(new Error(`erro direto para ${EMAIL}`));
    logger.info({ body: { password: 'segredo', email: EMAIL } }, 'webhook recebido');
    logger.info({ deep: { a: { b: { c: { refreshToken: 'rt-1', note: `cpf ${CPF}` } } } } });

    const raw = out.lines.join('\n');
    expect(out.lines).toHaveLength(8);
    expect(findPii(raw)).toEqual([]);
    expect(raw).not.toMatch(/segredo|rt-1|bv_rt=x|abcdefghij123|91234-5678/);
    expect(raw).toContain(REDACTED);
    const errorLine = out.json()[4]!;
    expect(errorLine.err).toMatchObject({ type: 'Error' });
    expect(String((errorLine.err as { stack: string }).stack)).toContain('node.test');
  });
});

describe('RedactingSpanProcessor (spans sem PII)', () => {
  it('remove PII de atributos, eventos, exceções e status antes de exportar', () => {
    tracer().startActiveSpan('identity.register', (span) => {
      span.setAttributes({
        'account.id': 'u-1',
        'account.email': EMAIL,
        'http.request.header.authorization': 'Bearer abc',
        'url.full': `https://api/x?cpf=${CPF}`,
      });
      span.addEvent('validation', { reason: `CPF ${CPF} inválido` });
      span.recordException(new Error(`e-mail ${EMAIL} já cadastrado`));
      span.setStatus({ code: 2, message: `conflito ${EMAIL}` });
      span.end();
    });

    const [span] = exporter.getFinishedSpans();
    expect(span!.attributes).toEqual({
      'account.id': 'u-1',
      'account.email': REDACTED,
      'http.request.header.authorization': REDACTED,
      'url.full': `https://api/x?cpf=${REDACTED}`,
    });
    expect(findPii(JSON.stringify({ e: span!.events, s: span!.status }))).toEqual([]);
  });
});

describe('propagação HTTP → fila → worker', () => {
  it('o job continua o trace da requisição que o enfileirou (traceparent em _otel)', async () => {
    let jobData: unknown;
    let producerTraceId = '';
    let producerSpanId = '';
    tracer().startActiveSpan('POST /api/v1/bubbles/:id/quotas', (span) => {
      producerTraceId = span.spanContext().traceId;
      producerSpanId = span.spanContext().spanId;
      // Serializado como o BullMQ grava no Redis.
      jobData = JSON.parse(JSON.stringify(withTraceContext({ bubbleId: 'b-1' })));
      span.end();
    });

    expect(jobData).toMatchObject({
      bubbleId: 'b-1',
      _otel: { traceparent: expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/) },
    });

    // "Worker": outro ponto de execução, sem contexto ativo.
    const seen = await context.with(ROOT_CONTEXT, () =>
      consumeWithTraceContext(
        jobData as { _otel?: { traceparent?: string } },
        { spanName: 'bubble-expire process', queue: 'bubble-expire' },
        () => trace.getActiveSpan()!.spanContext().traceId,
      ),
    );

    expect(seen).toBe(producerTraceId);
    const consumer = exporter.getFinishedSpans().find((s) => s.name === 'bubble-expire process')!;
    expect(consumer.spanContext().traceId).toBe(producerTraceId);
    expect(consumer.parentSpanContext?.spanId).toBe(producerSpanId);
    expect(consumer.attributes['messaging.destination.name']).toBe('bubble-expire');
  });

  it('sem span ativo não grava _otel; consumidor abre trace novo e marca erro', async () => {
    expect(withTraceContext({ a: 1 })).toEqual({ a: 1 });
    await expect(
      consumeWithTraceContext(undefined, { spanName: 'job' }, () => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');
    const [span] = exporter.getFinishedSpans();
    expect(span!.status.code).toBe(2);
    expect(span!.parentSpanContext).toBeUndefined();
  });
});

describe('request id', () => {
  it('reaproveita X-Request-Id seguro e gera UUID para valores inválidos', () => {
    expect(resolveRequestId('abc-123')).toBe('abc-123');
    expect(resolveRequestId(['lb:1', 'x'])).toBe('lb:1');
    expect(resolveRequestId(`${EMAIL}`)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId('x'.repeat(200))).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('startTelemetry', () => {
  it('fica desligado sem endpoint OTLP ou com OTEL_SDK_DISABLED (default seguro)', async () => {
    const handle = startTelemetry({
      serviceName: 'bolha-api',
      serviceVersion: 'dev',
      environment: 'ci',
      otlpEndpoint: undefined,
    });
    expect(handle.enabled).toBe(false);
    await handle.shutdown();
  });
});

describe('Sentry (Node)', () => {
  it('sem DSN não inicializa e captureError é no-op', () => {
    expect(initSentry({ environment: 'ci', release: 'dev', service: 'bolha-api' })).toBe(false);
    expect(() => captureError(new Error('x'))).not.toThrow();
  });

  it('com DSN, o evento enviado não contém PII e leva o trace_id', async () => {
    const envelopes: string[] = [];
    initSentry({
      dsn: 'https://public@o0.ingest.sentry.example/1',
      environment: 'ci',
      release: '1.2.3',
      service: 'bolha-api',
      transport: () => ({
        send: (envelope) => {
          envelopes.push(JSON.stringify(envelope));
          return Promise.resolve({ statusCode: 200 });
        },
        flush: () => Promise.resolve(true),
      }),
    });

    let traceId = '';
    tracer().startActiveSpan('POST /api/v1/accounts', (span) => {
      traceId = span.spanContext().traceId;
      captureError(new Error(`cadastro falhou para ${EMAIL} (CPF ${CPF})`), { route: 'accounts' });
      span.end();
    });
    await flushSentry();

    const sent = envelopes.join('\n');
    expect(sent).toContain('cadastro falhou para');
    expect(findPii(sent)).toEqual([]);
    expect(sent).toContain(traceId);
  });
});
