import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Raw workspace APIs expose agency configuration; client accounts must use explicit share grants. */
@Injectable()
export class AgencyRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    if (!request.user) throw new ForbiddenException('Authentication required');
    if (request.user.role === 'MEMBER') {
      throw new ForbiddenException('Use a portal link assigned to your client account');
    }
    return true;
  }
}
