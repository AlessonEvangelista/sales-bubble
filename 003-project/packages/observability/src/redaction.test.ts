import { describe, expect, it } from 'vitest';
import {
  findPii,
  isSensitiveKey,
  REDACTED,
  redactAttributes,
  redactDeep,
  redactString,
  scrubBreadcrumb,
  scrubErrorEvent,
} from './index.js';

// Dados fictícios (CPF/CNPJ com dígito verificador válido, gerados para teste).
const EMAIL = 'maria.silva+teste@exemplo.com.br';
const CPF = '123.456.789-09';
const CPF_DIGITS = '12345678909';
const CNPJ = '11.222.333/0001-81';
const CNPJ_DIGITS = '11222333000181';
const PHONE = '+55 (11) 91234-5678';
// JWT fictício montado em tempo de execução (um literal seria apontado pelo gitleaks).
const JWT = [
  Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url'),
  Buffer.from('{"sub":"u-1","email":"m@x.com"}').toString('base64url'),
  'c2lnbmF0dXJh',
].join('.');

describe('isSensitiveKey', () => {
  it.each([
    'email',
    'Email',
    'customerEmail',
    'user_email',
    'cpf',
    'cnpj',
    'document',
    'phone',
    'customerPhone',
    'telefone',
    'password',
    'passwordConfirmation',
    'senha',
    'token',
    'accessToken',
    'refresh_token',
    'authorization',
    'Authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'Idempotency-Key',
    'cardNumber',
    'cvv',
    'clientSecret',
    'fullName',
    'shipping_address',
    'email_enc',
    'document_hash',
    'clientIp',
  ])('%s é sensível', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each([
    'id',
    'accountId',
    'bubbleId',
    'pseudonym',
    'status',
    'amountCents',
    'trace_id',
    'span_id',
    'request_id',
    'event',
    'module',
    'zip_compression',
    'gzip',
    'company',
    'description',
    'tokenType',
    'name',
  ])('%s não é sensível', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('redactString', () => {
  it('mascara e-mail, CPF, CNPJ, telefone, JWT e Bearer em texto livre', () => {
    const text =
      `cadastro de ${EMAIL} cpf ${CPF} (${CPF_DIGITS}) cnpj ${CNPJ} ` +
      `(${CNPJ_DIGITS}) tel ${PHONE} jwt ${JWT} header Bearer abcdefghijklmnop`;
    const result = redactString(text);
    expect(findPii(result)).toEqual([]);
    for (const secret of [EMAIL, CPF, CPF_DIGITS, CNPJ, CNPJ_DIGITS, '91234-5678', JWT]) {
      expect(result).not.toContain(secret);
    }
    expect(result).toContain(`Bearer ${REDACTED}`);
  });

  it('mascara parâmetros sensíveis de query string', () => {
    expect(redactString('/api/v1/auth/callback?code=xyz&state=1&email_hint=a')).toBe(
      `/api/v1/auth/callback?code=${REDACTED}&state=1&email_hint=${REDACTED}`,
    );
  });

  it('preserva dados técnicos permitidos (UUID, trace id, ISO, centavos)', () => {
    const text =
      'bubble 3f1c2a9e-1b2c-4d5e-8f90-123456789012 trace 4bf92f3577b34da6a3ce929d0e0e4736 ' +
      'em 2026-10-09T21:40:00.000Z valor 129900 status ACTIVE';
    expect(redactString(text)).toBe(text);
  });
});

describe('redactDeep', () => {
  it('remove chaves sensíveis em qualquer profundidade e mascara strings', () => {
    const input = {
      accountId: 'u-1',
      profile: { email: EMAIL, nested: [{ cpf: CPF, note: `ligar ${PHONE}` }] },
      headers: { authorization: `Bearer ${JWT}`, cookie: 'bv_rt=abc', accept: 'json' },
      amountCents: 1990,
      ok: true,
    };
    const output = redactDeep(input);
    expect(output).toEqual({
      accountId: 'u-1',
      profile: { email: REDACTED, nested: [{ cpf: REDACTED, note: `ligar ${REDACTED}` }] },
      headers: { authorization: REDACTED, cookie: REDACTED, accept: 'json' },
      amountCents: 1990,
      ok: true,
    });
    expect(input.profile.email).toBe(EMAIL); // não muta a entrada
  });

  it('serializa erros sem PII e trata ciclos e profundidade', () => {
    const error = new Error(`usuário ${EMAIL} não encontrado`);
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const output = redactDeep<unknown>({ err: error, cyclic }) as {
      err: { message: string; type: string };
      cyclic: Record<string, unknown>;
    };
    expect(output.err.type).toBe('Error');
    expect(output.err.message).toBe(`usuário ${REDACTED} não encontrado`);
    expect(output.cyclic.self).toBe('[Circular]');
    expect(redactDeep({ a: { b: { c: 1 } } }, { maxDepth: 2 })).toEqual({
      a: { b: '[Truncated]' },
    });
  });
});

describe('redactAttributes (spans)', () => {
  it('remove atributos de PII e cabeçalhos sensíveis, mantém os técnicos', () => {
    expect(
      redactAttributes({
        'bubble.id': 'b-1',
        'account.email': EMAIL,
        'url.full': `https://api/x?email=${EMAIL}`,
        'http.request.header.authorization': ['Bearer x'],
        'client.address': '200.10.20.30',
        'user_agent.original': 'Mozilla/5.0',
        'http.response.status_code': 200,
        tags: [`a ${CPF}`, 'b'],
      }),
    ).toEqual({
      'bubble.id': 'b-1',
      'account.email': REDACTED,
      'url.full': `https://api/x?email=${REDACTED}`,
      'http.request.header.authorization': REDACTED,
      'client.address': REDACTED,
      'user_agent.original': REDACTED,
      'http.response.status_code': 200,
      tags: [`a ${REDACTED}`, 'b'],
    });
  });
});

describe('scrubErrorEvent / scrubBreadcrumb (Sentry)', () => {
  it('remove corpo, cookies, query string, cabeçalhos e PII do evento', () => {
    const event = scrubErrorEvent({
      message: `falhou para ${EMAIL}`,
      request: {
        url: `https://api.bolha/api/v1/accounts?cpf=${CPF}`,
        method: 'POST',
        data: { password: 'segredo', document: CPF },
        cookies: { bv_rt: 'refresh-token' },
        query_string: `cpf=${CPF}`,
        headers: {
          Authorization: `Bearer ${JWT}`,
          Cookie: 'bv_rt=refresh-token',
          'content-type': 'application/json',
          'x-request-id': 'req-1',
        },
      },
      user: { id: 'u-1', email: EMAIL, ip_address: '200.10.20.30', username: 'maria' },
      extra: { payload: { email: EMAIL, cnpj: CNPJ } },
      contexts: { trace: { trace_id: '4bf92f3577b34da6a3ce929d0e0e4736' } },
      breadcrumbs: [{ message: `login ${EMAIL}`, data: { url: '/x?token=abc' } }],
      exception: { values: [{ type: 'Error', value: `CPF ${CPF} inválido` }] },
    });
    const serialized = JSON.stringify(event);
    expect(findPii(serialized)).toEqual([]);
    expect(serialized).not.toMatch(/segredo|refresh-token|200\.10\.20\.30|maria"/);
    expect(event.request).toEqual({
      url: 'https://api.bolha/api/v1/accounts',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
    });
    expect(event.user).toEqual({ id: 'u-1' });
    expect(event.contexts).toEqual({ trace: { trace_id: '4bf92f3577b34da6a3ce929d0e0e4736' } });
  });

  it('breadcrumb sem PII e URL sem query string', () => {
    expect(
      scrubBreadcrumb({ message: `GET para ${EMAIL}`, data: { url: '/a?email=x', status: 200 } }),
    ).toEqual({ message: `GET para ${REDACTED}`, data: { url: '/a', status: 200 } });
  });
});
