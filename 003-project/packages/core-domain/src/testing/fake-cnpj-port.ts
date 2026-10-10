import {
  Cnpj,
  type CnpjLookupFailure,
  type CnpjPort,
  type CnpjRegistration,
  type CnpjSituation,
} from '../identity/index.js';
import type { Clock } from '../shared/clock.js';
import { DomainInvariantViolation } from '../shared/errors.js';
import { err, ok, type Result } from '../shared/result.js';

export interface FakeCnpjRecord {
  readonly situation: CnpjSituation;
  readonly legalName?: string;
  readonly mainCnae?: string;
}

export interface FakeCnpjPortOptions {
  readonly clock: Clock;
  /**
   * Resposta para CNPJ válido não cadastrado no fake. Padrão `ATIVA` (dev com
   * `CNPJ_PROVIDER=fake` consegue cadastrar qualquer PJ com DV correto); `NOT_FOUND` para testes
   * que exigem cadastro explícito.
   */
  readonly fallback?: CnpjSituation | 'NOT_FOUND';
}

/**
 * `CnpjPort` fake e determinístico (ADR-0008, `CNPJ_PROVIDER=fake`). Cenários:
 * situação por CNPJ (`register`), não encontrado e provedores indisponíveis
 * (`failNextWithUnavailable(n)` → `PENDING_VERIFICATION` no caso de uso). Registra as consultas.
 */
export class FakeCnpjPort implements CnpjPort {
  /** CNPJs consultados, na ordem (normalizados). Só em testes — em produção CNPJ é PII. */
  readonly lookups: string[] = [];

  private readonly clock: Clock;
  private readonly fallback: CnpjSituation | 'NOT_FOUND';
  private readonly records = new Map<string, FakeCnpjRecord>();
  private unavailableRemaining = 0;

  constructor(options: FakeCnpjPortOptions) {
    this.clock = options.clock;
    this.fallback = options.fallback ?? 'ATIVA';
  }

  register(cnpj: Cnpj | string, record: FakeCnpjRecord): this {
    this.records.set(toCnpj(cnpj).value, record);
    return this;
  }

  /** As próximas `times` consultas respondem `PROVIDER_UNAVAILABLE` (primário e fallback fora). */
  failNextWithUnavailable(times = 1): void {
    this.unavailableRemaining += times;
  }

  lookup(cnpj: Cnpj): Promise<Result<CnpjRegistration, CnpjLookupFailure>> {
    this.lookups.push(cnpj.value);
    if (this.unavailableRemaining > 0) {
      this.unavailableRemaining--;
      return Promise.resolve(
        err({ code: 'PROVIDER_UNAVAILABLE', reason: 'BrasilAPI e ReceitaWS indisponíveis (fake)' }),
      );
    }
    const record =
      this.records.get(cnpj.value) ??
      (this.fallback === 'NOT_FOUND' ? undefined : { situation: this.fallback });
    if (!record) return Promise.resolve(err({ code: 'NOT_FOUND' }));
    return Promise.resolve(
      ok({
        cnpj,
        situation: record.situation,
        legalName: record.legalName ?? 'Empresa Fake Ltda',
        mainCnae: record.mainCnae ?? '4789099',
        provider: 'FAKE',
        checkedAt: this.clock.now(),
      }),
    );
  }
}

function toCnpj(cnpj: Cnpj | string): Cnpj {
  if (typeof cnpj !== 'string') return cnpj;
  const parsed = Cnpj.parse(cnpj);
  if (!parsed.ok) throw new DomainInvariantViolation('CNPJ inválido no cenário do fake');
  return parsed.value;
}
