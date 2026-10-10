import { describe, expect, it } from 'vitest';
import {
  ERROR_CATALOG,
  ERROR_CODES,
  ProblemDetails,
  createProblem,
  getErrorDefinition,
  isErrorCode,
  problemTypeUri,
  type ErrorCode,
} from './errors.js';

describe('catálogo de erros (api-rest §1.4.1)', () => {
  it('todo código tem status 4xx/5xx, título e grupo', () => {
    for (const code of ERROR_CODES) {
      const def = getErrorDefinition(code);
      expect(def.status, code).toBeGreaterThanOrEqual(400);
      expect(def.status, code).toBeLessThan(600);
      expect(def.title.length, code).toBeGreaterThan(0);
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  // estrategia-testes §3.3: códigos da Spec F5 e F8 com status e mensagem exata.
  it.each<[ErrorCode, number, string]>([
    [
      'QUOTA_SOLD_OUT',
      409,
      'As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.',
    ],
    ['PF_QUOTA_LIMIT', 409, 'Você já participa desta bolha (limite de 1 cota por pessoa).'],
    [
      'PJ_SHARE_EXCEEDED',
      409,
      'Sua empresa pode ocupar no máximo {max_allowed} cotas nesta bolha.',
    ],
    ['BUBBLE_NOT_ACTIVE', 409, 'Esta bolha já foi encerrada.'],
    ['CREATOR_CANNOT_JOIN', 409, 'Você não pode participar da própria bolha.'],
    ['PAYMENT_DECLINED', 402, 'O pagamento não foi autorizado. Tente outra forma de pagamento.'],
    ['ACCOUNT_NOT_VERIFIED', 403, 'Conclua a verificação do CNPJ para participar.'],
    [
      'BID_ABOVE_TARGET',
      422,
      'O lance precisa ser igual ou menor que o preço-alvo de {target_price}',
    ],
    ['BUBBLE_EXIT_LOCKED', 409, 'Saídas são bloqueadas na última hora para proteger o grupo'],
    [
      'CREATOR_QUOTA_NOT_AUTHORIZED',
      402,
      'Não foi possível autorizar sua cota. A bolha não foi publicada.',
    ],
    ['CNPJ_NOT_ACTIVE', 422, 'CNPJ com situação cadastral irregular'],
  ])('%s → %i com a mensagem normativa', (code, status, message) => {
    const def = getErrorDefinition(code);
    expect(def.status).toBe(status);
    expect(def.message).toBe(message);
    expect(def.normative).toBe(true);
  });

  it('não há código de "já cadastrado" para cadastro/recuperação (anti-enumeração)', () => {
    const suspicious = ERROR_CODES.filter((c) =>
      /EMAIL_(ALREADY|EXISTS|TAKEN)|ACCOUNT_EXISTS|USER_EXISTS/.test(c),
    );
    expect(suspicious).toEqual([]);
  });

  it('isErrorCode reconhece só códigos do catálogo', () => {
    expect(isErrorCode('QUOTA_SOLD_OUT')).toBe(true);
    expect(isErrorCode('toString')).toBe(false);
    expect(isErrorCode('NOPE')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });

  it('gera URIs de type estáveis em kebab-case', () => {
    expect(problemTypeUri('QUOTA_SOLD_OUT')).toBe(
      'https://api.bolhavenda.com.br/problems/quota-sold-out',
    );
    const uris = new Set(ERROR_CODES.map(problemTypeUri));
    expect(uris.size).toBe(ERROR_CODES.length);
  });

  it('cobre todos os códigos do catálogo (100% exercitado)', () => {
    expect(ERROR_CODES.length).toBe(Object.keys(ERROR_CATALOG).length);
    for (const code of ERROR_CODES) {
      expect(ProblemDetails.safeParse(createProblem(code)).success, code).toBe(true);
    }
  });
});

describe('createProblem (RFC 9457)', () => {
  it('reproduz o exemplo de api-rest §1.4', () => {
    const problem = createProblem('QUOTA_SOLD_OUT', {
      instance: '/api/v1/bubbles/0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44/quotas',
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      extensions: { bubble_id: '0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44', available_quotas: 0 },
    });
    expect(problem).toEqual({
      type: 'https://api.bolhavenda.com.br/problems/quota-sold-out',
      title: 'Cotas esgotadas',
      status: 409,
      detail: 'As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.',
      instance: '/api/v1/bubbles/0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44/quotas',
      code: 'QUOTA_SOLD_OUT',
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      bubble_id: '0192f1c2-7b1e-7c3a-9a51-3f0a8d2c1e44',
      available_quotas: 0,
    });
  });

  it('não usa mensagem com placeholder como detail padrão', () => {
    expect(
      createProblem('PJ_SHARE_EXCEEDED', { extensions: { max_allowed: 3, already_held: 3 } })
        .detail,
    ).toBeUndefined();
  });

  it('extensões e campos padrão não se sobrepõem (campos do catálogo prevalecem)', () => {
    const p = createProblem('NOT_FOUND', { extensions: { status: 200, code: 'X' } });
    expect(p.status).toBe(404);
    expect(p.code).toBe('NOT_FOUND');
  });

  it('VALIDATION_FAILED carrega errors[]', () => {
    const p = createProblem('VALIDATION_FAILED', {
      errors: [{ field: 'price_tiers[2].unit_price', code: 'NOT_NON_INCREASING', message: '…' }],
    });
    expect(ProblemDetails.parse(p).errors).toHaveLength(1);
  });

  it('o cliente tolera código novo e membros de extensão desconhecidos', () => {
    const parsed = ProblemDetails.parse({
      type: 'https://api.bolhavenda.com.br/problems/new-thing',
      title: 'Novo',
      status: 409,
      code: 'NEW_THING',
      extra: 1,
    });
    expect(parsed.extra).toBe(1);
  });
});
