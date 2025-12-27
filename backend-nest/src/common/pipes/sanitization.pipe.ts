import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripScripts?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
}

const DEFAULT_OPTIONS: SanitizationOptions = {
  allowedTags: [],
  allowedAttributes: {},
  stripScripts: true,
  maxLength: 10000,
  trimWhitespace: true,
};

@Injectable()
export class SanitizationPipe implements PipeTransform {
  private readonly logger = new Logger(SanitizationPipe.name);
  private readonly options: SanitizationOptions;

  constructor(options?: SanitizationOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      return this.sanitize(value, metadata);
    } catch (error) {
      this.logger.error(`Sanitization error: ${error}`);
      throw new BadRequestException('Invalid input data');
    }
  }

  private sanitize(value: unknown, metadata: ArgumentMetadata): unknown {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, metadata));
    }

    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value as Record<string, unknown>, metadata);
    }

    // Numbers, booleans, etc. - pass through
    return value;
  }

  private sanitizeString(value: string): string {
    let sanitized = value;

    // Trim whitespace if enabled
    if (this.options.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Check max length
    if (this.options.maxLength && sanitized.length > this.options.maxLength) {
      throw new BadRequestException(
        `Input exceeds maximum length of ${this.options.maxLength} characters`,
      );
    }

    // Remove or encode dangerous characters
    sanitized = this.removeNullBytes(sanitized);
    sanitized = this.normalizeLineEndings(sanitized);

    // Sanitize HTML if script stripping is enabled
    if (this.options.stripScripts) {
      sanitized = sanitizeHtml(sanitized, {
        allowedTags: this.options.allowedTags,
        allowedAttributes: this.options.allowedAttributes,
        disallowedTagsMode: 'discard',
      });
    }

    // Detect potential injection attempts
    if (this.containsSuspiciousPatterns(sanitized)) {
      this.logger.warn(
        `Potential injection attempt detected: ${sanitized.substring(0, 100)}`,
      );
      sanitized = this.escapeInjectionPatterns(sanitized);
    }

    return sanitized;
  }

  private sanitizeObject(
    obj: Record<string, unknown>,
    metadata: ArgumentMetadata,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Validate key names (prevent prototype pollution)
      if (this.isProhibitedKey(key)) {
        this.logger.warn(`Prohibited key detected and removed: ${key}`);
        continue;
      }

      sanitized[key] = this.sanitize(value, metadata);
    }

    return sanitized;
  }

  private removeNullBytes(value: string): string {
    return value.replace(/\0/g, '');
  }

  private normalizeLineEndings(value: string): string {
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  private containsSuspiciousPatterns(value: string): boolean {
    const patterns = [
      // SQL injection patterns
      /(\b(union|select|insert|update|delete|drop)\b.*\b(from|into|table)\b)/i,
      // Script injection
      /<script[\s\S]*?>/gi,
      /javascript:/gi,
      // Path traversal
      /\.\.\//g,
      // Command injection
      /(\||`|\$\()/,
    ];

    return patterns.some((pattern) => pattern.test(value));
  }

  private escapeInjectionPatterns(value: string): string {
    return value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  private isProhibitedKey(key: string): boolean {
    const prohibitedKeys = [
      '__proto__',
      'constructor',
      'prototype',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
    ];
    return prohibitedKeys.includes(key);
  }
}

/**
 * Factory function to create a sanitization pipe with custom options
 */
export function Sanitize(options?: SanitizationOptions): SanitizationPipe {
  return new SanitizationPipe(options);
}
