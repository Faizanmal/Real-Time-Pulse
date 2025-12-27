/**
 * =============================================================================
 * REAL-TIME PULSE - ADVANCED SECURITY SERVICE
 * =============================================================================
 * 
 * Enhanced security features including:
 * - Action-based rate limiting
 * - Brute force protection with progressive delays
 * - API key scoping (read/write permissions)
 * - IP reputation tracking
 * - Suspicious activity detection
 */

import { Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../cache/redis.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  points: number;      // Number of allowed requests
  duration: number;    // Time window in seconds
  blockDuration?: number; // Block duration when limit exceeded
}

export interface ActionRateLimits {
  [action: string]: RateLimitConfig;
}

export interface ApiKeyScope {
  read: boolean;
  write: boolean;
  admin: boolean;
  resources: string[];  // Specific resources this key can access
  rateLimit?: RateLimitConfig;
}

export interface BruteForceResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil?: Date;
  delay?: number;  // Progressive delay in ms
}

export interface IpReputation {
  score: number;        // 0-100, higher is more trusted
  failedAttempts: number;
  successfulAttempts: number;
  lastSeen: Date;
  blocked: boolean;
  blockedReason?: string;
}

export interface SuspiciousActivity {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class AdvancedSecurityService {
  private readonly logger = new Logger(AdvancedSecurityService.name);
  
  // Redis key prefixes
  private readonly RATE_LIMIT_PREFIX = 'ratelimit:';
  private readonly BRUTE_FORCE_PREFIX = 'bruteforce:';
  private readonly IP_REPUTATION_PREFIX = 'ip:';
  private readonly API_KEY_PREFIX = 'apikey:';
  private readonly SUSPICIOUS_ACTIVITY_PREFIX = 'suspicious:';

  // Default rate limits per action
  private readonly defaultActionLimits: ActionRateLimits = {
    'login': { points: 5, duration: 300, blockDuration: 900 },          // 5 attempts per 5 min
    'register': { points: 3, duration: 3600, blockDuration: 3600 },     // 3 per hour
    'password-reset': { points: 3, duration: 3600 },                     // 3 per hour
    'api-call': { points: 100, duration: 60 },                           // 100 per minute
    'export': { points: 10, duration: 3600 },                            // 10 per hour
    'ai-query': { points: 20, duration: 3600 },                          // 20 AI queries per hour
    'webhook-create': { points: 10, duration: 3600 },                    // 10 webhooks per hour
    'integration-sync': { points: 30, duration: 3600 },                  // 30 syncs per hour
    'report-generate': { points: 20, duration: 3600 },                   // 20 reports per hour
    'bulk-operation': { points: 5, duration: 3600 },                     // 5 bulk ops per hour
  };

  // Brute force protection config
  private readonly bruteForceConfig = {
    maxAttempts: 5,
    windowSeconds: 300,         // 5 minute window
    blockSeconds: 900,          // 15 minute block
    progressiveDelays: [0, 1000, 2000, 5000, 10000], // Progressive delays in ms
  };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  // ============================================================================
  // ACTION-BASED RATE LIMITING
  // ============================================================================

  /**
   * Check and consume rate limit for a specific action
   */
  async checkRateLimit(
    identifier: string,  // userId, IP, or apiKey
    action: string,
    customConfig?: RateLimitConfig,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const config = customConfig || this.defaultActionLimits[action] || {
      points: 100,
      duration: 60,
    };

    const key = `${this.RATE_LIMIT_PREFIX}${action}:${identifier}`;
    const now = Date.now();
    const windowStart = now - (config.duration * 1000);

    try {
      // Use Redis sorted set for sliding window
      const client = this.redis.getClient();
      
      // Remove old entries outside the window
      await client.zremrangebyscore(key, 0, windowStart);
      
      // Count current entries
      const count = await client.zcard(key);
      
      if (count >= config.points) {
        // Rate limited
        const oldestEntry = await client.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime = oldestEntry.length > 1 
          ? new Date(parseInt(oldestEntry[1]) + (config.duration * 1000))
          : new Date(now + (config.duration * 1000));

        this.logger.warn(`Rate limit exceeded for ${action} by ${identifier}`);
        
        return {
          allowed: false,
          remaining: 0,
          resetAt: resetTime,
        };
      }

      // Add new entry
      await client.zadd(key, now, `${now}-${Math.random()}`);
      await client.expire(key, config.duration);

      return {
        allowed: true,
        remaining: config.points - count - 1,
        resetAt: new Date(now + (config.duration * 1000)),
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error}`);
      // Fail open - allow the request if Redis fails
      return { allowed: true, remaining: 0, resetAt: new Date() };
    }
  }

  /**
   * Get rate limit headers for response
   */
  getRateLimitHeaders(result: { remaining: number; resetAt: Date }): Record<string, string> {
    return {
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
    };
  }

  // ============================================================================
  // BRUTE FORCE PROTECTION
  // ============================================================================

  /**
   * Check if login attempt is allowed (brute force protection)
   */
  async checkBruteForce(identifier: string): Promise<BruteForceResult> {
    const key = `${this.BRUTE_FORCE_PREFIX}${identifier}`;
    const blockKey = `${key}:blocked`;

    try {
      const client = this.redis.getClient();

      // Check if blocked
      const blockedUntil = await client.get(blockKey);
      if (blockedUntil) {
        const blockTime = new Date(parseInt(blockedUntil));
        if (blockTime > new Date()) {
          return {
            allowed: false,
            remainingAttempts: 0,
            blockedUntil: blockTime,
          };
        }
        // Block expired, remove it
        await client.del(blockKey);
      }

      // Get current attempt count
      const attempts = parseInt(await client.get(key) || '0');
      const remaining = this.bruteForceConfig.maxAttempts - attempts;

      if (remaining <= 0) {
        // Block the identifier
        const blockUntil = Date.now() + (this.bruteForceConfig.blockSeconds * 1000);
        await client.set(blockKey, blockUntil.toString(), 'EX', this.bruteForceConfig.blockSeconds);
        
        this.logger.warn(`Brute force protection triggered for ${identifier}`);
        
        return {
          allowed: false,
          remainingAttempts: 0,
          blockedUntil: new Date(blockUntil),
        };
      }

      // Calculate progressive delay
      const delay = this.bruteForceConfig.progressiveDelays[
        Math.min(attempts, this.bruteForceConfig.progressiveDelays.length - 1)
      ];

      return {
        allowed: true,
        remainingAttempts: remaining,
        delay,
      };
    } catch (error) {
      this.logger.error(`Brute force check failed: ${error}`);
      return { allowed: true, remainingAttempts: 5 };
    }
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedAttempt(identifier: string): Promise<void> {
    const key = `${this.BRUTE_FORCE_PREFIX}${identifier}`;

    try {
      const client = this.redis.getClient();
      await client.incr(key);
      await client.expire(key, this.bruteForceConfig.windowSeconds);
    } catch (error) {
      this.logger.error(`Failed to record attempt: ${error}`);
    }
  }

  /**
   * Clear failed attempts on successful login
   */
  async clearFailedAttempts(identifier: string): Promise<void> {
    const key = `${this.BRUTE_FORCE_PREFIX}${identifier}`;
    const blockKey = `${key}:blocked`;

    try {
      const client = this.redis.getClient();
      await client.del(key, blockKey);
    } catch (error) {
      this.logger.error(`Failed to clear attempts: ${error}`);
    }
  }

  // ============================================================================
  // API KEY SCOPING
  // ============================================================================

  /**
   * Create a new scoped API key
   */
  async createApiKey(
    workspaceId: string,
    userId: string,
    name: string,
    scope: ApiKeyScope,
    expiresAt?: Date,
  ): Promise<{ key: string; hashedKey: string }> {
    // Generate secure random key
    const key = `rtp_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = this.hashApiKey(key);

    // Store in database
    await this.prisma.apiKey.create({
      data: {
        name,
        hashedKey,
        workspaceId,
        userId,
        scopes: scope as any,
        expiresAt,
      },
    });

    // Cache scope for fast lookup
    await this.redis.setJSON(
      `${this.API_KEY_PREFIX}${hashedKey}`,
      {
        workspaceId,
        userId,
        scope,
        expiresAt: expiresAt?.toISOString(),
      },
      expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : 86400 * 30,
    );

    this.logger.log(`API key created for workspace ${workspaceId}`);

    return { key, hashedKey };
  }

  /**
   * Validate API key and check scope
   */
  async validateApiKey(
    key: string,
    requiredScope: 'read' | 'write' | 'admin',
    resource?: string,
  ): Promise<{ valid: boolean; workspaceId?: string; userId?: string; error?: string }> {
    const hashedKey = this.hashApiKey(key);
    const cacheKey = `${this.API_KEY_PREFIX}${hashedKey}`;

    try {
      // Try cache first
      let keyData = await this.redis.getJSON<{
        workspaceId: string;
        userId: string;
        scope: ApiKeyScope;
        expiresAt?: string;
      }>(cacheKey);

      // Fallback to database
      if (!keyData) {
        const dbKey = await this.prisma.apiKey.findUnique({
          where: { hashedKey },
        });

        if (!dbKey) {
          return { valid: false, error: 'Invalid API key' };
        }

        keyData = {
          workspaceId: dbKey.workspaceId,
          userId: dbKey.userId,
          scope: dbKey.scopes as unknown as ApiKeyScope,
          expiresAt: dbKey.expiresAt?.toISOString(),
        };

        // Cache for future lookups
        await this.redis.setJSON(cacheKey, keyData, 3600);
      }

      // Check expiration
      if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return { valid: false, error: 'API key expired' };
      }

      // Check scope
      const scope = keyData.scope;
      if (requiredScope === 'admin' && !scope.admin) {
        return { valid: false, error: 'Insufficient permissions: admin required' };
      }
      if (requiredScope === 'write' && !scope.write && !scope.admin) {
        return { valid: false, error: 'Insufficient permissions: write required' };
      }
      if (requiredScope === 'read' && !scope.read && !scope.write && !scope.admin) {
        return { valid: false, error: 'Insufficient permissions: read required' };
      }

      // Check resource access
      if (resource && scope.resources.length > 0 && !scope.resources.includes(resource)) {
        return { valid: false, error: `No access to resource: ${resource}` };
      }

      return {
        valid: true,
        workspaceId: keyData.workspaceId,
        userId: keyData.userId,
      };
    } catch (error) {
      this.logger.error(`API key validation failed: ${error}`);
      return { valid: false, error: 'Validation error' };
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(hashedKey: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { hashedKey },
      data: { revokedAt: new Date() },
    });

    await this.redis.del(`${this.API_KEY_PREFIX}${hashedKey}`);
    
    this.logger.log(`API key revoked: ${hashedKey.substring(0, 8)}...`);
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  // ============================================================================
  // IP REPUTATION TRACKING
  // ============================================================================

  /**
   * Get or create IP reputation
   */
  async getIpReputation(ip: string): Promise<IpReputation> {
    const key = `${this.IP_REPUTATION_PREFIX}${ip}`;

    try {
      const cached = await this.redis.getJSON<IpReputation>(key);
      if (cached) return cached;

      // Initialize new reputation
      const reputation: IpReputation = {
        score: 50, // Neutral starting score
        failedAttempts: 0,
        successfulAttempts: 0,
        lastSeen: new Date(),
        blocked: false,
      };

      await this.redis.setJSON(key, reputation, 86400 * 7); // 7 days
      return reputation;
    } catch (error) {
      return {
        score: 50,
        failedAttempts: 0,
        successfulAttempts: 0,
        lastSeen: new Date(),
        blocked: false,
      };
    }
  }

  /**
   * Update IP reputation based on activity
   */
  async updateIpReputation(
    ip: string,
    success: boolean,
    activity?: string,
  ): Promise<IpReputation> {
    const key = `${this.IP_REPUTATION_PREFIX}${ip}`;
    const reputation = await this.getIpReputation(ip);

    if (success) {
      reputation.successfulAttempts++;
      reputation.score = Math.min(100, reputation.score + 1);
    } else {
      reputation.failedAttempts++;
      reputation.score = Math.max(0, reputation.score - 5);
    }

    reputation.lastSeen = new Date();

    // Auto-block very low reputation IPs
    if (reputation.score < 10) {
      reputation.blocked = true;
      reputation.blockedReason = 'Low reputation score';
      this.logger.warn(`IP ${ip} auto-blocked due to low reputation`);
    }

    await this.redis.setJSON(key, reputation, 86400 * 7);
    return reputation;
  }

  /**
   * Block an IP address
   */
  async blockIp(ip: string, reason: string, duration?: number): Promise<void> {
    const reputation = await this.getIpReputation(ip);
    reputation.blocked = true;
    reputation.blockedReason = reason;
    reputation.score = 0;

    await this.redis.setJSON(
      `${this.IP_REPUTATION_PREFIX}${ip}`,
      reputation,
      duration || 86400, // Default 24 hours
    );

    this.logger.warn(`IP ${ip} blocked: ${reason}`);

    await this.audit.log({
      action: 'IP_BLOCKED',
      category: 'SECURITY',
      severity: 'HIGH',
      details: { ip, reason },
    });
  }

  // ============================================================================
  // SUSPICIOUS ACTIVITY DETECTION
  // ============================================================================

  /**
   * Record suspicious activity
   */
  async recordSuspiciousActivity(
    userId: string | null,
    ip: string,
    activity: Omit<SuspiciousActivity, 'timestamp'>,
  ): Promise<void> {
    const key = `${this.SUSPICIOUS_ACTIVITY_PREFIX}${userId || ip}`;
    const fullActivity: SuspiciousActivity = {
      ...activity,
      timestamp: new Date(),
    };

    try {
      const client = this.redis.getClient();
      
      // Store as list (most recent first)
      await client.lpush(key, JSON.stringify(fullActivity));
      await client.ltrim(key, 0, 99); // Keep last 100 activities
      await client.expire(key, 86400 * 30); // 30 days

      // Log critical activities
      if (activity.severity === 'critical' || activity.severity === 'high') {
        this.logger.warn(`Suspicious activity detected: ${activity.type}`, {
          userId,
          ip,
          ...activity,
        });

        await this.audit.log({
          action: 'SUSPICIOUS_ACTIVITY',
          category: 'SECURITY',
          userId: userId || undefined,
          severity: activity.severity === 'critical' ? 'CRITICAL' : 'HIGH',
          details: { ip, ...activity },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to record suspicious activity: ${error}`);
    }
  }

  /**
   * Get suspicious activities for a user/IP
   */
  async getSuspiciousActivities(
    identifier: string,
    limit = 50,
  ): Promise<SuspiciousActivity[]> {
    const key = `${this.SUSPICIOUS_ACTIVITY_PREFIX}${identifier}`;

    try {
      const client = this.redis.getClient();
      const activities = await client.lrange(key, 0, limit - 1);
      return activities.map((a) => JSON.parse(a));
    } catch (error) {
      return [];
    }
  }

  /**
   * Detect anomalous behavior patterns
   */
  async detectAnomalies(
    userId: string,
    currentAction: string,
    metadata: Record<string, unknown>,
  ): Promise<SuspiciousActivity[]> {
    const anomalies: SuspiciousActivity[] = [];
    const recentActivities = await this.getSuspiciousActivities(userId, 20);

    // Check for rapid-fire requests (more than 10 in 10 seconds)
    const recentCount = recentActivities.filter(
      (a) => Date.now() - new Date(a.timestamp).getTime() < 10000,
    ).length;

    if (recentCount > 10) {
      anomalies.push({
        type: 'RAPID_REQUESTS',
        severity: 'medium',
        description: 'Unusually rapid request pattern detected',
        metadata: { count: recentCount, action: currentAction },
        timestamp: new Date(),
      });
    }

    // Check for unusual time of access
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) {
      // Check if user normally accesses during these hours
      const normalHours = recentActivities.filter((a) => {
        const h = new Date(a.timestamp).getHours();
        return h >= 2 && h <= 5;
      });

      if (normalHours.length < 2) {
        anomalies.push({
          type: 'UNUSUAL_TIME',
          severity: 'low',
          description: 'Access during unusual hours',
          metadata: { hour, action: currentAction },
          timestamp: new Date(),
        });
      }
    }

    // Check for geographic anomalies (if IP geolocation is available)
    if (metadata.country && metadata.previousCountry) {
      if (metadata.country !== metadata.previousCountry) {
        anomalies.push({
          type: 'GEOGRAPHIC_ANOMALY',
          severity: 'high',
          description: 'Access from unexpected location',
          metadata: {
            currentCountry: metadata.country,
            previousCountry: metadata.previousCountry,
          },
          timestamp: new Date(),
        });
      }
    }

    return anomalies;
  }

  // ============================================================================
  // SECURITY SCORE
  // ============================================================================

  /**
   * Calculate security score for a workspace
   */
  async calculateSecurityScore(workspaceId: string): Promise<{
    score: number;
    factors: Array<{ name: string; score: number; maxScore: number; recommendation?: string }>;
  }> {
    const factors: Array<{ name: string; score: number; maxScore: number; recommendation?: string }> = [];

    // Check 2FA adoption
    const users = await this.prisma.user.findMany({
      where: { workspaceId },
      select: { twoFactorEnabled: true },
    });
    const twoFactorRate = users.filter((u) => u.twoFactorEnabled).length / users.length;
    factors.push({
      name: '2FA Adoption',
      score: Math.round(twoFactorRate * 25),
      maxScore: 25,
      recommendation: twoFactorRate < 1 ? 'Enable 2FA for all users' : undefined,
    });

    // Check API key usage
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { workspaceId, revokedAt: null },
    });
    const expiredKeys = apiKeys.filter((k) => k.expiresAt && k.expiresAt < new Date());
    factors.push({
      name: 'API Key Hygiene',
      score: expiredKeys.length === 0 ? 20 : Math.max(0, 20 - expiredKeys.length * 5),
      maxScore: 20,
      recommendation: expiredKeys.length > 0 ? `Revoke ${expiredKeys.length} expired API keys` : undefined,
    });

    // Check recent suspicious activities
    const recentIncidents = await this.getSuspiciousActivities(workspaceId, 10);
    const highSeverityIncidents = recentIncidents.filter(
      (a) => a.severity === 'high' || a.severity === 'critical',
    ).length;
    factors.push({
      name: 'Incident History',
      score: Math.max(0, 25 - highSeverityIncidents * 5),
      maxScore: 25,
      recommendation: highSeverityIncidents > 0 
        ? 'Review and address recent security incidents' 
        : undefined,
    });

    // Check password policy compliance (assuming we track this)
    factors.push({
      name: 'Password Policy',
      score: 15, // Would need actual data
      maxScore: 15,
    });

    // Check audit logging
    factors.push({
      name: 'Audit Logging',
      score: 15, // Enabled by default
      maxScore: 15,
    });

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxScore = factors.reduce((sum, f) => sum + f.maxScore, 0);

    return {
      score: Math.round((totalScore / maxScore) * 100),
      factors,
    };
  }
}
