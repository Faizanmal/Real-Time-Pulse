/**
 * =============================================================================
 * REAL-TIME PULSE - ADVANCED SECURITY SERVICE
 * =============================================================================
 *
 * Enterprise-grade security including rate limiting, IP filtering, encryption,
 * input sanitization, and security headers.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// Rate limiter using sliding window algorithm
@Injectable()
export class RateLimiterService {
  private windows: Map<string, { count: number; timestamps: number[] }> =
    new Map();
  private readonly windowSizeMs: number;
  private readonly maxRequests: number;

  constructor(windowSizeMs: number = 60000, maxRequests: number = 100) {
    this.windowSizeMs = windowSizeMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(key: string): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;

    let window = this.windows.get(key);
    if (!window) {
      window = { count: 0, timestamps: [] };
      this.windows.set(key, window);
    }

    // Remove old timestamps
    window.timestamps = window.timestamps.filter((t) => t > windowStart);
    window.count = window.timestamps.length;

    if (window.count >= this.maxRequests) {
      const oldestTimestamp = window.timestamps[0];
      const resetMs = oldestTimestamp + this.windowSizeMs - now;
      return { allowed: false, remaining: 0, resetMs };
    }

    window.timestamps.push(now);
    window.count++;

    return {
      allowed: true,
      remaining: this.maxRequests - window.count,
      resetMs: this.windowSizeMs,
    };
  }

  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;

    for (const [key, window] of this.windows) {
      window.timestamps = window.timestamps.filter((t) => t > windowStart);
      if (window.timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }
}

// Rate limiter guard
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private rateLimiter: RateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const key = this.getKey(request);

    const result = this.rateLimiter.isAllowed(key);

    response.setHeader('X-RateLimit-Limit', '100');
    response.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(result.resetMs / 1000).toString(),
    );

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(result.resetMs / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getKey(request: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = (request as any).user?.id;
    const forwardedFor = request.headers['x-forwarded-for'];
    const ip =
      request.ip ||
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      'unknown';
    return userId ? `user:${userId}` : `ip:${ip}`;
  }
}

// IP whitelist/blacklist service
@Injectable()
export class IPFilterService {
  private whitelist: Set<string> = new Set();
  private blacklist: Set<string> = new Set();
  private ipRanges: {
    start: number;
    end: number;
    type: 'whitelist' | 'blacklist';
  }[] = [];

  addToWhitelist(ip: string) {
    this.whitelist.add(ip);
    this.blacklist.delete(ip);
  }

  addToBlacklist(ip: string) {
    this.blacklist.add(ip);
    this.whitelist.delete(ip);
  }

  addRangeToWhitelist(startIp: string, endIp: string) {
    this.ipRanges.push({
      start: this.ipToNumber(startIp),
      end: this.ipToNumber(endIp),
      type: 'whitelist',
    });
  }

  addRangeToBlacklist(startIp: string, endIp: string) {
    this.ipRanges.push({
      start: this.ipToNumber(startIp),
      end: this.ipToNumber(endIp),
      type: 'blacklist',
    });
  }

  isAllowed(ip: string): boolean {
    // Check explicit lists first
    if (this.blacklist.has(ip)) return false;
    if (this.whitelist.has(ip)) return true;

    // Check IP ranges
    const ipNum = this.ipToNumber(ip);
    for (const range of this.ipRanges) {
      if (ipNum >= range.start && ipNum <= range.end) {
        return range.type === 'whitelist';
      }
    }

    // Default allow
    return true;
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }
}

// Encryption service
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 32;
  private readonly iterations = 100000;
  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
    this.encryptionKey = Buffer.from(key.slice(0, 32), 'utf-8');
  }

  // Encrypt data
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Return iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  // Decrypt data
  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encrypted] = ciphertext.split(':');

    if (!ivHex || !tagHex || !encrypted) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate secure random token
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate API key
  generateApiKey(): { key: string; hash: string } {
    const key = `rtp_${this.generateToken(24)}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, hash };
  }

  // Hash for comparison (API keys, etc.)
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // HMAC signature
  sign(data: string, secret?: string): string {
    const key = secret || this.encryptionKey.toString('utf-8');
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  // Verify HMAC signature
  verifySignature(data: string, signature: string, secret?: string): boolean {
    const expected = this.sign(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }
}

// Input sanitization service
@Injectable()
export class SanitizationService {
  // Sanitize HTML to prevent XSS
  sanitizeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Sanitize for SQL (though Prisma handles this)
  sanitizeSql(input: string): string {
    return input.replace(/['";\\]/g, '');
  }

  // Sanitize filename
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  }

  // Sanitize URL
  sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  // Validate and sanitize email
  sanitizeEmail(email: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitized = email.toLowerCase().trim();
    return emailRegex.test(sanitized) ? sanitized : null;
  }

  // Strip potentially dangerous characters
  sanitizeString(
    input: string,
    options?: { maxLength?: number; allowNewlines?: boolean },
  ): string {
    let result = input.trim();

    // Remove null bytes
    result = result.replace(/\0/g, '');

    // Remove control characters except newlines if allowed
    if (options?.allowNewlines) {
      // eslint-disable-next-line no-control-regex
      result = result.replace(/[\0-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else {
      // eslint-disable-next-line no-control-regex
      result = result.replace(/[\0-\x1F\x7F]/g, '');
    }

    // Truncate if needed
    if (options?.maxLength && result.length > options.maxLength) {
      result = result.substring(0, options.maxLength);
    }

    return result;
  }
}

// Security headers middleware
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' wss: https:; " +
        "frame-ancestors 'none';",
    );

    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    );

    // HSTS (enable in production with proper SSL)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    next();
  }
}

// CSRF protection service
@Injectable()
export class CsrfService {
  private readonly tokenLength = 32;
  private tokens: Map<string, { token: string; expiry: number }> = new Map();
  private readonly tokenTTL = 3600000; // 1 hour

  constructor(private encryption: EncryptionService) {
    // Cleanup expired tokens
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }

  generateToken(sessionId: string): string {
    const token = this.encryption.generateToken(this.tokenLength);
    this.tokens.set(sessionId, {
      token,
      expiry: Date.now() + this.tokenTTL,
    });
    return token;
  }

  validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) return false;
    if (stored.expiry < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(token),
    );
  }

  private cleanup() {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens) {
      if (data.expiry < now) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// Brute force protection
@Injectable()
export class BruteForceProtectionService {
  private attempts: Map<
    string,
    {
      count: number;
      firstAttempt: number;
      blocked: boolean;
      blockExpiry?: number;
    }
  > = new Map();
  private readonly maxAttempts = 5;
  private readonly windowMs = 900000; // 15 minutes
  private readonly blockDurationMs = 3600000; // 1 hour

  recordAttempt(key: string, success: boolean): void {
    const now = Date.now();
    let record = this.attempts.get(key);

    if (!record || now - record.firstAttempt > this.windowMs) {
      record = { count: 0, firstAttempt: now, blocked: false };
    }

    if (success) {
      // Reset on successful attempt
      this.attempts.delete(key);
      return;
    }

    record.count++;

    if (record.count >= this.maxAttempts) {
      record.blocked = true;
      record.blockExpiry = now + this.blockDurationMs;
    }

    this.attempts.set(key, record);
  }

  isBlocked(key: string): { blocked: boolean; remainingMs?: number } {
    const record = this.attempts.get(key);
    if (!record) return { blocked: false };

    if (record.blocked && record.blockExpiry) {
      if (Date.now() > record.blockExpiry) {
        this.attempts.delete(key);
        return { blocked: false };
      }
      return { blocked: true, remainingMs: record.blockExpiry - Date.now() };
    }

    return { blocked: false };
  }

  getRemainingAttempts(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - record.count);
  }
}

// Export security module
export const security = {
  RateLimiterService,
  RateLimitGuard,
  IPFilterService,
  EncryptionService,
  SanitizationService,
  SecurityHeadersMiddleware,
  CsrfService,
  BruteForceProtectionService,
};

export default security;
