import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Parâmetros NIST SP 800-63B / OWASP Password Storage Cheat Sheet para Argon2id (SEC-06) */
export const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,       // 3 iterações
  parallelism: 4,    // 4 threads
};

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    return (await argon2.hash(password, ARGON2_OPTIONS)) as string;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Dummy verify para mitigar ataques de timing (anti-enumeração, SEC-08).
   * Executa uma verificação real com hash sintetizado para ter tempo constante quando usuário não existe.
   */
  async dummyVerify(plain: string): Promise<boolean> {
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9v5vFjD/W+mXw9Lz6wN3Z0xP4qJ3l0fB1e2y8a4k9gA';
    try {
      await argon2.verify(dummyHash, plain);
    } catch {
      // Ignora erro
    }
    return false;
  }
}
