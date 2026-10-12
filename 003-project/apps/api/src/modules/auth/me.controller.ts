import { Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import type { MeResponse } from '@bolha/contracts';
import { AuthGuard, type AuthenticatedRequest } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MeService } from './me.service.js';

@Controller('me')
@UseGuards(AuthGuard, RolesGuard)
export class MeController {
  constructor(@Inject(MeService) private readonly me: MeService) {}

  /** `GET /me` — dados do titular, mascarados (+ ETag para o `If-Match` do `PATCH /me`). */
  @Get()
  async get(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const body = await this.me.getMe(req.user!.sub);
    const etag = createHash('sha256').update(JSON.stringify(body)).digest('base64url');
    res.setHeader('ETag', `"${etag}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return body;
  }
}
