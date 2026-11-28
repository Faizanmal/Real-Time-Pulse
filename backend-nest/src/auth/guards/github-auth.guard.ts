import { randomBytes } from 'crypto';

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { isObservable, lastValueFrom } from 'rxjs';

import { CacheService } from '../../cache/cache.service';

import { consumeOAuthStateOnce } from './oauth-state.util';

@Injectable()
export class GitHubAuthGuard extends AuthGuard('github') {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { oauthState?: string }>();
    const response = context.switchToHttp().getResponse<Response>();
    const cookieName = 'oauth_state_github';
    const callbackPath = '/api/v1/auth/github/callback';

    if (request.path.endsWith('/callback')) {
      const cookieValue = request.cookies?.[cookieName];
      const expected = typeof cookieValue === 'string' ? cookieValue : '';
      const supplied = typeof request.query.state === 'string' ? request.query.state : '';
      response.clearCookie(cookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: callbackPath,
      });
      await consumeOAuthStateOnce(this.cacheService, 'github', expected, supplied);
      return this.activatePassport(context);
    }

    const state = randomBytes(32).toString('base64url');
    request.oauthState = state;
    response.cookie(cookieName, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: callbackPath,
      maxAge: 5 * 60 * 1000,
    });
    await this.cacheService.set(`oauth_state:github:${state}`, '1', 5 * 60);
    return this.activatePassport(context);
  }

  private async activatePassport(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);
    return isObservable(result) ? lastValueFrom(result) : result;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { oauthState?: string }>();
    return request.path.endsWith('/callback') ? {} : { state: request.oauthState };
  }
}
