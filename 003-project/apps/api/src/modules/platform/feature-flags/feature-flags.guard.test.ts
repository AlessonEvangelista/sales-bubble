import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FlagOverride } from '@bolha/contracts';
import { CachedFeatureFlags, InMemoryFlagStore, type FlagOverrides } from '@bolha/database';
import { describe, expect, it } from 'vitest';
import { FeatureDisabledException } from './feature-disabled.exception.js';
import { FeatureFlagsGuard, flagContextFromRequest } from './feature-flags.guard.js';
import { AllowInMaintenance, FeatureGate } from './feature-gate.decorator.js';
import { FlagsController } from './flags.controller.js';

const off: FlagOverride = {
  enabled: false,
  updatedBy: 'on-call',
  updatedAt: '2026-10-09T12:00:00Z',
};
const on: FlagOverride = { ...off, enabled: true };

@FeatureGate('bubble_creation_enabled')
class BubblesController {
  create(): void {}
  @FeatureGate('payments_enabled')
  join(): void {}
}

class WebhooksController {
  @AllowInMaintenance()
  receive(): void {}
}

function context(
  target: object,
  handler: () => void,
  request: Record<string, unknown> = {},
): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => ({ method: 'POST', url: '/api/v1/x', ...request }) }),
  } as unknown as ExecutionContext;
}

function guard(overrides: FlagOverrides = {}): FeatureFlagsGuard {
  const flags = new CachedFeatureFlags({ store: new InMemoryFlagStore(overrides) });
  return new FeatureFlagsGuard(new Reflector(), flags);
}

const bubbles = BubblesController.prototype;
const webhooks = WebhooksController.prototype;

async function rejection(promise: Promise<boolean>): Promise<FeatureDisabledException> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(FeatureDisabledException);
  return error as FeatureDisabledException;
}

describe('FeatureFlagsGuard', () => {
  it('libera quando as flags exigidas estão ligadas (defaults do catálogo)', async () => {
    await expect(guard().canActivate(context(BubblesController, bubbles.join))).resolves.toBe(true);
  });

  it('@FeatureGate da classe desligado → 503 problem+json com a flag', async () => {
    const error = await rejection(
      guard({ bubble_creation_enabled: off }).canActivate(
        context(BubblesController, bubbles.create),
      ),
    );
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      flag: 'bubble_creation_enabled',
      instance: '/api/v1/x',
    });
  });

  it('@FeatureGate do método soma ao da classe', async () => {
    const error = await rejection(
      guard({ payments_enabled: off }).canActivate(context(BubblesController, bubbles.join)),
    );
    expect(error.flag).toBe('payments_enabled');
  });

  it('maintenance_mode bloqueia escrita, mas não leitura nem rotas liberadas', async () => {
    const g = guard({ maintenance_mode: on });
    expect((await rejection(g.canActivate(context(BubblesController, bubbles.create)))).flag).toBe(
      'maintenance_mode',
    );
    await expect(
      g.canActivate(context(BubblesController, bubbles.create, { method: 'GET' })),
    ).resolves.toBe(true);
    await expect(g.canActivate(context(WebhooksController, webhooks.receive))).resolves.toBe(true);
  });

  it('segmentação usa o usuário autenticado', async () => {
    const g = guard({ payments_enabled: { ...on, rules: { accountTypes: ['PJ'] } } });
    await rejection(g.canActivate(context(BubblesController, bubbles.join)));
    await expect(
      g.canActivate(context(BubblesController, bubbles.join, { user: { accountType: 'PJ' } })),
    ).resolves.toBe(true);
  });
});

describe('flagContextFromRequest', () => {
  it('extrai só id, tipo e papéis válidos', () => {
    expect(flagContextFromRequest({})).toBeUndefined();
    expect(
      flagContextFromRequest({ user: { id: 'u1', accountType: 'XX', roles: ['beta', 3] } }),
    ).toEqual({ accountId: 'u1', roles: ['beta'] });
  });
});

describe('FlagsController', () => {
  it('GET /flags devolve só flags públicas', async () => {
    const flags = new CachedFeatureFlags({
      store: new InMemoryFlagStore({ maintenance_mode: on }),
    });
    const body = await new FlagsController(flags).list();
    expect(body.flags.maintenance_mode).toBe(true);
    expect(body.flags).not.toHaveProperty('captures_paused');
    expect(typeof body.evaluated_at).toBe('string');
  });
});
