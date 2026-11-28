import { ForbiddenException, Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(error: any, user: TUser, info: any, context: ExecutionContext): TUser {
    if (error || !user) return super.handleRequest(error, user, info, context);
    if ((user as { role?: string }).role === 'MEMBER') {
      throw new ForbiddenException('Use a portal link assigned to your client account');
    }
    return user;
  }

  getRequest(context: ExecutionContext) {
    return GqlExecutionContext.create(context).getContext().req;
  }
}
