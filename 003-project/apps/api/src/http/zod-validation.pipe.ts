import type { PipeTransform } from '@nestjs/common';
import type { FieldError } from '@bolha/contracts';
import type { z } from 'zod';
import { ProblemException } from './problem.js';

/**
 * Valida o corpo com o schema do contrato. Falha → `422 VALIDATION_FAILED` com `errors[]`
 * (api-rest §1.4). As mensagens são as do Zod; o valor recebido nunca é ecoado (pode ser PII).
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const errors: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || '(body)',
      code: issue.code.toUpperCase(),
      message: issue.message,
    }));
    throw new ProblemException('VALIDATION_FAILED', { errors });
  }
}
