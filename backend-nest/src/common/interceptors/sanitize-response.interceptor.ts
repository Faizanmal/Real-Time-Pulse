import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataProtectionService } from '../services/data-protection.service';

/**
 * Interceptor that automatically sanitizes sensitive data from responses
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SanitizeResponseInterceptor.name);

  // Fields to remove from responses
  private readonly REMOVE_FIELDS = [
    'password',
    'hashedPassword',
    'resetToken',
    'resetTokenExpiry',
    'refreshToken',
    'mfaSecret',
    'apiSecret',
    'privateKey',
  ];

  // Fields to mask in responses
  private readonly MASK_FIELDS = [
    'email',
    'phone',
    'ssn',
    'creditCard',
    'bankAccount',
  ];

  constructor(private readonly dataProtectionService: DataProtectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.sanitizeResponse(data)));
  }

  private sanitizeResponse(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeResponse(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        // Skip fields that should be removed
        if (
          this.REMOVE_FIELDS.some((f) =>
            key.toLowerCase().includes(f.toLowerCase()),
          )
        ) {
          continue;
        }

        // Mask certain fields
        if (
          this.MASK_FIELDS.some((f) => key.toLowerCase() === f.toLowerCase())
        ) {
          sanitized[key] =
            typeof value === 'string'
              ? this.dataProtectionService.mask(value)
              : value;
          continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeResponse(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return data;
  }
}
