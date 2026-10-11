import { Controller, Get, Header, Inject } from '@nestjs/common';
import { FLAGS_PATH, type FeatureFlags, type PublicFlagsResponse } from '@bolha/contracts';
import { FEATURE_FLAGS } from './tokens.js';

/**
 * `GET /api/v1/flags` — público (guia §9): o front lê com `useFlag('x')`. Só flags marcadas
 * `public` no catálogo; avaliadas sem contexto de usuário (a segmentação por usuário entra
 * quando houver sessão — onda 2). O servidor continua sendo a barreira real (FeatureGate).
 */
@Controller(FLAGS_PATH.replace(/^\//, ''))
export class FlagsController {
  constructor(@Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=5')
  async list(): Promise<PublicFlagsResponse> {
    return { flags: await this.flags.publicFlags(), evaluated_at: new Date().toISOString() };
  }
}
