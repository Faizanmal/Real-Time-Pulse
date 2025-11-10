import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getRequestId } from './request-context.middleware';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const requestId = getRequestId();

    const startTime = Date.now();

    // Log request
    this.logger.log(
      `➡️  ${method} ${originalUrl} - ${ip} - ${userAgent} [${requestId}]`,
    );

    // Log response
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '0';
      const responseTime = Date.now() - startTime;

      const logLevel =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';

      this.logger[logLevel](
        `${emoji} ${method} ${originalUrl} ${statusCode} ${contentLength}b - ${responseTime}ms [${requestId}]`,
      );
    });

    next();
  }
}
