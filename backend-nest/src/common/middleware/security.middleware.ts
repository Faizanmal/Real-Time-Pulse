import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import * as crypto from 'crypto';

interface SecurityContext {
  ip: string;
  userAgent: string;
  fingerprint: string;
  timestamp: Date;
  path: string;
  method: string;
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private readonly IP_BLOCK_PREFIX = 'ip_block:';
  private readonly IP_ATTEMPTS_PREFIX = 'ip_attempts:';
  private readonly SUSPICIOUS_PATTERNS: RegExp[];
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.isDevelopment =
      configService.get<string>('app.nodeEnv') !== 'production';

    // Patterns to detect common attacks
    this.SUSPICIOUS_PATTERNS = [
      // SQL Injection patterns (Removed quotes/semicolons as they trigger false positives in JSON/text)
      /(\b(union|select|insert|update|delete|drop|truncate|alter|exec|execute)\b.*\b(from|into|table|database|schema)\b)/i,
      /(--|\/\*|\*\/|xp_)/i,

      // XSS patterns
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,

      // Path traversal
      /\.\.\//g,
      /%2e%2e%2f/gi,
      /%252e%252e%252f/gi,

      // Command injection
      /(\||;|`|\$\(|&&|\|\|)/,

      // File inclusion
      /(php|data|file|zip|phar):\/\//i,
    ];

    // Only add SSRF pattern in production (it blocks localhost which is needed for dev)
    if (!this.isDevelopment) {
      this.SUSPICIOUS_PATTERNS.push(
        /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|internal|metadata)\b/i,
      );
    }
  }

  // Paths to skip security pattern checks (OAuth callbacks contain special chars)
  private readonly whitelistedPaths = [
    '/api/v1/auth/google/callback',
    '/api/v1/auth/github/callback',
    '/auth/callback',
  ];

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const context = this.extractSecurityContext(req);

    try {
      // Check if IP is blocked
      if (await this.isIpBlocked(context.ip)) {
        this.logger.warn(`Blocked request from banned IP: ${context.ip}`);
        res.status(403).json({
          statusCode: 403,
          message: 'Access denied - IP temporarily blocked',
          error: 'Forbidden',
        });
        return;
      }

      // Skip pattern detection for whitelisted paths (OAuth callbacks)
      const isWhitelisted = this.whitelistedPaths.some(
        (path) => req.path.includes(path) || req.originalUrl.includes(path),
      );

      // Detect and log suspicious patterns (skip for whitelisted paths)
      if (!isWhitelisted) {
        const suspiciousPatterns = this.detectSuspiciousPatterns(req);
        if (suspiciousPatterns.length > 0) {
          await this.handleSuspiciousRequest(context, suspiciousPatterns);
          res.status(400).json({
            statusCode: 400,
            message: 'Request contains potentially malicious content',
            error: 'Bad Request',
          });
          return;
        }
      }

      // Add security headers
      this.addSecurityHeaders(res);

      // Attach security context to request
      (req as any).securityContext = context;

      next();
    } catch (error) {
      this.logger.error('Security middleware error', error);
      next();
    }
  }

  private extractSecurityContext(req: Request): SecurityContext {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Create a fingerprint for the request
    const fingerprint = this.generateFingerprint(ip, userAgent, req.headers);

    return {
      ip,
      userAgent,
      fingerprint,
      timestamp: new Date(),
      path: req.path,
      method: req.method,
    };
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return req.socket?.remoteAddress || req.ip || 'unknown';
  }

  private generateFingerprint(
    ip: string,
    userAgent: string,
    headers: Request['headers'],
  ): string {
    const components = [
      ip,
      userAgent,
      headers['accept-language'] || '',
      headers['accept-encoding'] || '',
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 32);
  }

  private async isIpBlocked(ip: string): Promise<boolean> {
    try {
      const blocked = await this.cacheService.get(
        `${this.IP_BLOCK_PREFIX}${ip}`,
      );
      return blocked !== null;
    } catch {
      return false;
    }
  }

  private detectSuspiciousPatterns(req: Request): string[] {
    const detected: string[] = [];

    // Check URL
    const url = req.originalUrl || req.url;
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(url)) {
        detected.push(`URL: ${pattern.source}`);
      }
    }

    // Check query parameters
    const queryString = JSON.stringify(req.query);
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(queryString)) {
        detected.push(`Query: ${pattern.source}`);
      }
    }

    // Check body (if exists)
    if (req.body) {
      const bodyString =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      for (const pattern of this.SUSPICIOUS_PATTERNS) {
        if (pattern.test(bodyString)) {
          detected.push(`Body: ${pattern.source}`);
        }
      }
    }

    // Check headers for suspicious content
    const sensitiveHeaders = ['referer', 'origin', 'host'];
    for (const header of sensitiveHeaders) {
      const value = req.headers[header];
      if (value) {
        const headerValue = Array.isArray(value) ? value.join(',') : value;
        for (const pattern of this.SUSPICIOUS_PATTERNS) {
          if (pattern.test(headerValue)) {
            detected.push(`Header ${header}: ${pattern.source}`);
          }
        }
      }
    }

    return detected;
  }

  private async handleSuspiciousRequest(
    context: SecurityContext,
    patterns: string[],
  ): Promise<void> {
    this.logger.warn(
      `Suspicious request detected from ${context.ip}: ${patterns.join(', ')}`,
    );

    try {
      // Increment failed attempts counter
      const attemptsKey = `${this.IP_ATTEMPTS_PREFIX}${context.ip}`;
      const currentAttempts = await this.cacheService.get(attemptsKey);
      const attempts = currentAttempts ? parseInt(currentAttempts, 10) + 1 : 1;

      await this.cacheService.set(attemptsKey, attempts.toString(), 3600); // 1 hour window

      // Block IP if too many suspicious requests
      const maxAttempts =
        this.configService.get<number>(
          'security.ipBlocking.maxFailedAttempts',
        ) || 10;
      const blockDuration =
        this.configService.get<number>(
          'security.ipBlocking.blockDurationMinutes',
        ) || 30;

      if (attempts >= maxAttempts) {
        await this.cacheService.set(
          `${this.IP_BLOCK_PREFIX}${context.ip}`,
          JSON.stringify({
            reason: 'Suspicious activity detected',
            patterns,
            blockedAt: new Date().toISOString(),
          }),
          blockDuration * 60,
        );

        this.logger.warn(
          `IP ${context.ip} blocked for ${blockDuration} minutes due to suspicious activity`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to track suspicious request', error);
    }
  }

  private addSecurityHeaders(res: Response): void {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );

    // Remove server identification
    res.removeHeader('X-Powered-By');
  }
}
