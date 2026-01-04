import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      correlationId: string;
      startTime: number;
    }
  }
}

/**
 * Middleware that generates and attaches request IDs for tracing
 * Also tracks request timing and adds correlation headers
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestId');

  use(req: Request, res: Response, next: NextFunction): void {
    // Generate or use existing request ID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Use or generate correlation ID (for distributed tracing)
    const correlationId =
      (req.headers['x-correlation-id'] as string) || requestId;

    // Attach to request
    req.requestId = requestId;
    req.correlationId = correlationId;
    req.startTime = Date.now();

    // Set response headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Correlation-ID', correlationId);

    // Log request start
    this.logger.debug({
      message: 'Request started',
      requestId,
      correlationId,
      method: req.method,
      path: req.url,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';

      this.logger[logLevel]({
        message: 'Request completed',
        requestId,
        correlationId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
      });
    });

    next();
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
