/**
 * =============================================================================
 * REAL-TIME PULSE - CORRELATION INTERCEPTOR
 * =============================================================================
 *
 * Automatically adds correlation context to all HTTP requests.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CorrelationService } from './correlation.service';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationInterceptor.name);

  constructor(private readonly correlationService: CorrelationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract correlation ID from headers or generate new one
    const correlationId =
      request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      undefined;

    const traceId = request.headers['x-trace-id'] || undefined;
    const parentSpanId = request.headers['x-span-id'] || undefined;

    // Run the handler within correlation context
    return new Observable((subscriber) => {
      this.correlationService.run(
        {
          correlationId,
          traceId,
          parentSpanId,
          userId: request.user?.id,
          workspaceId: request.user?.workspaceId,
          metadata: {
            method: request.method,
            path: request.url,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          },
        },
        async () => {
          // Set response headers for client-side correlation
          const ctx = this.correlationService.getContext();
          if (ctx) {
            response.setHeader('X-Correlation-ID', ctx.correlationId);
            response.setHeader('X-Trace-ID', ctx.traceId);
            response.setHeader('X-Span-ID', ctx.spanId);
          }

          next
            .handle()
            .pipe(
              tap((data) => {
                this.correlationService.completeRequest(true);

                // Log successful request
                this.logger.log(
                  this.correlationService.createLogEntry(
                    'info',
                    'Request completed',
                    {
                      statusCode: response.statusCode,
                    },
                  ),
                );

                subscriber.next(data);
                subscriber.complete();
              }),
              catchError((error) => {
                this.correlationService.completeRequest(false);

                // Log error with correlation context
                this.logger.error(
                  this.correlationService.createLogEntry(
                    'error',
                    'Request failed',
                    {
                      error: error.message,
                      stack: error.stack,
                      statusCode: error.status || 500,
                    },
                  ),
                );

                subscriber.error(error);
                return throwError(() => error);
              }),
            )
            .subscribe();
        },
      );
    });
  }
}
