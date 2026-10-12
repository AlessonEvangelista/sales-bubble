import {
  Global,
  Inject,
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createPrismaClient, PrismaClient } from '@bolha/database';
import { createPiiCryptoFromEnv, type PiiCrypto } from '@bolha/database/pii';
import type { ApiEnv } from '../../config/env.js';
import { PiiService } from './pii.service.js';
import { PII_CRYPTO } from './tokens.js';

/**
 * Acesso a dados da API: um `PrismaClient` por processo (Prisma 7 + adapter `pg`, BV-107) e a
 * cifra de PII (BV-109). Global: os módulos de contexto injetam `PrismaClient` e `PiiService`.
 * Sem URL padrão embutida — o ambiente já foi validado em `parseApiEnv` (TM-14).
 */
@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  static register(env: Pick<ApiEnv, 'DATABASE_URL'>): DynamicModule {
    return DatabaseModule.forClients(
      createPrismaClient(env.DATABASE_URL),
      createPiiCryptoFromEnv(process.env),
    );
  }

  /** Testes: injeta clientes prontos (ex.: fakes em memória). */
  static forClients(prisma: PrismaClient, pii: PiiCrypto): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: PrismaClient, useValue: prisma },
        { provide: PII_CRYPTO, useValue: pii },
        PiiService,
      ],
      exports: [PrismaClient, PiiService],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
