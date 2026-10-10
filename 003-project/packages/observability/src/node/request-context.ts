import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** Contexto de correlação por requisição/job, lido pelo logger (`request_id`). */
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Executa `fn` com o contexto informado (middleware HTTP ou processador de job). */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Reaproveita o `X-Request-Id` recebido (proxy/load balancer) só se for um identificador
 * técnico seguro (até 128 caracteres de `[A-Za-z0-9._:-]`); caso contrário gera um UUID v4.
 * Evita que o cabeçalho vire canal de injeção de PII ou de texto arbitrário nos logs.
 */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  if (value !== undefined && /^[A-Za-z0-9._:-]{1,128}$/.test(value)) return value;
  return randomUUID();
}
