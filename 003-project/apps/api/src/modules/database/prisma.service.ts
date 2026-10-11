import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createPrismaClient, PrismaClient } from '@bolha/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env['DATABASE_URL'] || 'postgresql://bolha:bolha_dev_change_me@localhost:5432/bolha_venda';
    super({
      // @ts-expect-error adapter PrismaPg
      adapter: createPrismaClient(url)['adapter'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch {
      // Deixa falhar graciosamente se banco offline em testes unitários
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
