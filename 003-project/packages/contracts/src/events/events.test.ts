import { describe, expect, it } from 'vitest';
import {
  DOMAIN_EVENTS,
  DOMAIN_EVENT_TYPES,
  buildDomainEvent,
  parseDomainEvent,
} from './domain-events.js';
import {
  WS_SERVER_EVENTS,
  parseWsServerEvent,
  tileRoom,
  zoomToTileLevel,
  wsServerEventSchema,
  ViewportSetPayload,
} from './ws-events.js';

const B = '0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44';
const Q = '0192f3a1-0000-7000-8000-000000000001';
const P = '0192f3a1-0000-7000-8000-000000000002';
const EVT = '01926f3a-7c1e-7b2a-9f00-3c5d1e2a4b10';

describe('eventos de domínio (eventos-dominio.md §2)', () => {
  it('o catálogo cobre os eventos de §2.1, todos em v1', () => {
    expect(DOMAIN_EVENT_TYPES).toHaveLength(27);
    for (const t of DOMAIN_EVENT_TYPES)
      expect(Object.keys(DOMAIN_EVENTS[t].versions), t).toContain('1');
  });

  it('monta e relê o QuotaAcquired do exemplo', () => {
    const event = buildDomainEvent({
      event_id: EVT,
      event_type: 'QuotaAcquired',
      event_version: 1,
      aggregate_id: B,
      occurred_at: '2026-12-08T14:03:22.418Z',
      trace_parent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      payload: {
        bubble_id: B,
        quota_id: Q,
        payment_id: P,
        participant_pseudonym: 'Bolhista#4F2A',
        account_type: 'PF',
        quantity: 1,
        filled_quotas: 72,
        reserved_quotas: 2,
        max_quotas: 100,
        current_unit_price: 8000,
        tier_changed: false,
        next_tier: { min_filled_quotas: 100, unit_price: 7500 },
        version: 76,
      },
    });
    expect(event.aggregate_type).toBe('bubble');
    const parsed = parseDomainEvent(JSON.parse(JSON.stringify(event)));
    expect(parsed.ok).toBe(true);
  });

  it('produtor com payload inválido falha cedo', () => {
    expect(() =>
      buildDomainEvent({
        event_id: EVT,
        event_type: 'BubbleExploded',
        event_version: 1,
        aggregate_id: B,
        occurred_at: '2026-12-09T09:41:07.112Z',
        // @ts-expect-error — payload incompleto de propósito
        payload: { bubble_id: B },
      }),
    ).toThrow();
  });

  it('consumidor: evento/versão desconhecidos e payload inválido', () => {
    const env = {
      event_id: EVT,
      aggregate_type: 'bubble',
      aggregate_id: B,
      occurred_at: '2026-12-08T14:03:22Z',
    };
    expect(
      parseDomainEvent({ ...env, event_type: 'Nope', event_version: 1, payload: {} }),
    ).toMatchObject({ ok: false, reason: 'UNKNOWN_EVENT' });
    expect(
      parseDomainEvent({ ...env, event_type: 'QuotaAcquired', event_version: 2, payload: {} }),
    ).toMatchObject({ ok: false, reason: 'UNKNOWN_EVENT' });
    expect(
      parseDomainEvent({ ...env, event_type: 'QuotaAcquired', event_version: 1, payload: {} }),
    ).toMatchObject({ ok: false, reason: 'INVALID_PAYLOAD' });
    expect(parseDomainEvent({ nope: true })).toMatchObject({
      ok: false,
      reason: 'INVALID_ENVELOPE',
    });
  });

  it('payload sem PII: nenhum campo de e-mail, documento, nome ou endereço', () => {
    const forbidden = /(^|_)(email|cpf|cnpj|document|name|phone|address)$/;
    for (const t of DOMAIN_EVENT_TYPES) {
      for (const [, schema] of Object.entries(DOMAIN_EVENTS[t].versions)) {
        for (const key of Object.keys(schema.shape))
          expect(key, `${t}.${key}`).not.toMatch(forbidden);
      }
    }
  });
});

describe('eventos WebSocket (api-websocket.md)', () => {
  it('valida o bubble.updated do contrato com envelope', () => {
    const msg = {
      event: 'bubble.updated',
      v: 1,
      id: '0192fa10-3c2e-7d11-8f0a-6b2c9e0d7a55',
      ts: '2026-11-24T14:03:12.184Z',
      data: {
        bubble_id: B,
        version: 142,
        filled_quotas: 66,
        reserved_quotas: 2,
        available_quotas: 32,
        max_quotas: 100,
        current_price: 9000,
        next_tier: { min_filled_quotas: 70, unit_price: 8000, quotas_to_go: 4 },
        flags: { is_near_full: false, is_expiring: false },
        cause: 'QUOTA_ACQUIRED',
        delta_quotas: 1,
      },
    };
    expect(parseWsServerEvent(msg)).toMatchObject({ ok: true });
    expect(wsServerEventSchema('bubble.updated').safeParse(msg).success).toBe(true);
  });

  it('valida bubble.exploded e session.ready', () => {
    expect(
      parseWsServerEvent({
        event: 'bubble.exploded',
        v: 1,
        data: {
          bubble_id: B,
          version: 190,
          outcome: 'SUCCESS',
          reason: 'FULL',
          status: 'EXPIRED_SUCCESS',
          filled_quotas: 200,
          final_price: 19900,
          exploded_at: '2026-11-25T09:41:07.551Z',
          bid_selection_deadline: null,
        },
      }).ok,
    ).toBe(true);
    expect(
      parseWsServerEvent({
        event: 'session.ready',
        v: 1,
        data: {
          connection_id: 'rt_9f3',
          anonymous: false,
          server_time: '2026-11-24T14:03:11.002Z',
          heartbeat_ms: 25000,
          limits: { max_tiles: 64, max_bubble_rooms: 20 },
        },
      }).ok,
    ).toBe(true);
  });

  it('ignora evento desconhecido ou versão nova', () => {
    expect(parseWsServerEvent({ event: 'x.y', v: 1, data: {} })).toMatchObject({
      reason: 'UNKNOWN_EVENT',
    });
    expect(parseWsServerEvent({ event: 'bubble.updated', v: 2, data: {} })).toMatchObject({
      reason: 'UNKNOWN_EVENT',
    });
  });

  it('bubble.updated é o único coalescível (§7)', () => {
    const coalescible = Object.entries(WS_SERVER_EVENTS)
      .filter(([, d]) => d.coalescible)
      .map(([n]) => n);
    expect(coalescible).toEqual(['bubble.updated']);
  });

  it('tiling: z = clamp(floor(log2(zoom/0,1)), 0, 5) e T(z) = 32768/2^z', () => {
    expect(zoomToTileLevel(0.1)).toBe(0);
    expect(zoomToTileLevel(0.4)).toBe(2);
    expect(zoomToTileLevel(0.8)).toBe(3);
    expect(zoomToTileLevel(2.6)).toBe(4);
    expect(zoomToTileLevel(4)).toBe(5);
    expect(tileRoom(5, 1023, -1)).toBe('tile:5:0:-1');
    expect(tileRoom(0, 32768, 0)).toBe('tile:0:1:0');
  });

  it('viewport.set valida zoom e margem', () => {
    expect(
      ViewportSetPayload.parse({ bbox: [10000, -4200, 14200, -1800], zoom: 2.6, margin: 0.25 })
        .margin,
    ).toBe(0.25);
    expect(ViewportSetPayload.safeParse({ bbox: [0, 0, 1, 1], zoom: 5 }).success).toBe(false);
  });
});
