import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export interface TotpSetupResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  method: 'totp' | 'email' | 'sms';
  verified: boolean;
  timestamp: Date;
}

interface TwoFactorConfig {
  enabled: boolean;
  method: 'totp' | 'email';
  totpSecret?: string;
  backupCodes: string[];
  enabledAt: string;
}

interface EmailCodeCache {
  code: string;
  attempts: number;
}

interface TotpSetupCache {
  secret: string;
  backupCodes: string[];
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly TWO_FACTOR_PREFIX = '2fa:';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cacheService: CacheService,
    private emailService: EmailService,
  ) {}

  /**
   * Get user's display name
   */
  private getUserDisplayName(user: { firstName?: string | null; lastName?: string | null; email: string }): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email.split('@')[0];
  }

  /**
   * Get 2FA config from cache
   */
  private async get2FAConfig(userId: string): Promise<TwoFactorConfig | null> {
    const data = await this.cacheService.get(`${this.TWO_FACTOR_PREFIX}config:${userId}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Save 2FA config to cache
   */
  private async save2FAConfig(userId: string, config: TwoFactorConfig): Promise<void> {
    // Store for 1 year
    await this.cacheService.set(
      `${this.TWO_FACTOR_PREFIX}config:${userId}`,
      JSON.stringify(config),
      365 * 24 * 60 * 60,
    );
  }

  /**
   * Delete 2FA config
   */
  private async delete2FAConfig(userId: string): Promise<void> {
    await this.cacheService.del(`${this.TWO_FACTOR_PREFIX}config:${userId}`);
  }

  /**
   * Initialize TOTP setup for a user
   */
  async initializeTotpSetup(userId: string): Promise<TotpSetupResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `RealTimePulse (${user.email})`,
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Store pending setup in cache
    const setupData: TotpSetupCache = {
      secret: secret.base32,
      backupCodes: backupCodes.map((code) => this.hashCode(code)),
    };
    
    await this.cacheService.set(
      `${this.TWO_FACTOR_PREFIX}setup:${userId}`,
      JSON.stringify(setupData),
      10 * 60, // 10 minutes
    );

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Complete TOTP setup
   */
  async completeTotpSetup(userId: string, token: string): Promise<boolean> {
    const setupData = await this.cacheService.get(`${this.TWO_FACTOR_PREFIX}setup:${userId}`);
    
    if (!setupData) {
      throw new BadRequestException('TOTP setup not initialized or expired');
    }

    const setup: TotpSetupCache = JSON.parse(setupData);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: setup.secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Store 2FA config
    const config: TwoFactorConfig = {
      enabled: true,
      method: 'totp',
      totpSecret: this.encryptSecret(setup.secret),
      backupCodes: setup.backupCodes,
      enabledAt: new Date().toISOString(),
    };
    
    await this.save2FAConfig(userId, config);

    // Clear setup cache
    await this.cacheService.del(`${this.TWO_FACTOR_PREFIX}setup:${userId}`);

    this.logger.log(`TOTP enabled for user ${userId}`);
    return true;
  }

  /**
   * Verify TOTP token
   */
  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const config = await this.get2FAConfig(userId);

    if (!config?.enabled || config.method !== 'totp' || !config.totpSecret) {
      throw new BadRequestException('TOTP not enabled for this user');
    }

    const secret = this.decryptSecret(config.totpSecret);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    return verified;
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const config = await this.get2FAConfig(userId);

    if (!config?.enabled) {
      throw new BadRequestException('Two-factor not enabled for this user');
    }

    const hashedCode = this.hashCode(code);
    const codeIndex = config.backupCodes.indexOf(hashedCode);

    if (codeIndex === -1) {
      return false;
    }

    // Remove used backup code
    const updatedBackupCodes = [...config.backupCodes];
    updatedBackupCodes.splice(codeIndex, 1);

    await this.save2FAConfig(userId, {
      ...config,
      backupCodes: updatedBackupCodes,
    });

    this.logger.log(`Backup code used for user ${userId}. Remaining: ${updatedBackupCodes.length}`);
    return true;
  }

  /**
   * Send email verification code
   */
  async sendEmailCode(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const code = this.generateNumericCode(6);
    const cacheData: EmailCodeCache = { code, attempts: 0 };

    await this.cacheService.set(
      `${this.TWO_FACTOR_PREFIX}email:${userId}`,
      JSON.stringify(cacheData),
      5 * 60, // 5 minutes
    );

    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Your Verification Code',
      template: 'two-factor-code',
      context: {
        name: this.getUserDisplayName(user),
        code,
        expiresIn: '5 minutes',
      },
    });

    this.logger.log(`Email 2FA code sent to user ${userId}`);
  }

  /**
   * Verify email code
   */
  async verifyEmailCode(userId: string, code: string): Promise<boolean> {
    const cachedData = await this.cacheService.get(`${this.TWO_FACTOR_PREFIX}email:${userId}`);

    if (!cachedData) {
      throw new BadRequestException('Verification code expired or not requested');
    }

    const cached: EmailCodeCache = JSON.parse(cachedData);

    if (cached.attempts >= 3) {
      await this.cacheService.del(`${this.TWO_FACTOR_PREFIX}email:${userId}`);
      throw new BadRequestException('Too many attempts. Please request a new code.');
    }

    if (cached.code !== code) {
      const updatedCache: EmailCodeCache = { ...cached, attempts: cached.attempts + 1 };
      await this.cacheService.set(
        `${this.TWO_FACTOR_PREFIX}email:${userId}`,
        JSON.stringify(updatedCache),
        5 * 60,
      );
      return false;
    }

    await this.cacheService.del(`${this.TWO_FACTOR_PREFIX}email:${userId}`);
    return true;
  }

  /**
   * Enable email-based 2FA
   */
  async enableEmail2FA(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    const config: TwoFactorConfig = {
      enabled: true,
      method: 'email',
      backupCodes: backupCodes.map((code) => this.hashCode(code)),
      enabledAt: new Date().toISOString(),
    };

    await this.save2FAConfig(userId, config);

    // Send backup codes to user
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Two-Factor Authentication Enabled',
      template: 'two-factor-enabled',
      context: {
        name: this.getUserDisplayName(user),
        method: 'Email',
        backupCodes,
      },
    });

    this.logger.log(`Email 2FA enabled for user ${userId}`);
  }

  /**
   * Disable two-factor authentication
   */
  async disable2FA(userId: string): Promise<void> {
    await this.delete2FAConfig(userId);
    this.logger.log(`2FA disabled for user ${userId}`);
  }

  /**
   * Check if 2FA is enabled
   */
  async is2FAEnabled(userId: string): Promise<{ enabled: boolean; method?: string }> {
    const config = await this.get2FAConfig(userId);

    if (!config?.enabled) {
      return { enabled: false };
    }

    return { enabled: true, method: config.method };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const config = await this.get2FAConfig(userId);

    if (!config?.enabled) {
      throw new BadRequestException('2FA not enabled');
    }

    const backupCodes = this.generateBackupCodes(10);

    await this.save2FAConfig(userId, {
      ...config,
      backupCodes: backupCodes.map((code) => this.hashCode(code)),
    });

    this.logger.log(`Backup codes regenerated for user ${userId}`);
    return backupCodes;
  }

  /**
   * Generate random backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(
        crypto.randomBytes(4).toString('hex').toUpperCase(),
      );
    }
    return codes;
  }

  /**
   * Generate numeric code
   */
  private generateNumericCode(length: number): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[crypto.randomInt(digits.length)];
    }
    return code;
  }

  /**
   * Hash a backup code
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Encrypt TOTP secret
   */
  private encryptSecret(secret: string): string {
    const key = this.configService.get('jwt.secret') || 'default-secret-key';
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      algorithm,
      crypto.createHash('sha256').update(key).digest(),
      iv,
    );

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt TOTP secret
   */
  private decryptSecret(encryptedSecret: string): string {
    const key = this.configService.get('jwt.secret') || 'default-secret-key';
    const algorithm = 'aes-256-gcm';
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(
      algorithm,
      crypto.createHash('sha256').update(key).digest(),
      iv,
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
