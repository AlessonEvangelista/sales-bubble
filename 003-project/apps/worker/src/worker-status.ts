import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { BOUNDED_CONTEXTS } from '@bolha/core-domain';

/** Registra no log que o worker subiu; placeholder até existirem processadores reais. */
@Injectable()
export class WorkerStatus implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkerStatus.name);

  describe(): string {
    return `worker pronto (${BOUNDED_CONTEXTS.length} bounded contexts)`;
  }

  onApplicationBootstrap(): void {
    this.logger.log(this.describe());
  }
}
