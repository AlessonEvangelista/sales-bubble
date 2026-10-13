import { Inject, Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import jwt from 'jsonwebtoken';
import type { ApiEnv } from '../../config/env.js';
import { JWT_KEYS } from './tokens.js';

/** Claims do access token (api-rest §1.2). Sem PII: só id, papel, tipo e pseudônimo. */
export interface TokenPayload {
  sub: string;
  role: string;
  account_type: string;
  pseudonym: string;
}

export interface JwtKeys {
  privateKey: string;
  publicKey: string;
  ttlSeconds: number;
}

const ISSUER = 'bolha-venda';
const AUDIENCE = 'bolha-venda-api';

/**
 * Lê o par RS256 dos caminhos do ambiente. Falha fechado: sem chave a API não sobe — nunca
 * gera um par efêmero (tokens deixariam de valer a cada deploy e entre instâncias).
 */
export function loadJwtKeys(
  env: Pick<
    ApiEnv,
    'JWT_ACCESS_PRIVATE_KEY_PATH' | 'JWT_ACCESS_PUBLIC_KEY_PATH' | 'JWT_ACCESS_TTL_SECONDS'
  >,
  cwd: string = process.cwd(),
): JwtKeys {
  return {
    privateKey: readKey(env.JWT_ACCESS_PRIVATE_KEY_PATH, 'JWT_ACCESS_PRIVATE_KEY_PATH', cwd),
    publicKey: readKey(env.JWT_ACCESS_PUBLIC_KEY_PATH, 'JWT_ACCESS_PUBLIC_KEY_PATH', cwd),
    ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
  };
}

/** Mesmo critério do `loadDotEnv`: diretório atual ou raiz do monorepo (apps/api → ../..). */
function readKey(path: string, name: string, cwd: string): string {
  const candidates = isAbsolute(path) ? [path] : [resolve(cwd, path), resolve(cwd, '../..', path)];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`${name}: arquivo de chave não encontrado (em dev: npm run keys:dev).`);
  }
  return readFileSync(found, 'utf8');
}

@Injectable()
export class TokenService {
  constructor(@Inject(JWT_KEYS) private readonly keys: JwtKeys) {}

  /** Access token RS256 de vida curta (15 min por padrão — US-004). */
  signAccessToken(payload: TokenPayload): { accessToken: string; expiresIn: number } {
    const expiresIn = this.keys.ttlSeconds;
    const accessToken = jwt.sign(payload, this.keys.privateKey, {
      algorithm: 'RS256',
      expiresIn,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { accessToken, expiresIn };
  }

  /** Valida assinatura, algoritmo (só RS256), emissor, audiência e expiração. */
  verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.keys.publicKey, {
      algorithms: ['RS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new jwt.JsonWebTokenError('payload inválido');
    }
    return {
      sub: decoded.sub,
      role: String(decoded['role']),
      account_type: String(decoded['account_type']),
      pseudonym: String(decoded['pseudonym']),
    };
  }
}
