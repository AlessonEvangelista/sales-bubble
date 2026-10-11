import { describe, expect, it } from 'vitest';
import { Cnpj } from '../identity/index.js';
import { notificationDedupeKey, type Notification } from '../notification/index.js';
import { DomainInvariantViolation } from '../shared/errors.js';
import type { EventRecorder } from '../shared/events.js';
import { FakeCnpjPort } from './fake-cnpj-port.js';
import { DEFAULT_TEST_NOW, FixedClock, durationToMs } from './fixed-clock.js';
import { InMemoryEventRecorder, InMemoryUnitOfWork } from './in-memory-unit-of-work.js';
import { RecordingNotifier } from './recording-notifier.js';
import { SequentialIdGenerator } from './sequential-id-generator.js';

const cnpj = (raw: string): Cnpj => {
  const parsed = Cnpj.parse(raw);
  if (!parsed.ok) throw new Error('fixture inválida');
  return parsed.value;
};

describe('FixedClock', () => {
  it('começa no instante padrão e só anda quando mandado', () => {
    const clock = new FixedClock();
    expect(clock.now().toISOString()).toBe(DEFAULT_TEST_NOW);
    expect(clock.advance({ days: 1, hours: 2, minutes: 3, seconds: 4, ms: 5 }).toISOString()).toBe(
      '2026-10-02T14:03:04.005Z',
    );
    clock.set(new Date('2027-01-01T00:00:00Z'));
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(durationToMs({})).toBe(0);
  });

  it('devolve cópias e rejeita instantes inválidos', () => {
    const clock = new FixedClock('2026-01-01T00:00:00Z');
    clock.now().setUTCFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
    expect(() => new FixedClock('não é data')).toThrow(RangeError);
  });
});

describe('SequentialIdGenerator', () => {
  it('gera UUIDs no formato v7, sequenciais e ordenáveis', () => {
    const ids = new SequentialIdGenerator();
    const [a, b] = [ids.next(), ids.next()];
    expect(a).toBe('00000000-0000-7000-8000-000000000001');
    expect(b).toBe('00000000-0000-7000-8000-000000000002');
    expect(a < b).toBe(true);
    expect(new SequentialIdGenerator(255).next()).toMatch(/-0000000000ff$/);
  });
});

describe('InMemoryUnitOfWork + InMemoryEventRecorder', () => {
  const setup = () => {
    const events = new InMemoryEventRecorder();
    const uow = new InMemoryUnitOfWork<{ events: EventRecorder }>({ events }, [events]);
    return { events, uow };
  };
  const evt = { type: 'QuotaAcquired', aggregateId: 'b1', payload: { quantity: 1 } };

  it('confirma eventos só no commit', async () => {
    const { events, uow } = setup();
    const result = await uow.run(async ({ events: rec }) => {
      rec.record([evt]);
      expect(uow.inTransaction).toBe(true);
      expect(events.committed).toHaveLength(0);
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(uow.inTransaction).toBe(false);
    expect(events.committed).toEqual([evt]);
    expect(events.ofType('QuotaAcquired')).toHaveLength(1);
    expect(events.ofType('BubbleExploded')).toHaveLength(0);
    expect(uow.commits).toBe(1);
  });

  it('descarta eventos e propaga o erro quando o trabalho falha', async () => {
    const { events, uow } = setup();
    const boom = new Error('falha no meio');
    await expect(
      uow.run(async ({ events: rec }) => {
        rec.record([evt]);
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(events.committed).toHaveLength(0);
    expect(uow.rollbacks).toBe(1);
    expect(uow.commits).toBe(0);
  });

  it('simula falha no commit (rollback total) uma única vez', async () => {
    const { events, uow } = setup();
    uow.failNextCommit();
    await expect(uow.run(async ({ events: rec }) => rec.record([evt]))).rejects.toThrow(
      'Falha simulada no commit',
    );
    expect(events.committed).toHaveLength(0);
    await uow.run(async ({ events: rec }) => rec.record([evt]));
    expect(events.committed).toHaveLength(1);
  });

  it('não aceita unidade aninhada nem evento fora de unidade', async () => {
    const { events, uow } = setup();
    await expect(uow.run(() => uow.run(async () => 1))).rejects.toBeInstanceOf(
      DomainInvariantViolation,
    );
    expect(() => events.record([evt])).toThrow(DomainInvariantViolation);
    const bare = new InMemoryUnitOfWork({ x: 1 });
    expect(await bare.run(async ({ x }) => x + 1)).toBe(2);
  });
});

describe('FakeCnpjPort', () => {
  const ATIVA = cnpj('11.222.333/0001-81');
  const BAIXADA = cnpj('12.ABC.345/01DE-35');

  it('responde a situação cadastrada, com provedor FAKE e checkedAt do Clock', async () => {
    const clock = new FixedClock();
    const port = new FakeCnpjPort({ clock }).register('12.ABC.345/01DE-35', {
      situation: 'BAIXADA',
      legalName: 'Baixada SA',
      mainCnae: '1234567',
    });
    const baixada = await port.lookup(BAIXADA);
    expect(baixada).toMatchObject({
      ok: true,
      value: {
        situation: 'BAIXADA',
        legalName: 'Baixada SA',
        mainCnae: '1234567',
        provider: 'FAKE',
      },
    });
    const ativa = await port.lookup(ATIVA);
    expect(ativa.ok && ativa.value.situation).toBe('ATIVA');
    expect(ativa.ok && ativa.value.checkedAt.toISOString()).toBe(DEFAULT_TEST_NOW);
    expect(port.lookups).toEqual(['12ABC34501DE35', '11222333000181']);
  });

  it('com fallback NOT_FOUND, só conhece o que foi registrado', async () => {
    const port = new FakeCnpjPort({ clock: new FixedClock(), fallback: 'NOT_FOUND' }).register(
      ATIVA,
      {
        situation: 'ATIVA',
      },
    );
    expect(await port.lookup(BAIXADA)).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await port.lookup(ATIVA)).ok).toBe(true);
  });

  it('simula provedores indisponíveis por N consultas (→ PENDING_VERIFICATION)', async () => {
    const port = new FakeCnpjPort({ clock: new FixedClock() });
    port.failNextWithUnavailable(2);
    expect(await port.lookup(ATIVA)).toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_UNAVAILABLE' },
    });
    expect((await port.lookup(ATIVA)).ok).toBe(false);
    expect((await port.lookup(ATIVA)).ok).toBe(true);
  });

  it('cenário com CNPJ inválido é bug do teste', () => {
    const port = new FakeCnpjPort({ clock: new FixedClock() });
    expect(() => port.register('11.222.333/0001-80', { situation: 'ATIVA' })).toThrow(
      DomainInvariantViolation,
    );
  });
});

describe('RecordingNotifier', () => {
  const make = (
    accountId: string,
    channel: 'IN_APP' | 'EMAIL',
    template = 'refund_done',
  ): Notification => ({
    accountId,
    channel,
    template,
    payload: { bubbleId: 'b1', amountCents: '1000' },
    transactional: true,
    dedupeKey: notificationDedupeKey('evt-1', accountId, channel),
  });

  it('grava, filtra e deduplica pela dedupeKey', async () => {
    const notifier = new RecordingNotifier();
    await notifier.notify(make('a1', 'IN_APP'));
    await notifier.notify(make('a1', 'EMAIL'));
    await notifier.notify(make('a1', 'IN_APP')); // reentrega do outbox
    await notifier.notify(make('a2', 'IN_APP', 'bubble_exploded_success'));
    expect(notifier.sent).toHaveLength(3);
    expect(notifier.duplicatesIgnored).toBe(1);
    expect(notifier.forAccount('a1')).toHaveLength(2);
    expect(notifier.withTemplate('bubble_exploded_success')).toHaveLength(1);
    expect(notifier.sent[0]?.dedupeKey).toBe('evt-1:a1:IN_APP');
  });

  it('simula falha de envio uma vez', async () => {
    const notifier = new RecordingNotifier();
    notifier.failNext();
    await expect(notifier.notify(make('a1', 'EMAIL'))).rejects.toThrow('Falha simulada');
    await notifier.notify(make('a1', 'EMAIL'));
    expect(notifier.sent).toHaveLength(1);
  });
});
