import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

/** Argon2id — parâmetros do OWASP Password Storage Cheat Sheet (SEC-06). */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

@Injectable()
export class PasswordHasher {
  #dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Verificação com o mesmo custo de uma real, para conta inexistente/duplicada (SEC-08):
   * o hash fictício é gerado uma vez com os mesmos parâmetros, então o tempo de resposta não
   * revela se o e-mail existe. Sempre `false`.
   */
  async dummyVerify(plain: string): Promise<false> {
    this.#dummyHash ??= this.hash(randomBytes(32).toString('base64'));
    await this.verify(await this.#dummyHash, plain);
    return false;
  }
}
