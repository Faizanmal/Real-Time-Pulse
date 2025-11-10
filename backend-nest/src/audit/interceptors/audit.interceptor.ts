import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../audit.service';
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata,
} from '../decorators/audit-log.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const entityId = request.params?.id || request.body?.id || 'unknown';

    const baseLogData = {
      workspaceId: user?.workspaceId || 'system',
      userId: user?.id,
      userEmail: user?.email || 'system',
      action: auditMetadata.action,
      entity: auditMetadata.entity,
      entityId,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      method: request.method,
      endpoint: request.url,
      oldValues: request.body,
    };

    return next.handle().pipe(
      tap((response) => {
        void this.auditService.log({
          ...baseLogData,
          newValues: response?.data || response,
          success: true,
        });
      }),
      catchError((error) => {
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
