import type { FlagKey, FlagOverride } from '@bolha/contracts';
import type { FlagOverrides } from './evaluate.js';

/** Registro de auditoria de uma alteração de flag (vai para `audit_log` quando existir). */
export interface FlagAuditEntry {
  key: FlagKey;
  before: FlagOverride | null;
  after: FlagOverride | null;
  actor: string;
  reason?: string;
  at: string;
}

/**
 * Porta de armazenamento dos overrides em runtime (kill switches).
 *
 * Guia §9 propõe a tabela `feature_flags` (módulo `platform`) + cache de 10 s + invalidação por
 * Redis pub/sub + auditoria em `audit_log`. Enquanto a tabela não existe (schema no BV-107),
 * o adapter em uso é o Redis (`RedisFlagStore`, persistido por AOF). Um adapter Postgres pode
 * implementar esta mesma porta sem mudar quem consome `FeatureFlags`.
 */
export interface FlagOverrideStore {
  readAll(): Promise<FlagOverrides>;
  /** Grava (`override`) ou remove (`null`) o override, registra auditoria e notifica. */
  write(
    key: FlagKey,
    override: FlagOverride | null,
    audit: { actor: string; reason?: string },
  ): Promise<FlagAuditEntry>;
  /** Últimas alterações (mais recentes primeiro). */
  history(limit?: number): Promise<FlagAuditEntry[]>;
  /** Assina mudanças (de qualquer processo). Devolve a função para cancelar. */
  subscribe(onChange: () => void): Promise<() => Promise<void>>;
}

/** Store em memória: testes unitários e processos sem Redis. */
export class InMemoryFlagStore implements FlagOverrideStore {
  private overrides: FlagOverrides = {};
  private readonly audit: FlagAuditEntry[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(
    initial: FlagOverrides = {},
    private readonly now: () => Date = () => new Date(),
  ) {
    this.overrides = { ...initial };
  }

  readAll(): Promise<FlagOverrides> {
    return Promise.resolve({ ...this.overrides });
  }

  write(
    key: FlagKey,
    override: FlagOverride | null,
    audit: { actor: string; reason?: string },
  ): Promise<FlagAuditEntry> {
    const before = this.overrides[key] ?? null;
    const next = { ...this.overrides };
    if (override) next[key] = override;
    else delete next[key];
    this.overrides = next;
    const entry: FlagAuditEntry = {
      key,
      before,
      after: override,
      actor: audit.actor,
      ...(audit.reason ? { reason: audit.reason } : {}),
      at: this.now().toISOString(),
    };
    this.audit.unshift(entry);
    for (const listener of this.listeners) listener();
    return Promise.resolve(entry);
  }

  history(limit = 20): Promise<FlagAuditEntry[]> {
    return Promise.resolve(this.audit.slice(0, limit));
  }

  subscribe(onChange: () => void): Promise<() => Promise<void>> {
    this.listeners.add(onChange);
    return Promise.resolve(() => {
      this.listeners.delete(onChange);
      return Promise.resolve();
    });
  }
}
