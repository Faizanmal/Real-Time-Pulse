import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Strong password validation decorator
 */
export class SecurePasswordDto {
  @ApiProperty({
    description: 'Password with strong security requirements',
    minLength: 12,
    maxLength: 128,
    example: 'MySecure@Password123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]+$/,
    {
      message:
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    },
  )
  password: string;
}

/**
 * Sanitized string input - removes potentially dangerous characters
 */
export function SanitizedString() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    // Remove null bytes and control characters
    let sanitized = value
      // eslint-disable-next-line no-control-regex
      .replace(/\u0000/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit consecutive spaces
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
  });
}

/**
 * Sanitized email input
 */
export function SanitizedEmail() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    // Lowercase and trim
    return value.toLowerCase().trim();
  });
}

/**
 * DTO for validating recaptcha tokens
 */
export class RecaptchaDto {
  @ApiPropertyOptional({
    description: 'reCAPTCHA v3 token',
    example: '03AGdBq24...',
  })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

/**
 * Common security validation patterns
 */
export const SecurityPatterns = {
  // UUID pattern
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // Slug pattern (URL-safe)
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  // Safe filename pattern
  SAFE_FILENAME: /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/,

  // API key pattern
  API_KEY: /^[a-z]+_[A-Za-z0-9_-]{32,}$/,

  // Hex color
  HEX_COLOR: /^#[0-9A-Fa-f]{6}$/,

  // No SQL injection characters
  NO_SQL_INJECTION: /^[^'";\-\-/*]+$/,

  // No script tags
  NO_SCRIPT: /^(?!.*<script).*$/i,

  // Safe URL
  SAFE_URL: /^https?:\/\/[^\s<>"]+$/,
};

/**
 * Validator for safe user input
 */
export function IsSafeInput(options?: { allowHtml?: boolean }) {
  return function (target: any, propertyKey: string) {
    IsString()(target, propertyKey);

    if (!options?.allowHtml) {
      Matches(SecurityPatterns.NO_SCRIPT, {
        message: `${propertyKey} contains potentially unsafe content`,
      })(target, propertyKey);
    }
  };
}
