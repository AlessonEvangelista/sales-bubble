import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import {
  getErrorDefinition,
  problemTypeUri,
  type ErrorCode,
  type FieldError,
} from '@bolha/contracts';

/** Membros de extensão do problem+json (api-rest §1.4); `errors` só em `VALIDATION_FAILED`. */
export interface ProblemExtensions {
  detail?: string;
  errors?: FieldError[];
  [member: string]: unknown;
}

/**
 * Erro de negócio previsto, respondido como `application/problem+json` (RFC 9457) com o
 * status e o `title` do catálogo de `@bolha/contracts` — o `code` é o contrato do front.
 */
export class ProblemException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    extensions: ProblemExtensions = {},
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    const definition = getErrorDefinition(code);
    super(
      {
        type: problemTypeUri(code),
        title: definition.title,
        status: definition.status,
        ...(definition.message ? { detail: definition.message } : {}),
        ...extensions,
        code,
      },
      definition.status,
    );
  }
}

interface ProblemResponse {
  status(code: number): ProblemResponse;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
}

/** Responde `ProblemException` como `application/problem+json`, sem cache. */
@Catch(ProblemException)
export class ProblemFilter implements ExceptionFilter<ProblemException> {
  catch(exception: ProblemException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ProblemResponse>();
    response.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(exception.headers)) {
      response.setHeader(name, value);
    }
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
