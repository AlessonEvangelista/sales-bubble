/**
 * Detecção de violações de constraint vindas do Postgres, independentemente da camada que
 * embrulhou o erro (driver `pg`, driver adapter do Prisma, PrismaClientKnownRequestError).
 * Usada para mapear, por exemplo, `quotas_pf_one_per_bubble_uk` → 409 PF_QUOTA_LIMIT (ADR-0002).
 */

/** SQLSTATE 23505 / kind UniqueConstraintViolation / P2002. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const text = describe(error);
  const isUnique = /23505|UniqueConstraintViolation|P2002|unique constraint/i.test(text);
  return isUnique && (constraint === undefined || text.includes(constraint));
}

/** SQLSTATE 23514 (check_violation). */
export function isCheckViolation(error: unknown, constraint?: string): boolean {
  const text = describe(error);
  const isCheck = /23514|check constraint|CheckConstraintViolation/i.test(text);
  return isCheck && (constraint === undefined || text.includes(constraint));
}

/** Junta mensagem, código e metadados de toda a cadeia de `cause` num texto pesquisável. */
function describe(error: unknown, depth = 0): string {
  if (error === null || error === undefined || depth > 5) return '';
  if (typeof error !== 'object') return String(error);
  const record = error as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ['message', 'code', 'constraint', 'kind', 'originalCode', 'originalMessage']) {
    const value = record[key];
    if (typeof value === 'string') parts.push(value);
  }
  if (record['meta'] !== undefined) parts.push(safeJson(record['meta']));
  parts.push(describe(record['cause'], depth + 1));
  return parts.join(' ');
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return '';
  }
}
