/**
 * `@bolha/observability` — entrada PURA (sem APIs do Node), segura para o browser.
 * Redaction de PII compartilhada por api, worker e web (ADR-0012 item 4, SEC-05).
 * A parte de servidor (OpenTelemetry, pino) está em `@bolha/observability/node`.
 */
export {
  REDACTED,
  MAX_REDACT_INPUT,
  PII_DETECTORS,
  findPii,
  isSensitiveKey,
  redactAttributes,
  redactDeep,
  redactString,
  type RedactOptions,
} from './redaction.js';
