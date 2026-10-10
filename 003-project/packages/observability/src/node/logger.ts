import { trace } from '@opentelemetry/api';
import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { REDACTED, redactDeep, redactString } from '../redaction.js';
import { getRequestContext } from './request-context.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  /** `bolha-api` | `bolha-worker` (= `service.name` do OTel). */
  service: string;
  /** `APP_ENV` (local | ci | staging | production). */
  env: string;
  /** `APP_VERSION` (= `service.version`). */
  version: string;
  level: LogLevel;
}

/**
 * Caminhos do `redact` nativo do pino (slo-observabilidade.md §5, primeira camada).
 * O pino só aceita curingas de um nível (`*.cpf`), por isso o {@link redactDeep} no
 * `formatters.log` complementa em qualquer profundidade e por padrão no texto.
 */
export const PINO_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'req.headers["idempotency-key"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'req.body',
  'body',
  '*.cpf',
  '*.cnpj',
  '*.email',
  '*.document',
  '*.phone',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.cardNumber',
] as const;

/**
 * Logger pino em JSON no stdout com os campos fixos do slo-observabilidade.md §5:
 * `time` (ISO 8601 UTC), `level` (rótulo), `service`, `env`, `version`, `trace_id`, `span_id`,
 * `request_id`, `msg` — e sem PII (redact por caminho + {@link redactDeep} + mensagens mascaradas).
 *
 * `trace_id`/`span_id` vêm do span OTel ativo (correlação trace–log); `request_id` vem do
 * contexto da requisição/job ({@link getRequestContext}).
 */
export function createLogger(config: LoggerConfig, destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: config.level,
    messageKey: 'msg',
    // Idempotente: o `formatters.log` já pode ter serializado o erro; não reserializar (senão
    // `type` viraria 'Object').
    serializers: { err: serializeError },
    base: { service: config.service, env: config.env, version: config.version },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: [...PINO_REDACT_PATHS], censor: REDACTED },
    formatters: {
      level: (label) => ({ level: label }),
      // Segunda camada: qualquer chave sensível em qualquer profundidade + padrões no texto.
      // (O erro é serializado aqui, antes da redaction, para manter `type`/`stack`.)
      log: (object) =>
        redactDeep(
          object.err instanceof Error
            ? { ...object, err: pino.stdSerializers.err(object.err) }
            : object,
        ),
    },
    hooks: {
      // Terceira camada: a linha JSON final passa pela máscara de padrões (e-mail, CPF, CNPJ,
      // telefone, JWT), pegando o que tenha vindo de serializers ou campos não previstos.
      streamWrite: (line) => redactString(line),
      // Mensagens (`msg`) e argumentos de interpolação também passam pela máscara.
      logMethod(args, method) {
        const safe = args.map((arg: unknown) =>
          typeof arg === 'string' ? redactString(arg) : arg,
        ) as Parameters<typeof method>;
        method.apply(this, safe);
      },
    },
    mixin: correlationFields,
  };
  return destination ? pino(options, destination) : pino(options);
}

/** Serializa `Error` com o serializer padrão do pino; valores já serializados passam intactos. */
function serializeError(value: unknown): unknown {
  return value instanceof Error ? pino.stdSerializers.err(value) : value;
}

/** Campos de correlação adicionados a cada linha de log. */
export function correlationFields(): Record<string, string> {
  const fields: Record<string, string> = {};
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext && trace.isSpanContextValid(spanContext)) {
    fields.trace_id = spanContext.traceId;
    fields.span_id = spanContext.spanId;
  }
  const requestId = getRequestContext()?.requestId;
  if (requestId) fields.request_id = requestId;
  return fields;
}

export type { DestinationStream, Logger } from 'pino';
