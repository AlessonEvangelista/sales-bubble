import {
  HttpException,
  type CallHandler,
  type ExecutionContext,
  type LoggerService,
  type NestInterceptor,
} from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { catchError, throwError, type Observable } from 'rxjs';
import type { Logger } from './logger.js';
import { REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext } from './request-context.js';
import { captureError } from './sentry.js';

/**
 * Adaptador do logger pino para o `LoggerService` do NestJS: os logs do framework
 * (bootstrap, rotas, exceções) saem no mesmo JSON estruturado e com a mesma redaction.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...params: unknown[]): void {
    this.write('info', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    // Nest chama error(message, stack?, context?).
    const [maybeStack, ...rest] = params;
    if (typeof maybeStack === 'string' && maybeStack.includes('\n    at ')) {
      this.write('error', message, rest, { stack: maybeStack });
    } else {
      this.write('error', message, params);
    }
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('trace', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  private write(
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: unknown,
    params: unknown[],
    extra: Record<string, unknown> = {},
  ): void {
    // O último parâmetro string é o "contexto" do Nest (nome da classe) → campo `module`.
    const context = typeof params.at(-1) === 'string' ? (params.at(-1) as string) : undefined;
    const fields = { ...extra, ...(context ? { module: context } : {}) };
    if (message instanceof Error) {
      this.logger[level]({ ...fields, err: message }, message.message);
    } else if (typeof message === 'object' && message !== null) {
      this.logger[level]({ ...fields, ...(message as Record<string, unknown>) });
    } else {
      this.logger[level](fields, String(message));
    }
  }
}

/** Formas mínimas de req/res do Express usadas pelo middleware (sem depender de @types/express). */
interface HttpRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  route?: { path?: string };
  baseUrl?: string;
}
interface HttpResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  once(event: 'finish', listener: () => void): unknown;
}

/**
 * Middleware HTTP (registrado com `app.use`): define o `request_id` (cabeçalho `X-Request-Id`
 * reaproveitado se seguro, senão UUID), devolve-o na resposta, grava-o no span ativo e emite o
 * log de acesso `http.request.completed` (método, rota, status, duração — nunca query string,
 * corpo ou cabeçalhos).
 */
export function requestContextMiddleware(logger: Logger) {
  return (req: HttpRequest, res: HttpResponse, next: () => void): void => {
    const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    res.setHeader(REQUEST_ID_HEADER, requestId);
    trace.getActiveSpan()?.setAttribute('bolha.request_id', requestId);
    const startedAt = process.hrtime.bigint();

    runWithRequestContext({ requestId }, () => {
      res.once('finish', () => {
        const path = (req.originalUrl ?? req.url ?? '').split(/[?#]/)[0] ?? '';
        const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : undefined;
        const status = res.statusCode;
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const isProbe = /\/health(\/|$)/.test(path);
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : isProbe ? 'debug' : 'info';
        // O callback de `finish` roda fora do AsyncLocalStorage; repassa o contexto.
        runWithRequestContext({ requestId }, () =>
          logger[level](
            {
              event: 'http.request.completed',
              http: {
                method: req.method,
                path,
                route,
                status_code: status,
                duration_ms: Math.round(durationMs * 100) / 100,
              },
            },
            'http request completed',
          ),
        );
      });
      next();
    });
  };
}

/**
 * Interceptor global: erros inesperados (não-`HttpException` ou status ≥ 500) vão para o log
 * (`http.request.failed`) e para o Sentry (com `trace_id`), e seguem para o tratamento padrão
 * do Nest (o mapeamento RFC 9457 é do BV-111). Erros 4xx de regra de negócio não alertam.
 */
export class ErrorReportingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        if (status >= 500) {
          this.logger.error(
            { event: 'http.request.failed', err: error, handler: context.getHandler().name },
            'unhandled error',
          );
          captureError(error, { handler: context.getHandler().name });
        }
        return throwError(() => error);
      }),
    );
  }
}
