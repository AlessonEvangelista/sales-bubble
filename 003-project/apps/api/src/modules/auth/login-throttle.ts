import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ProblemException } from '../../http/problem.js';
import { CAPTCHA_VERIFIER, LOGIN_THROTTLE_STORE } from './tokens.js';
import type { CaptchaVerifier } from './captcha.js';

/** Contador com janela fixa (`INCR` + `EXPIRE`). */
export interface ThrottleStore {
  /** Incrementa e devolve o total na janela e os segundos até ela expirar. */
  hit(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
  count(key: string): Promise<number>;
  reset(key: string): Promise<void>;
}

/**
 * Política de força bruta do login (US-004, SEC-06; OWASP Authentication Cheat Sheet):
 * - mais de 5 tentativas no mesmo minuto para a conta → `429 RATE_LIMITED` + `Retry-After`;
 * - 3 senhas erradas (em 15 min) → `428 CAPTCHA_REQUIRED` até um `captcha_token` válido;
 * - por IP, teto mais alto (30/min) contra *password spraying*.
 * O contador é da conta (hash do e-mail), não só do IP, e vale também para e-mail inexistente
 * — o comportamento não revela se a conta existe.
 */
export const LOGIN_LIMITS = {
  attemptsPerMinute: 5,
  attemptsPerMinutePerIp: 30,
  failuresBeforeCaptcha: 3,
  failureWindowSeconds: 15 * 60,
} as const;

export interface LoginAttempt {
  subject: string;
  ipKey?: string | undefined;
  remoteIp?: string | undefined;
  captchaToken?: string | null | undefined;
}

@Injectable()
export class LoginThrottle {
  constructor(
    @Inject(LOGIN_THROTTLE_STORE) private readonly store: ThrottleStore,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
  ) {}

  /**
   * Antes de verificar a senha. Lança 429/428 conforme a política. `subject` e `ipKey` são
   * hashes (HMAC) — e-mail e IP em claro não vão para o Redis.
   */
  async check(attempt: LoginAttempt): Promise<void> {
    const { subject, ipKey, remoteIp, captchaToken } = attempt;
    const perAccount = await this.store.hit(`auth:login:attempts:${subject}`, 60);
    if (perAccount.count > LOGIN_LIMITS.attemptsPerMinute) throw rateLimited(perAccount.ttlSeconds);
    if (ipKey) {
      const perIp = await this.store.hit(`auth:login:ip:${ipKey}`, 60);
      if (perIp.count > LOGIN_LIMITS.attemptsPerMinutePerIp) throw rateLimited(perIp.ttlSeconds);
    }

    const failures = await this.store.count(failuresKey(subject));
    if (failures >= LOGIN_LIMITS.failuresBeforeCaptcha) {
      if (!captchaToken || !(await this.captcha.verify(captchaToken, remoteIp))) {
        throw new ProblemException('CAPTCHA_REQUIRED');
      }
    }
  }

  async recordFailure(subject: string): Promise<void> {
    await this.store.hit(failuresKey(subject), LOGIN_LIMITS.failureWindowSeconds);
  }

  async recordSuccess(subject: string): Promise<void> {
    await this.store.reset(failuresKey(subject));
  }
}

function failuresKey(subject: string): string {
  return `auth:login:failures:${subject}`;
}

function rateLimited(retryAfterSeconds: number): ProblemException {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  return new ProblemException('RATE_LIMITED', {}, { 'Retry-After': String(seconds) });
}

/** Store em memória do processo (testes e fallback quando o Redis cai). */
export class InMemoryThrottleStore implements ThrottleStore {
  readonly #entries = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const now = this.now();
    let entry = this.#entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + windowSeconds * 1000 };
      this.#entries.set(key, entry);
    }
    entry.count += 1;
    return { count: entry.count, ttlSeconds: (entry.expiresAt - now) / 1000 };
  }

  async count(key: string): Promise<number> {
    const entry = this.#entries.get(key);
    return entry && entry.expiresAt > this.now() ? entry.count : 0;
  }

  async reset(key: string): Promise<void> {
    this.#entries.delete(key);
  }
}

/**
 * Store no Redis (estado fora da instância — api-rest, "Statelessness"). Se o Redis falhar,
 * cai para o contador em memória do processo em vez de desligar a proteção ou o login.
 */
export class RedisThrottleStore implements ThrottleStore {
  readonly #logger = new Logger('LoginThrottle');
  readonly #fallback = new InMemoryThrottleStore();
  #lastWarn = 0;

  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    try {
      const result = await this.redis
        .multi()
        .incr(key)
        .expire(key, windowSeconds, 'NX')
        .ttl(key)
        .exec();
      const count = Number(result?.[0]?.[1]);
      const ttl = Number(result?.[2]?.[1]);
      if (!Number.isFinite(count)) throw new Error('resposta inesperada do Redis');
      return { count, ttlSeconds: ttl > 0 ? ttl : windowSeconds };
    } catch (error) {
      this.warn(error);
      return this.#fallback.hit(key, windowSeconds);
    }
  }

  async count(key: string): Promise<number> {
    try {
      return Number((await this.redis.get(key)) ?? 0);
    } catch (error) {
      this.warn(error);
      return this.#fallback.count(key);
    }
  }

  async reset(key: string): Promise<void> {
    await this.#fallback.reset(key);
    try {
      await this.redis.del(key);
    } catch (error) {
      this.warn(error);
    }
  }

  private warn(error: unknown): void {
    if (Date.now() - this.#lastWarn < 60_000) return;
    this.#lastWarn = Date.now();
    this.#logger.warn(
      `Redis indisponível; throttling do login no processo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
