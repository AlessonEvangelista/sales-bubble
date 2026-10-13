import {
  Global,
  Inject,
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Redis } from 'ioredis';
import type { ApiEnv } from '../../config/env.js';
import { ProblemFilter } from '../../http/problem.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { createCaptchaVerifier, type CaptchaVerifier } from './captcha.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { LoginThrottle, RedisThrottleStore, type ThrottleStore } from './login-throttle.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';
import { loadJwtKeys, TokenService, type JwtKeys } from './token.service.js';
import { CAPTCHA_VERIFIER, JWT_KEYS, LOGIN_THROTTLE_STORE } from './tokens.js';

const AUTH_LIFECYCLE = Symbol('AUTH_LIFECYCLE');

interface AuthDependencies {
  keys: JwtKeys;
  throttleStore: ThrottleStore;
  captcha: CaptchaVerifier;
  close?(): Promise<void>;
}

/**
 * Identidade e autenticação (E2): cadastro, login, sessão (refresh rotativo), `GET /me` e os
 * guards de autorização (US-008). Depende do `DatabaseModule` (global). Global para os módulos
 * de contexto usarem `@UseGuards(AuthGuard, RolesGuard)` sem reimportar.
 */
@Global()
@Module({})
export class AuthModule implements OnApplicationShutdown {
  constructor(@Inject(AUTH_LIFECYCLE) private readonly deps: AuthDependencies) {}

  static register(env: ApiEnv): DynamicModule {
    return AuthModule.forDependencies(() => {
      // Conecta já na subida; sem fila offline, comando com o Redis fora falha na hora e o
      // store usa o contador em memória até reconectar.
      const redis = new Redis(env.REDIS_URL, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
      });
      // Sem listener o ioredis loga "Unhandled error event"; o store cai para memória.
      redis.on('error', () => undefined);
      return {
        keys: loadJwtKeys(env),
        throttleStore: new RedisThrottleStore(redis),
        captcha: createCaptchaVerifier(env),
        close: async () => redis.disconnect(),
      };
    });
  }

  /** Testes: chaves, store de throttling e CAPTCHA prontos. */
  static forTesting(deps: AuthDependencies): DynamicModule {
    return AuthModule.forDependencies(() => deps);
  }

  private static forDependencies(factory: () => AuthDependencies): DynamicModule {
    return {
      module: AuthModule,
      controllers: [AuthController, MeController],
      providers: [
        { provide: AUTH_LIFECYCLE, useFactory: factory },
        {
          provide: JWT_KEYS,
          useFactory: (d: AuthDependencies) => d.keys,
          inject: [AUTH_LIFECYCLE],
        },
        {
          provide: LOGIN_THROTTLE_STORE,
          useFactory: (d: AuthDependencies) => d.throttleStore,
          inject: [AUTH_LIFECYCLE],
        },
        {
          provide: CAPTCHA_VERIFIER,
          useFactory: (d: AuthDependencies) => d.captcha,
          inject: [AUTH_LIFECYCLE],
        },
        AuthService,
        SessionService,
        MeService,
        PasswordHasher,
        TokenService,
        LoginThrottle,
        AuthGuard,
        RolesGuard,
        { provide: APP_FILTER, useClass: ProblemFilter },
      ],
      exports: [TokenService, AuthGuard, RolesGuard],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.deps.close?.();
  }
}
