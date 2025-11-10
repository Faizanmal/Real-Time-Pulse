import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit.service';
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata,
} from '../decorators/audit-log.decorator';
import type { RequestUser } from '../../common/interfaces/auth.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    const params = request.params as Record<string, string>;
    const body = request.body as Prisma.InputJsonValue;
    const entityId =
      params.id ||
      (typeof body === 'object' && body !== null && 'id' in body
        ? (body as { id: string }).id
        : 'unknown');

    const baseLogData = {
      workspaceId: user?.workspaceId || 'system',
      userId: user?.id,
      userEmail: user?.email || 'system',
      action: auditMetadata.action,
      entity: auditMetadata.entity,
      entityId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent') || 'unknown',
      method: request.method,
      endpoint: request.url,
      oldValues: body,
    };

    return next.handle().pipe(
      tap((response: unknown) => {
        const responseData: Prisma.InputJsonValue =
          response && typeof response === 'object' && 'data' in response
            ? (response as { data: Prisma.InputJsonValue }).data
            : (response as Prisma.InputJsonValue);
        void this.auditService.log({
          ...baseLogData,
          newValues: responseData,
          success: true,
        });
      }),
      catchError((error: Error) => {
        void this.auditService.log({
          ...baseLogData,
          success: false,
          errorMessage: error.message,
        });
        throw error;
      }),
    );
  }
}
