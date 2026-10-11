import { describe, expect, it } from 'vitest';
import { ERROR_CATALOG } from '../errors.js';
import {
  BubbleDetail,
  BubbleSearchQuery,
  BubbleSummary,
  BubbleViewportQuery,
  CreateBubbleRequest,
  UpdateBubbleRequest,
} from './bubbles.js';
import { AcquireQuotaRequest, AcquireQuotaResponse, LeaveQuotaResponse } from './quotas.js';
import { SubmitBidRequest } from './bids.js';
import { ROUTES } from './routes.js';

const BUBBLE_ID = '0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44';
const OTHER_ID = '0192f3a1-0000-7000-8000-000000000001';

// Exemplo de api-rest §1.7.
const summaryExample = {
  id: BUBBLE_ID,
  type: 'SALE',
  title: 'Fone Bluetooth XT-500',
  category: { id: 'eletronicos', name: 'Eletrônicos' },
  image_url: 'https://cdn.bolhavenda.com.br/b/0192f1c2/thumb.webp',
  status: 'ACTIVE',
  creator: { pseudonym: 'TecnoLotes#9C1D', account_type: 'PJ', score_band: 'BOM' },
  currency: 'BRL',
  initial_price: 10000,
  target_price: 7500,
  current_price: 9000,
  next_tier: { min_filled_quotas: 70, unit_price: 8000, quotas_to_go: 5 },
  min_quotas: 40,
  max_quotas: 100,
  filled_quotas: 65,
  reserved_quotas: 2,
  available_quotas: 33,
  is_near_full: false,
  is_expiring: false,
  starts_at: '2026-11-23T12:00:00Z',
  expires_at: '2026-11-26T12:00:00Z',
  exploded_at: null,
  canvas_x: 10240,
  canvas_y: -3584,
  radius: 96,
  version: 141,
};

describe('bolhas (api-rest §1.7, §3)', () => {
  it('valida o BubbleSummary do contrato e tolera campo novo', () => {
    const parsed = BubbleSummary.parse({ ...summaryExample, future_field: true });
    expect(parsed.version).toBe(141);
    expect('future_field' in parsed).toBe(false);
  });

  it('valida o BubbleDetail com allowed/blocked actions', () => {
    const detail = BubbleDetail.parse({
      ...summaryExample,
      description: 'Novo, lacrado…',
      max_pj_share: 0.5,
      shipping_days: 7,
      price_tiers: [{ min_filled_quotas: 0, unit_price: 10000, reached: true }],
      my_participation: null,
      allowed_actions: ['JOIN_QUOTA', 'REPORT'],
      blocked_actions: [{ action: 'LEAVE_QUOTA', code: 'BUBBLE_EXIT_LOCKED' }],
      server_time: '2026-11-24T14:03:11Z',
    });
    expect(detail.allowed_actions).toEqual(['JOIN_QUOTA', 'REPORT']);
  });

  it('aceita os exemplos de criação SALE (F6) e PURCHASE (F4) com defaults', () => {
    const sale = CreateBubbleRequest.parse({
      type: 'SALE',
      title: 'Fone Bluetooth XT-500',
      description: 'Novo, lacrado, garantia de 12 meses. NF emitida.',
      category_id: 'eletronicos',
      image_upload_ids: [OTHER_ID],
      max_quotas: 100,
      min_quotas: 40,
      price_tiers: [
        { min_filled_quotas: 0, unit_price: 10000 },
        { min_filled_quotas: 40, unit_price: 9000 },
        { min_filled_quotas: 70, unit_price: 8000 },
        { min_filled_quotas: 100, unit_price: 7500 },
      ],
      duration_minutes: 4320,
    });
    expect(sale.type === 'SALE' && sale.shipping_days).toBe(7);
    expect(sale.max_pj_share).toBe(0.5);

    const purchase = CreateBubbleRequest.parse({
      type: 'PURCHASE',
      title: '30 cadeiras ergonômicas',
      category_id: 'moveis',
      max_quotas: 30,
      min_quotas: 10,
      target_price: 89000,
      duration_minutes: 4320,
      suggested_suppliers: [{ cnpj: '98.765.432/0001-10' }, { email: 'vendas@fornecedor.com.br' }],
    });
    expect(purchase.type).toBe('PURCHASE');
  });

  it.each([
    ['título curto', { title: 'abc' }],
    ['max_quotas acima de 10.000', { max_quotas: 10_001 }],
    ['duração acima de 5 dias', { duration_minutes: 7201 }],
    ['preço abaixo de R$ 1,00', { price_tiers: [{ min_filled_quotas: 0, unit_price: 99 }] }],
    [
      '11 degraus',
      {
        price_tiers: Array.from({ length: 11 }, (_, i) => ({
          min_filled_quotas: i,
          unit_price: 1000,
        })),
      },
    ],
    ['teto PJ abaixo de 10%', { max_pj_share: 0.05 }],
  ])('rejeita %s', (_name, patch) => {
    const base = {
      type: 'SALE',
      title: 'Fone Bluetooth',
      category_id: 'eletronicos',
      max_quotas: 100,
      price_tiers: [{ min_filled_quotas: 0, unit_price: 10000 }],
      duration_minutes: 60,
    };
    expect(CreateBubbleRequest.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it('proíbe price_tiers em PURCHASE (WRONG_BUBBLE_TYPE na borda)', () => {
    expect(
      CreateBubbleRequest.safeParse({
        type: 'PURCHASE',
        title: 'Cadeiras',
        category_id: 'moveis',
        max_quotas: 30,
        target_price: 89000,
        duration_minutes: 60,
        price_tiers: [{ min_filled_quotas: 0, unit_price: 100 }],
      }).success,
    ).toBe(false);
  });

  it('PATCH rejeita campo desconhecido', () => {
    expect(UpdateBubbleRequest.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });

  it('interpreta a query de viewport e a de lista', () => {
    const q = BubbleViewportQuery.parse({
      bbox: '0,-100,200,0',
      zoom: '0.8',
      type: 'SALE,PURCHASE',
      participating: 'true',
    });
    expect(q).toMatchObject({
      bbox: [0, -100, 200, 0],
      zoom: 0.8,
      type: ['SALE', 'PURCHASE'],
      participating: true,
    });
    expect(BubbleViewportQuery.safeParse({ bbox: '0,0,1,1', zoom: '5' }).success).toBe(false);
    const list = BubbleSearchQuery.parse({ view: 'list', q: 'fone' });
    expect(list).toMatchObject({ view: 'list', q: 'fone', limit: 20 });
  });
});

describe('cotas (api-rest §4)', () => {
  it('aceita cartão e Pix; quantity padrão 1', () => {
    expect(
      AcquireQuotaRequest.parse({ payment: { method: 'CARD', card_token: 'card_tok_8Jk' } }),
    ).toEqual({
      quantity: 1,
      payment: { method: 'CARD', card_token: 'card_tok_8Jk', installments: 1 },
    });
    expect(
      AcquireQuotaRequest.parse({ quantity: 1, payment: { method: 'PIX' } }).payment.method,
    ).toBe('PIX');
  });

  it('nunca aceita dados de cartão em claro (PCI SAQ-A)', () => {
    expect(
      AcquireQuotaRequest.safeParse({
        payment: { method: 'CARD', card_token: 't', number: '4111111111111111' },
      }).success,
    ).toBe(false);
  });

  it('valida a resposta 201 (cartão) e a saída', () => {
    expect(
      AcquireQuotaResponse.safeParse({
        quota: {
          id: OTHER_ID,
          bubble_id: BUBBLE_ID,
          quantity: 1,
          status: 'ACTIVE',
          acquired_at: '2026-11-24T14:03:12Z',
        },
        payment: {
          id: OTHER_ID,
          method: 'CARD',
          status: 'AUTHORIZED',
          authorized_amount: 10000,
          currency: 'BRL',
        },
        bubble: {
          filled_quotas: 66,
          available_quotas: 32,
          current_price: 9000,
          next_tier: { min_filled_quotas: 70, unit_price: 8000, quotas_to_go: 4 },
          is_near_full: false,
          status: 'ACTIVE',
          version: 142,
        },
      }).success,
    ).toBe(true);
    expect(
      LeaveQuotaResponse.safeParse({
        released_quantity: 1,
        refund: { status: 'PROCESSING', amount: 10000 },
        bubble: { filled_quotas: 65, current_price: 9000, version: 143 },
      }).success,
    ).toBe(true);
  });

  it('lance exige preço e prazo', () => {
    expect(SubmitBidRequest.safeParse({ unit_price: 79900, delivery_days: 12 }).success).toBe(true);
    expect(SubmitBidRequest.safeParse({ unit_price: 79900 }).success).toBe(false);
  });
});

describe('registro de rotas', () => {
  it('operationId e (método, caminho) únicos', () => {
    const ids = ROUTES.map((r) => r.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('todo erro documentado está no catálogo e todo path param existe no schema', () => {
    for (const r of ROUTES) {
      for (const code of r.errors)
        expect(Object.hasOwn(ERROR_CATALOG, code), `${r.operationId}/${code}`).toBe(true);
      const names = [...r.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const shape = 'params' in r && r.params ? Object.keys(r.params.shape) : [];
      expect(shape.sort(), r.operationId).toEqual(names.sort());
    }
  });

  it('Idempotency-Key obrigatória nas rotas de api-rest §1.3', () => {
    const required = ROUTES.filter((r) => 'idempotency' in r && r.idempotency === 'required').map(
      (r) => r.operationId,
    );
    expect(required.sort()).toEqual(
      ['acquireQuota', 'publishBubble', 'selectBid', 'submitBid'].sort(),
    );
  });
});
