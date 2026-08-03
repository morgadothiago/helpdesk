import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Formato de erro padronizado do módulo de tickets (SPEC-03, seção 3/6):
 * `{ error: { code, message } }` para 400/401/403/404/409/500. Escopado ao
 * `TicketsController` (via `@UseFilters`) para não alterar o formato de
 * erro já em produção do `AuthModule` (SPEC-02), que está fora do escopo
 * desta SPEC. Nunca vaza stack trace (SPEC-03, seção 6).
 */
@Catch()
export class TicketsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TicketsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const { code, message } = normalizeBody(exception, body);
      response.status(status).json({ error: { code, message } });
      return;
    }

    this.logger.error(
      'Erro não tratado em TicketsController',
      exception as Error,
    );
    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor.',
      },
    });
  }
}

function normalizeBody(
  exception: HttpException,
  body: string | object,
): { code: string; message: unknown } {
  const defaultCode = exception.constructor.name
    .replace('Exception', '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();

  if (typeof body === 'string') {
    return { code: defaultCode, message: body };
  }

  const record = body as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : defaultCode;
  const message = record.message ?? exception.message;
  return { code, message };
}
