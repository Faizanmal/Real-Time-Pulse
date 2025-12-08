import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface SecuritySettings {
  mfaEnabled: boolean;
  mfaMethod: 'totp' | 'email' | 'sms';
  passwordPolicy: PasswordPolicy;
  sessionPolicy: SessionPolicy;
  ipWhitelist: string[];
  ssoEnabled: boolean;
  ssoProvider?: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  expirationDays: number;
  preventReuse: number;
}

export interface SessionPolicy {
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  inactivityTimeoutMinutes: number;
  requireReauthForSensitive: boolean;
}

export interface LoginAttempt {
  userId: string;
  ip: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  reason?: string;
}

interface AccountLock {
  lockedUntil: string;
  reason: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly SETTINGS_PREFIX = 'security:settings:';
  private readonly LOCK_PREFIX = 'account_lock:';
  private readonly SESSIONS_PREFIX = 'sessions:';
  private readonly ATTEMPTS_PREFIX = 'login_attempts:';
  private readonly PASSWORD_HISTORY_PREFIX = 'password_history:';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cacheService: CacheService,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  /**
   * Get user display name helper
   */
  private getUserDisplayName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  }): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email.split('@')[0];
  }

  /**
   * Get default security settings
   */
  private getDefaultSettings(): SecuritySettings {
    return {
      mfaEnabled: false,
      mfaMethod: 'totp',
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: false,
        expirationDays: 90,
        preventReuse: 5,
      },
      sessionPolicy: {
        maxConcurrentSessions: 5,
        sessionTimeoutMinutes: 1440, // 24 hours
        inactivityTimeoutMinutes: 30,
        requireReauthForSensitive: true,
      },
      ipWhitelist: [],
      ssoEnabled: false,
    };
  }

  /**
   * Get security settings for a workspace
   */
  async getSecuritySettings(workspaceId: string): Promise<SecuritySettings> {
    const cached = await this.cacheService.get(
      `${this.SETTINGS_PREFIX}${workspaceId}`,
    );

    if (cached) {
      try {
        return { ...this.getDefaultSettings(), ...JSON.parse(cached) };
      } catch {
        // Invalid cache, return defaults
      }
    }

    return this.getDefaultSettings();
  }

  /**
   * Update security settings for a workspace
   */
  async updateSecuritySettings(
    workspaceId: string,
    settings: Partial<SecuritySettings>,
    userId: string,
  ): Promise<SecuritySettings> {
    const currentSettings = await this.getSecuritySettings(workspaceId);
    const newSettings = { ...currentSettings, ...settings };

    await this.cacheService.set(
      `${this.SETTINGS_PREFIX}${workspaceId}`,
      JSON.stringify(newSettings),
      365 * 24 * 60 * 60, // 1 year
    );

    // Audit log
    await this.auditService.log({
      action: 'CHANGE_SETTINGS',
      userId,
      workspaceId,
      userEmail: '',
      entity: 'workspace',
      entityId: workspaceId,
      method: 'PUT',
      endpoint: '/security/settings',
      metadata: { type: 'security_settings' },
    });

    this.logger.log(`Security settings updated for workspace ${workspaceId}`);
    return newSettings;
  }

  /**
   * Validate password against policy
   */
  validatePassword(
    password: string,
    policy: PasswordPolicy,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(
        `Password must be at least ${policy.minLength} characters long`,
      );
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if password was recently used
   */
  async checkPasswordReuse(
    userId: string,
    newPassword: string,
    preventReuse: number,
  ): Promise<boolean> {
    const cached = await this.cacheService.get(
      `${this.PASSWORD_HISTORY_PREFIX}${userId}`,
    );
    const history: string[] = cached ? JSON.parse(cached) : [];

    for (const oldHash of history.slice(0, preventReuse)) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return true; // Password was reused
      }
    }

    return false;
  }

  /**
   * Add password to history
   */
  async addPasswordToHistory(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    const cached = await this.cacheService.get(
      `${this.PASSWORD_HISTORY_PREFIX}${userId}`,
    );
    const history: string[] = cached ? JSON.parse(cached) : [];

    history.unshift(passwordHash);
    const trimmedHistory = history.slice(0, 10); // Keep last 10 passwords

    await this.cacheService.set(
      `${this.PASSWORD_HISTORY_PREFIX}${userId}`,
      JSON.stringify(trimmedHistory),
      365 * 24 * 60 * 60, // 1 year
    );
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(attempt: LoginAttempt): Promise<void> {
    const cacheKey = `${this.ATTEMPTS_PREFIX}${attempt.userId}`;
    const cached = await this.cacheService.get(cacheKey);
    const attempts: LoginAttempt[] = cached ? JSON.parse(cached) : [];

    attempts.unshift(attempt);
    const recentAttempts = attempts.slice(0, 100); // Keep last 100 attempts

    await this.cacheService.set(
      cacheKey,
      JSON.stringify(recentAttempts),
      7 * 24 * 60 * 60,
    ); // 7 days

    // Check for brute force
    if (!attempt.success) {
      await this.checkBruteForce(attempt.userId, attempt.ip);
    }

    // Audit log
    await this.auditService.log({
      action: attempt.success ? 'LOGIN' : 'LOGOUT',
      userId: attempt.userId,
      workspaceId: '',
      userEmail: '',
      entity: 'user',
      entityId: attempt.userId,
      method: 'POST',
      endpoint: '/auth/login',
      ipAddress: attempt.ip,
      userAgent: attempt.userAgent,
      metadata: {
        reason: attempt.reason,
        success: attempt.success,
      },
    });
  }

  /**
   * Check for brute force attacks
   */
  private async checkBruteForce(userId: string, ip: string): Promise<void> {
    const cacheKey = `${this.ATTEMPTS_PREFIX}${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    const attempts: LoginAttempt[] = cached ? JSON.parse(cached) : [];

    const recentFailures = attempts.filter(
      (a) =>
        !a.success &&
        new Date(a.timestamp).getTime() > Date.now() - 15 * 60 * 1000, // Last 15 minutes
    );

    if (recentFailures.length >= 5) {
      // Lock account temporarily
      await this.lockAccount(userId, 15); // 15 minutes

      // Send notification
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.email) {
        await this.emailService.sendEmail({
          to: user.email,
          subject: 'Security Alert: Multiple Failed Login Attempts',
          template: 'security-alert',
          context: {
            name: this.getUserDisplayName(user),
            attempts: recentFailures.length,
            ip,
            time: new Date().toISOString(),
          },
        });
      }

      this.logger.warn(
        `Account ${userId} locked due to brute force attempt from IP ${ip}`,
      );
    }
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, minutes: number): Promise<void> {
    const lockUntil = new Date(Date.now() + minutes * 60 * 1000);
    const lockData: AccountLock = {
      lockedUntil: lockUntil.toISOString(),
      reason: 'brute_force',
    };

    await this.cacheService.set(
      `${this.LOCK_PREFIX}${userId}`,
      JSON.stringify(lockData),
      minutes * 60,
    );
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(
    userId: string,
  ): Promise<{ locked: boolean; until?: Date; reason?: string }> {
    const cached = await this.cacheService.get(`${this.LOCK_PREFIX}${userId}`);

    if (!cached) {
      return { locked: false };
    }

    try {
      const lock: AccountLock = JSON.parse(cached);
      const lockedUntil = new Date(lock.lockedUntil);

      if (lockedUntil > new Date()) {
        return { locked: true, until: lockedUntil, reason: lock.reason };
      }

      // Lock expired, remove it
      await this.cacheService.del(`${this.LOCK_PREFIX}${userId}`);
      return { locked: false };
    } catch {
      return { locked: false };
    }
  }

  /**
   * Unlock account
   */
  async unlockAccount(userId: string, adminUserId: string): Promise<void> {
    await this.cacheService.del(`${this.LOCK_PREFIX}${userId}`);

    await this.auditService.log({
      action: 'CHANGE_SETTINGS',
      userId: adminUserId,
      workspaceId: '',
      userEmail: '',
      entity: 'user',
      entityId: userId,
      method: 'POST',
      endpoint: '/security/account/unlock',
      metadata: { action: 'unlock_account', unlockedBy: adminUserId },
    });

    this.logger.log(`Account ${userId} unlocked by admin ${adminUserId}`);
  }

  /**
   * Validate IP against whitelist
   */
  validateIpWhitelist(ip: string, whitelist: string[]): boolean {
    if (whitelist.length === 0) {
      return true; // No whitelist = allow all
    }

    return whitelist.some((allowed) => {
      if (allowed.includes('/')) {
        // CIDR notation
        return this.isIpInCidr(ip, allowed);
      }
      return ip === allowed;
    });
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<any[]> {
    const cached = await this.cacheService.get(
      `${this.SESSIONS_PREFIX}${userId}`,
    );
    return cached ? JSON.parse(cached) : [];
  }

  /**
   * Terminate session
   */
  async terminateSession(
    userId: string,
    sessionId: string,
    adminUserId?: string,
  ): Promise<void> {
    const sessions = await this.getActiveSessions(userId);
    const updatedSessions = sessions.filter((s: any) => s.id !== sessionId);

    await this.cacheService.set(
      `${this.SESSIONS_PREFIX}${userId}`,
      JSON.stringify(updatedSessions),
      24 * 60 * 60,
    );

    await this.auditService.log({
      action: 'LOGOUT',
      userId: adminUserId || userId,
      workspaceId: '',
      userEmail: '',
      entity: 'session',
      entityId: sessionId,
      method: 'DELETE',
      endpoint: '/security/sessions',
      metadata: { targetUserId: userId, action: 'terminate_session' },
    });
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllSessions(
    userId: string,
    adminUserId?: string,
  ): Promise<void> {
    await this.cacheService.del(`${this.SESSIONS_PREFIX}${userId}`);

    await this.auditService.log({
      action: 'LOGOUT',
      userId: adminUserId || userId,
      workspaceId: '',
      userEmail: '',
      entity: 'user',
      entityId: userId,
      method: 'DELETE',
      endpoint: '/security/sessions',
      metadata: { action: 'terminate_all_sessions' },
    });

    this.logger.log(`All sessions terminated for user ${userId}`);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
