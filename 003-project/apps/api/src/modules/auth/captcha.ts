import type { ApiEnv } from '../../config/env.js';

/** Verificação do `captcha_token` enviado pelo cliente (US-004 — após 3 falhas). */
export interface CaptchaVerifier {
  verify(token: string, ip?: string): Promise<boolean>;
}

const SITEVERIFY = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
} as const;

/**
 * - `none` (dev/CI — recusado em produção por `parseApiEnv`): aceita qualquer token não vazio,
 *   para o fluxo 428 → reenvio com token ser exercitável localmente;
 * - `turnstile` / `hcaptcha`: `siteverify` do provedor (timeout de 5 s; erro = inválido).
 */
export function createCaptchaVerifier(
  env: Pick<ApiEnv, 'CAPTCHA_PROVIDER' | 'CAPTCHA_SECRET'>,
  fetchImpl: typeof fetch = fetch,
): CaptchaVerifier {
  const provider = env.CAPTCHA_PROVIDER;
  if (provider === 'none') {
    return { verify: async (token) => token.trim().length > 0 };
  }
  const secret = env.CAPTCHA_SECRET ?? '';
  return {
    verify: async (token, ip) => {
      const form = new URLSearchParams({ secret, response: token });
      if (ip) form.set('remoteip', ip);
      try {
        const response = await fetchImpl(SITEVERIFY[provider], {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) return false;
        const result = (await response.json()) as { success?: unknown };
        return result.success === true;
      } catch {
        return false;
      }
    },
  };
}
