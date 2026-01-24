import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface FieldEncryption {
  algorithm: string;
  iv: string;
  tag: string;
  data: string;
}

@Injectable()
export class DataProtectionService {
  private readonly logger = new Logger(DataProtectionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly TAG_LENGTH = 16;

  // Fields that should be encrypted at rest
  private readonly SENSITIVE_FIELDS = [
    'password',
    'apiKey',
    'secretKey',
    'accessToken',
    'refreshToken',
    'ssn',
    'creditCard',
    'bankAccount',
    'privateKey',
    'secret',
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get encryption key from config
   */
  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('app.encryptionKey');
    if (!key) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    // Derive a proper key using PBKDF2
    return crypto.pbkdf2Sync(key, 'data-protection-salt', 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    const result: FieldEncryption = {
      algorithm: this.ALGORITHM,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted,
    };

    return `encrypted:${Buffer.from(JSON.stringify(result)).toString('base64')}`;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext || !ciphertext.startsWith('encrypted:')) {
      return ciphertext;
    }

    try {
      const key = this.getEncryptionKey();
      const encoded = ciphertext.slice('encrypted:'.length);
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const { iv, tag, data }: FieldEncryption = JSON.parse(decoded);

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a field should be encrypted
   */
  isSensitiveField(fieldName: string): boolean {
    return this.SENSITIVE_FIELDS.some((sensitive) =>
      fieldName.toLowerCase().includes(sensitive.toLowerCase()),
    );
  }

  /**
   * Encrypt sensitive fields in an object
   */
  encryptObject<T extends Record<string, any>>(obj: T): T {
    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && this.isSensitiveField(key)) {
        (result as any)[key] = this.encrypt(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (result as any)[key] = this.encryptObject(value);
      }
    }

    return result;
  }

  /**
   * Decrypt sensitive fields in an object
   */
  decryptObject<T extends Record<string, any>>(obj: T): T {
    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && value.startsWith('encrypted:')) {
        (result as any)[key] = this.decrypt(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (result as any)[key] = this.decryptObject(value);
      }
    }

    return result;
  }

  /**
   * Hash sensitive data for logging/comparison
   */
  hashForLog(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure API key
   */
  generateApiKey(prefix = 'rtp'): string {
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${random}`;
  }

  /**
   * Verify data integrity with HMAC
   */
  createHmac(data: string): string {
    const key = this.getEncryptionKey();
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHmac(data: string, signature: string): boolean {
    const computed = this.createHmac(data);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }

  /**
   * Mask sensitive data for display
   */
  mask(value: string, showLast = 4): string {
    if (!value || value.length <= showLast) {
      return '*'.repeat(value?.length || 0);
    }
    return '*'.repeat(value.length - showLast) + value.slice(-showLast);
  }

  /**
   * Sanitize object for logging (remove sensitive fields)
   */
  sanitizeForLog<T extends Record<string, any>>(obj: T): T {
    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (this.isSensitiveField(key)) {
        (result as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (result as any)[key] = this.sanitizeForLog(value);
      }
    }

    return result;
  }
}
