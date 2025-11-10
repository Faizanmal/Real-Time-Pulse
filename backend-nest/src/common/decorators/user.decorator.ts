import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get the current user from the request
 * Used in authenticated routes
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = ctx.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return request.user;
  },
);

/**
 * Decorator to get the current workspace ID
 * Used for multi-tenant data isolation
 */
export const CurrentWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = ctx.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return request.user?.workspaceId;
  },
);
