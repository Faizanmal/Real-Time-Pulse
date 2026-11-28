import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { getRequestId } from './request-context.middleware';
import { sanitizeSensitivePath } from '../utils/sensitive-path';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // Query strings may contain credentials on legacy callbacks. Log only the
    // normalized path so URLs never copy OAuth codes or tokens into logs.
    const { method, path, ip } = req;
    const safePath = sanitizeSensitivePath(path);
    const userAgent = req.get('user-agent') || '';
    const requestId = getRequestId();

    const startTime = Date.now();

    // Log request
    this.logger.log(`➡️  ${method} ${safePath} - ${ip} - ${userAgent} [${requestId}]`);

    // Log response
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '0';
      const responseTime = Date.now() - startTime;

      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';

      this.logger[logLevel](
        `${emoji} ${method} ${safePath} ${statusCode} ${contentLength}b - ${responseTime}ms [${requestId}]`,
      );
    });

    next();
  }
}
