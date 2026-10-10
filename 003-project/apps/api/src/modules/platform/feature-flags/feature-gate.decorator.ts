import { SetMetadata } from '@nestjs/common';
import type { FlagKey } from '@bolha/contracts';

export const FEATURE_GATE_METADATA = 'bolha:feature-gate';
export const ALLOW_IN_MAINTENANCE_METADATA = 'bolha:allow-in-maintenance';

/**
 * Exige que as flags estejam LIGADAS para a rota (guia §9: `@FeatureGate('payments_enabled')`).
 * Desligada → 503 `application/problem+json` (`code: SERVICE_UNAVAILABLE`, extensão `flag`).
 * Pode ser usado no controller (vale para todas as rotas) ou no método.
 *
 * Ex.: `@FeatureGate('bubble_creation_enabled')` em `POST /bubbles` e `/publish`
 *      (plano de release §3).
 */
export const FeatureGate = (...keys: [FlagKey, ...FlagKey[]]) =>
  SetMetadata(FEATURE_GATE_METADATA, keys);

/**
 * Libera uma rota de escrita durante `maintenance_mode` (ex.: webhooks do gateway, para que
 * capturas e estornos não fiquem presos — plano de release §3, regra dos kill switches).
 */
export const AllowInMaintenance = () => SetMetadata(ALLOW_IN_MAINTENANCE_METADATA, true);
