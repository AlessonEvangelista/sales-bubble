import { flagOverrideSchema, isFlagKey, type FlagKey, type FlagOverride } from '@bolha/contracts';
import { Redis } from 'ioredis';
import type { FlagOverrides } from './evaluate.js';
import type { FlagAuditEntry, FlagOverrideStore } from './store.js';

export interface RedisFlagStoreOptions {
  /** Prefixo das chaves (testes de integração usam um prefixo próprio). */
  prefix?: string;
  /** Tamanho aproximado máximo do stream de auditoria. */
  auditMaxLen?: number;
  /** Override inválido/desconhecido encontrado no Redis (ignorado na avaliação). */
  onInvalidEntry?: (field: string) => void;
}

/**
 * Grava override + auditoria + notificação numa única operação atômica (Lua).
 * KEYS[1] = hash de overrides, KEYS[2] = stream de auditoria.
 * ARGV = campo, valor ('' remove), ator, motivo, maxlen, data, canal.
 */
const WRITE_SCRIPT = `
local before = redis.call('HGET', KEYS[1], ARGV[1])
if ARGV[2] == '' then
  redis.call('HDEL', KEYS[1], ARGV[1])
else
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
end
redis.call('XADD', KEYS[2], 'MAXLEN', '~', ARGV[5], '*',
  'key', ARGV[1], 'before', before or '', 'after', ARGV[2],
  'actor', ARGV[3], 'reason', ARGV[4], 'at', ARGV[6])
redis.call('PUBLISH', ARGV[7], ARGV[1])
return before
`;

function parseOverride(raw: string | null | undefined): FlagOverride | null {
  if (!raw) return null;
  try {
    const parsed = flagOverrideSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Overrides de flags no Redis (kill switches em runtime, sem deploy):
 * - `<prefix>:overrides` — hash `chave → JSON(FlagOverride)`;
 * - `<prefix>:audit` — stream com cada alteração (antes/depois, ator, motivo, data);
 * - `<prefix>:changed` — canal pub/sub que invalida o cache de todas as instâncias.
 *
 * O Redis do projeto roda com AOF `everysec` e `noeviction` (docker-compose / ADR-0011),
 * então o override sobrevive a reinícios. Auditoria definitiva em `audit_log` é pendência
 * (tabela do BV-107) — o stream é a trilha provisória.
 */
export class RedisFlagStore implements FlagOverrideStore {
  readonly keys: { overrides: string; audit: string; channel: string };
  private readonly auditMaxLen: number;

  constructor(
    private readonly client: Redis,
    private readonly options: RedisFlagStoreOptions = {},
  ) {
    const prefix = options.prefix ?? 'bv:flags';
    this.keys = {
      overrides: `${prefix}:overrides`,
      audit: `${prefix}:audit`,
      channel: `${prefix}:changed`,
    };
    this.auditMaxLen = options.auditMaxLen ?? 10_000;
  }

  async readAll(): Promise<FlagOverrides> {
    const raw = await this.client.hgetall(this.keys.overrides);
    const result: FlagOverrides = {};
    for (const [field, value] of Object.entries(raw)) {
      const override = isFlagKey(field) ? parseOverride(value) : null;
      if (override && isFlagKey(field)) result[field] = override;
      else this.options.onInvalidEntry?.(field);
    }
    return result;
  }

  async write(
    key: FlagKey,
    override: FlagOverride | null,
    audit: { actor: string; reason?: string },
  ): Promise<FlagAuditEntry> {
    const value = override ? JSON.stringify(flagOverrideSchema.parse(override)) : '';
    const at = new Date().toISOString();
    const before = (await this.client.eval(
      WRITE_SCRIPT,
      2,
      this.keys.overrides,
      this.keys.audit,
      key,
      value,
      audit.actor,
      audit.reason ?? '',
      String(this.auditMaxLen),
      at,
      this.keys.channel,
    )) as string | null;
    return {
      key,
      before: parseOverride(before),
      after: override,
      actor: audit.actor,
      ...(audit.reason ? { reason: audit.reason } : {}),
      at,
    };
  }

  async history(limit = 20): Promise<FlagAuditEntry[]> {
    const entries = await this.client.xrevrange(this.keys.audit, '+', '-', 'COUNT', limit);
    const result: FlagAuditEntry[] = [];
    for (const [, fields] of entries) {
      const record: Record<string, string> = {};
      for (let i = 0; i + 1 < fields.length; i += 2) record[fields[i]!] = fields[i + 1]!;
      const key = record['key'];
      if (!key || !isFlagKey(key)) continue;
      result.push({
        key,
        before: parseOverride(record['before']),
        after: parseOverride(record['after']),
        actor: record['actor'] ?? '?',
        ...(record['reason'] ? { reason: record['reason'] } : {}),
        at: record['at'] ?? '',
      });
    }
    return result;
  }

  /**
   * Conexão dedicada de assinatura (o modo subscriber bloqueia outros comandos). A cada
   * (re)conexão também chama `onChange`, porque mensagens perdidas durante a queda não voltam.
   */
  subscribe(onChange: () => void): Promise<() => Promise<void>> {
    // Fila offline ligada e retentativas infinitas: se o Redis estiver fora na subida, a
    // assinatura acontece quando ele voltar (o processo não deixa de subir por isso).
    const subscriber = this.client.duplicate({
      lazyConnect: false,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
    });
    subscriber.on('error', () => undefined);
    subscriber.on('message', (channel: string) => {
      if (channel === this.keys.channel) onChange();
    });
    subscriber.on('ready', () => onChange());
    const subscribed = subscriber.subscribe(this.keys.channel).catch(() => undefined);
    return Promise.resolve(async () => {
      subscriber.disconnect();
      await subscribed;
    });
  }

  /** Aguarda a assinatura ativa (usado nos testes de integração). */
  static async waitSubscribed(client: Redis, channel: string, timeoutMs = 2_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = (await client.call('PUBSUB', 'NUMSUB', channel)) as [string, number];
      if (Number(result[1]) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`nenhum assinante em ${channel}`);
  }
}
