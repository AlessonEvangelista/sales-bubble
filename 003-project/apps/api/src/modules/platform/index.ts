/**
 * API pública do módulo `platform` (guia §2.2: outros módulos só importam por aqui ou pelo
 * `*.module.ts`). Feature flags e kill switches: BV-113 / EN-033.
 */
export { FeatureFlagsModule } from './feature-flags/feature-flags.module.js';
export { AllowInMaintenance, FeatureGate } from './feature-flags/feature-gate.decorator.js';
export {
  FeatureDisabledException,
  type FeatureDisabledProblem,
} from './feature-flags/feature-disabled.exception.js';
export { FEATURE_FLAGS } from './feature-flags/tokens.js';
export { flagContextFromRequest } from './feature-flags/feature-flags.guard.js';
