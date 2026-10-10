import { describe, expect, it } from 'vitest';
import { buildSentryOptions } from './sentry-options';

describe('buildSentryOptions', () => {
  it('sem DSN o Sentry fica desligado', () => {
    expect(buildSentryOptions({})).toBeUndefined();
    expect(buildSentryOptions({ dsn: '' })).toBeUndefined();
  });

  it('não envia PII: dataCollection restritivo e beforeSend remove corpo, cookies e e-mail/CPF', () => {
    const options = buildSentryOptions({ dsn: 'https://public@sentry.example/1' });
    expect(options?.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
    });
    expect(options?.tracesSampleRate).toBe(0);

    const event = options!.beforeSend({
      message: 'falha para maria@exemplo.com.br (CPF 123.456.789-09)',
      request: {
        url: 'https://bolha.app/conta?email=maria@exemplo.com.br',
        data: { password: 'segredo' },
        cookies: { bv_rt: 'refresh' },
        headers: { Authorization: 'Bearer abc.def.ghi', 'content-type': 'application/json' },
      },
      user: { id: 'u-1', email: 'maria@exemplo.com.br', ip_address: '10.0.0.1' },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(
      /maria@|123\.456\.789-09|segredo|refresh|Bearer abc|10\.0\.0\.1/,
    );
    expect(event.user).toEqual({ id: 'u-1' });
  });

  it('ignora taxa de amostragem inválida', () => {
    expect(
      buildSentryOptions({ dsn: 'https://public@sentry.example/1', tracesSampleRate: '7' })
        ?.tracesSampleRate,
    ).toBe(0);
  });
});
