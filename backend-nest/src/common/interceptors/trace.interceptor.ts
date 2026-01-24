import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { TRACE_METADATA_KEY, TraceMetadata } from '../decorators/trace.decorator';

interface TraceContext {
  correlationId: string;
  operationName: string;
  startTime: number;
  userId?: string;
  workspaceId?: string;
  path: string;
  method: string;
}

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TraceInterceptor');

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const traceMetadata = this.reflector.get<TraceMetadata>(
      TRACE_METADATA_KEY,
      context.getHandler(),
    );

    if (!traceMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get or generate correlation ID
    const correlationId =
      request.headers['x-correlation-id'] || request.headers['x-request-id'] || uuidv4();

    const traceContext: TraceContext = {
      correlationId,
      operationName: traceMetadata.operationName,
      startTime: Date.now(),
      userId: request.user?.id,
      workspaceId: request.user?.workspaceId,
      path: request.url,
      method: request.method,
    };

    // Set correlation ID in response headers
    response.setHeader('X-Correlation-ID', correlationId);

    // Log operation start
    this.logger.log({
      message: `[${traceContext.operationName}] Started`,
      correlationId,
      userId: traceContext.userId,
      workspaceId: traceContext.workspaceId,
      path: traceContext.path,
      method: traceContext.method,
    });

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - traceContext.startTime;

        const logData: Record<string, unknown> = {
          message: `[${traceContext.operationName}] Completed`,
          correlationId,
          duration: `${duration}ms`,
          userId: traceContext.userId,
          workspaceId: traceContext.workspaceId,
          statusCode: response.statusCode,
        };

        // Optionally log the result (with sensitive fields masked)
        if (traceMetadata.logResult && result) {
          logData.result = this.maskSensitiveFields(result, traceMetadata.sensitiveFields || []);
        }

        this.logger.log(logData);

        // Log slow operations as warnings
        if (duration > 5000) {
          this.logger.warn({
            message: `[${traceContext.operationName}] Slow operation detected`,
            correlationId,
            duration: `${duration}ms`,
            threshold: '5000ms',
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - traceContext.startTime;

        this.logger.error({
          message: `[${traceContext.operationName}] Failed`,
          correlationId,
          duration: `${duration}ms`,
          userId: traceContext.userId,
          workspaceId: traceContext.workspaceId,
          error: error.message,
          stack: error.stack,
        });

        return throwError(() => error);
      }),
    );
  }

  private maskSensitiveFields(data: unknown, sensitiveFields: string[]): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const masked = { ...data } as Record<string, unknown>;

    for (const field of sensitiveFields) {
      if (field in masked) {
        masked[field] = '***MASKED***';
      }
    }

    return masked;
  }
}
