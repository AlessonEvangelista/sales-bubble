import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FlagKey } from '@bolha/contracts';

/**
 * Corpo RFC 9457 (api-rest.md §1.4). Usa o código de catálogo `SERVICE_UNAVAILABLE` (503,
 * "Manutenção/dependência fora") com a extensão `flag`, para o front escolher a microcopy.
 * O catálogo completo de erros e o filtro global de problem+json são do BV-111; este filtro
 * só cobre a exceção de flag desligada.
 */
export interface FeatureDisabledProblem {
  type: string;
  title: string;
  status: 503;
  detail: string;
  instance?: string;
  code: 'SERVICE_UNAVAILABLE';
  flag: FlagKey;
}

const PROBLEM_TYPE = 'https://api.bolhavenda.com.br/problems/service-unavailable';

const DETAIL: Partial<Record<FlagKey, string>> = {
  maintenance_mode:
    'A plataforma está em manutenção. Você pode navegar pelo canvas, mas ações estão pausadas por alguns minutos.',
  payments_enabled:
    'Entradas em bolhas estão temporariamente pausadas enquanto corrigimos um problema no processamento de pagamentos. Valores já reservados estão seguros.',
};
const DEFAULT_DETAIL =
  'Esta funcionalidade está temporariamente indisponível. Tente novamente em alguns minutos.';

export class FeatureDisabledException extends HttpException {
  constructor(
    readonly flag: FlagKey,
    instance?: string,
  ) {
    const body: FeatureDisabledProblem = {
      type: PROBLEM_TYPE,
      title: 'Serviço temporariamente indisponível',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      detail: DETAIL[flag] ?? DEFAULT_DETAIL,
      ...(instance ? { instance } : {}),
      code: 'SERVICE_UNAVAILABLE',
      flag,
    };
    super(body, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

interface ProblemResponse {
  status(code: number): ProblemResponse;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
}

/** Responde `FeatureDisabledException` como `application/problem+json`. */
@Catch(FeatureDisabledException)
export class FeatureDisabledFilter implements ExceptionFilter<FeatureDisabledException> {
  catch(exception: FeatureDisabledException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ProblemResponse>();
    response.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
