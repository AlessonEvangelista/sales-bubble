/**
 * Tipos primitivos e representações comuns do contrato (api-rest.md §1.1, §1.5 e §1.7).
 *
 * Convenções do contrato:
 * - campos em `snake_case`, iguais às colunas canônicas;
 * - IDs UUID v7 em string;
 * - datas ISO 8601 em UTC com `Z`;
 * - dinheiro em **centavos inteiros** + `currency: "BRL"` no objeto que contém valores.
 *
 * Schemas de **resposta** usam `z.object` (descarta campos desconhecidos — *tolerant reader*,
 * api-rest §1.1). Schemas de **requisição** usam `z.strictObject` (allowlist de campos, sem
 * mass assignment — threat-model V5).
 */
import { z } from 'zod';

/** Prefixo versionado da API REST (guia de desenvolvimento §3.1). */
export const API_BASE_PATH = '/api/v1' as const;

/** Versão do contrato publicada no OpenAPI (`info.version`). Aditivo → minor; quebra → `/api/v2`. */
export const CONTRACT_VERSION = '1.0.0' as const;

/** UUID (o servidor gera v7; o validador aceita qualquer versão para não acoplar o cliente). */
export const Uuid = z.uuid().meta({ id: 'Uuid', description: 'UUID (v7 gerado pelo servidor).' });
export type Uuid = z.infer<typeof Uuid>;

/** Instante ISO 8601 em UTC com `Z` (api-rest §1.1). */
export const IsoDateTime = z.iso
  .datetime({ offset: false })
  .meta({ id: 'IsoDateTime', description: 'Instante ISO 8601 em UTC (sufixo Z).' });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Data civil ISO 8601 (`2026-12-04`). */
export const IsoDate = z.iso.date();

/** Valor monetário em centavos inteiros (api-rest §1.1: `129900` = R$ 1.299,00). */
export const Cents = z
  .int()
  .nonnegative()
  .meta({ id: 'Cents', description: 'Valor em centavos inteiros (BRL).' });
export type Cents = z.infer<typeof Cents>;

/** Moeda — o R1 opera só em reais. */
export const Currency = z.literal('BRL').meta({ id: 'Currency' });
export type Currency = z.infer<typeof Currency>;

// ------------------------------------------------------------------ enums de domínio

/** Tipo de conta (api-rest §1.2). */
export const AccountType = z.enum(['PF', 'PJ']).meta({ id: 'AccountType' });
export type AccountType = z.infer<typeof AccountType>;

/** Tipo de bolha: venda (C2C/B2C com degraus) ou compra (lance C2B — ADR-0005). */
export const BubbleType = z.enum(['SALE', 'PURCHASE']).meta({ id: 'BubbleType' });
export type BubbleType = z.infer<typeof BubbleType>;

/** Estados da bolha (ADR-0009). `is_near_full` e `is_expiring` são flags, nunca status. */
export const BubbleStatus = z
  .enum([
    'DRAFT',
    'ACTIVE',
    'EXPIRED_SUCCESS',
    'EXPIRED_FAILED',
    'IN_TRIAGE',
    'COMPLETED',
    'CANCELLED',
  ])
  .meta({ id: 'BubbleStatus' });
export type BubbleStatus = z.infer<typeof BubbleStatus>;

/** Faixa de score exibida publicamente (ADR-0007). */
export const ScoreBand = z.enum(['RISCO', 'REGULAR', 'BOM', 'EXCELENTE']).meta({ id: 'ScoreBand' });
export type ScoreBand = z.infer<typeof ScoreBand>;

/** Situação da verificação de CNPJ (ADR-0008). */
export const VerificationStatus = z
  .enum(['VERIFIED', 'PENDING_VERIFICATION', 'IRREGULAR'])
  .meta({ id: 'VerificationStatus' });
export type VerificationStatus = z.infer<typeof VerificationStatus>;

/** Status da cota (api-rest §4.3 e §9.1). */
export const QuotaStatus = z
  .enum(['RESERVED', 'ACTIVE', 'CAPTURED', 'RELEASED', 'REFUNDED'])
  .meta({ id: 'QuotaStatus' });
export type QuotaStatus = z.infer<typeof QuotaStatus>;

/** Status do pagamento (api-rest §4.4). */
export const PaymentStatus = z
  .enum([
    'PENDING',
    'AUTHORIZED',
    'CAPTURED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
  ])
  .meta({ id: 'PaymentStatus' });
export type PaymentStatus = z.infer<typeof PaymentStatus>;

/** Método de pagamento (ADR-0003). */
export const PaymentMethod = z.enum(['CARD', 'PIX']).meta({ id: 'PaymentMethod' });
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** Resultado da explosão e motivo (Spec F7). */
export const ExplosionOutcome = z.enum(['SUCCESS', 'FAILED']).meta({ id: 'ExplosionOutcome' });
export type ExplosionOutcome = z.infer<typeof ExplosionOutcome>;
export const ExplosionReason = z.enum(['TIME', 'FULL']).meta({ id: 'ExplosionReason' });
export type ExplosionReason = z.infer<typeof ExplosionReason>;

/** Nível de detalhe do canvas (api-rest §3.7, api-websocket §3.1). */
export const Lod = z.enum(['LOW', 'MEDIUM', 'HIGH']).meta({ id: 'Lod' });
export type Lod = z.infer<typeof Lod>;

/** Status do lance (api-rest §5.5). */
export const BidStatus = z
  .enum(['ACTIVE', 'WITHDRAWN', 'SELECTED', 'NOT_SELECTED'])
  .meta({ id: 'BidStatus' });
export type BidStatus = z.infer<typeof BidStatus>;

// ------------------------------------------------------------------ paginação por cursor

/** Limites de paginação (api-rest §1.5). */
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 100;

/** Query de paginação por cursor (`?limit=20&cursor=<opaco>`). */
export const CursorQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
  cursor: z.string().max(512).optional(),
});
export type CursorQuery = z.infer<typeof CursorQuery>;

/** Bloco `page` das respostas paginadas. */
export const PageInfo = z
  .object({
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
    limit: z.int().min(1).max(PAGE_LIMIT_MAX),
  })
  .meta({ id: 'PageInfo' });
export type PageInfo = z.infer<typeof PageInfo>;

/** Constrói o schema `{ data: T[], page }` de uma lista paginada. */
export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), page: PageInfo });
}

/** Parâmetro de rota `{id}`. */
export const IdParams = z.strictObject({ id: Uuid });
export type IdParams = z.infer<typeof IdParams>;
