import { ForbiddenException, Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { isTrustedSessionRequest } from '../session-security.util';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const usesCookieSession =
      !request.headers.authorization && Boolean(request.cookies?.pulse_access);
    const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
    if (usesCookieSession && unsafeMethod) {
      const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001')
        .split(',')
        .map((origin) => origin.trim());
      if (
        !isTrustedSessionRequest(
          request.headers.origin,
          request.headers['x-csrf-token'],
          allowedOrigins,
        )
      ) {
        throw new ForbiddenException('Untrusted cookie-authenticated request');
      }
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(error: any, user: TUser, info: any, context: ExecutionContext): TUser {
    if (error || !user) return super.handleRequest(error, user, info, context);
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    const method = request.method.toUpperCase();
    const selfServicePath =
      (method === 'GET' && (path.endsWith('/auth/me') || path.endsWith('/auth/sessions'))) ||
      (method === 'POST' && (path.endsWith('/auth/logout') || path.endsWith('/auth/logout/all')));
    if ((user as { role?: string }).role === 'MEMBER' && !selfServicePath) {
      throw new ForbiddenException('Use a portal link assigned to your client account');
    }
    return user;
  }
}
