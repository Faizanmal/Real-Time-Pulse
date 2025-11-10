import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestUser {
  id: string;
  workspaceId: string;
  email: string;
  role?: string;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  timestamp: Date;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
}

// Global AsyncLocalStorage instance
export const requestContext = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generate or extract request ID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Set request ID in response header for tracing
    res.setHeader('X-Request-ID', requestId);

    // Type-safe user extraction
    const requestWithUser = req as Request & { user?: RequestUser };
    const user = requestWithUser.user;

    // Build context
    const context: RequestContext = {
      requestId,
      userId: user?.id,
      workspaceId: user?.workspaceId,
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
    };

    // Run the rest of the request in this context
    requestContext.run(context, () => {
      next();
    });
  }
}

/**
 * Helper function to get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Helper function to get current request ID
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
