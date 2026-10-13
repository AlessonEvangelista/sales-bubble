import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProblemDetails } from '@bolha/contracts';
import { startAuthApp, testJwtKeys, type TestApp } from '../../testing/http-app.js';
import { AccountTypes, AuthGuard, Public, Roles, RolesGuard } from './index.js';

/** Rotas fictícias com as anotações que os módulos de bolha/lance/cota vão usar (Spec §2). */
@Controller('bubbles')
@UseGuards(AuthGuard, RolesGuard)
class MatrixController {
  @Public()
  @Get()
  list(): string[] {
    return [];
  }

  @Post()
  @HttpCode(201)
  create(): void {}

  @Post(':id/bids')
  @HttpCode(201)
  @AccountTypes('PJ')
  @Roles('user')
  bid(): void {}

  @Post(':id/quotas')
  @HttpCode(201)
  @Roles('user')
  quota(): void {}
}

const token = (role: string, accountType: 'PF' | 'PJ') =>
  jwt.sign(
    { sub: 'acc', role, account_type: accountType, pseudonym: 'Bolhista#0000' },
    testJwtKeys.privateKey,
    { algorithm: 'RS256', issuer: 'bolha-venda', audience: 'bolha-venda-api', expiresIn: 60 },
  );

const actors: Record<string, string | undefined> = {
  Visitante: undefined,
  PF: token('USER', 'PF'),
  PJ: token('USER', 'PJ'),
  Moderador: token('MODERATOR', 'PF'),
};

describe('Matriz papel × ação (US-008)', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await startAuthApp({ controllers: [MatrixController] });
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['Visitante', 'GET', '/bubbles', 200, undefined],
    ['Visitante', 'POST', '/bubbles', 401, 'UNAUTHENTICATED'],
    ['PF', 'POST', '/bubbles/1/bids', 403, 'FORBIDDEN'],
    ['PJ', 'POST', '/bubbles/1/bids', 201, undefined],
    ['Moderador', 'POST', '/bubbles/1/quotas', 403, 'FORBIDDEN'],
    ['PF', 'POST', '/bubbles/1/quotas', 201, undefined],
  ])('%s %s %s → %i', async (actor, method, path, status, code) => {
    const bearer = actors[actor];
    const response = await app.request(path, {
      method,
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    });

    expect(response.status).toBe(status);
    if (code) expect(ProblemDetails.parse(await response.json()).code).toBe(code);
  });
});
