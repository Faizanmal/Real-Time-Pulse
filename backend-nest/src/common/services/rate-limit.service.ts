import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { AuditService } from '../../audit/audit.service';

interface RateLimitConfig {
  ttl: number; // Time window in milliseconds
  limit: number; // Max requests in window
  blockDuration?: number; // How long to block after limit exceeded (ms)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

interface AnomalyEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  identifier: string;
  details: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly BLOCK_PREFIX = 'rate_block:';
  private readonly ANOMALY_PREFIX = 'anomaly:';

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check rate limit for a given identifier
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
    category: string = 'default',
  ): Promise<RateLimitResult> {
    const key = `${this.RATE_LIMIT_PREFIX}${category}:${identifier}`;
    const blockKey = `${this.BLOCK_PREFIX}${category}:${identifier}`;

    try {
      // Check if blocked
      const blocked = await this.cacheService.get(blockKey);
      if (blocked) {
        const blockData = JSON.parse(blocked);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(blockData.expiresAt),
          retryAfter: Math.ceil(
            (new Date(blockData.expiresAt).getTime() - Date.now()) / 1000,
          ),
        };
      }

      // Get current count
      const current = await this.cacheService.get(key);
      const count = current ? parseInt(current, 10) : 0;

      const ttlSeconds = Math.ceil(config.ttl / 1000);
      const resetAt = new Date(Date.now() + config.ttl);

      if (count >= config.limit) {
        // Limit exceeded
        if (config.blockDuration) {
          await this.blockIdentifier(
            identifier,
            category,
            config.blockDuration,
          );
        }

        // Log anomaly
        await this.recordAnomaly({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          identifier,
          details: {
            category,
            limit: config.limit,
            count,
            ttl: config.ttl,
          },
          timestamp: new Date(),
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter: ttlSeconds,
        };
      }

      // Increment counter
      await this.cacheService.set(key, (count + 1).toString(), ttlSeconds);

      return {
        allowed: true,
        remaining: Math.max(0, config.limit - count - 1),
        resetAt,
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${identifier}`, error);
      // Fail open to avoid blocking legitimate requests
      return {
        allowed: true,
        remaining: config.limit,
        resetAt: new Date(Date.now() + config.ttl),
      };
    }
  }

  /**
   * Check authentication rate limit
   */
  async checkAuthLimit(identifier: string): Promise<RateLimitResult> {
    const config = {
      ttl:
        this.configService.get<number>('security.rateLimit.auth.ttl') || 900000,
      limit:
        this.configService.get<number>('security.rateLimit.auth.limit') || 5,
      blockDuration: 1800000, // 30 minutes
    };

    return this.checkLimit(identifier, config, 'auth');
  }

  /**
   * Check API rate limit
   */
  async checkApiLimit(identifier: string): Promise<RateLimitResult> {
    const config = {
      ttl:
        this.configService.get<number>('security.rateLimit.api.ttl') || 60000,
      limit:
        this.configService.get<number>('security.rateLimit.api.limit') || 1000,
    };

    return this.checkLimit(identifier, config, 'api');
  }

  /**
   * Block an identifier for a specified duration
   */
  private async blockIdentifier(
    identifier: string,
    category: string,
    durationMs: number,
  ): Promise<void> {
    const key = `${this.BLOCK_PREFIX}${category}:${identifier}`;
    const expiresAt = new Date(Date.now() + durationMs);

    await this.cacheService.set(
      key,
      JSON.stringify({
        blockedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        reason: 'rate_limit_exceeded',
      }),
      Math.ceil(durationMs / 1000),
    );

    this.logger.warn(
      `Blocked ${identifier} in category ${category} until ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Record an anomaly event
   */
  async recordAnomaly(event: AnomalyEvent): Promise<void> {
    try {
      const key = `${this.ANOMALY_PREFIX}${event.identifier}:${Date.now()}`;
      await this.cacheService.set(key, JSON.stringify(event), 86400); // 24 hours

      if (event.severity === 'high' || event.severity === 'critical') {
        this.logger.warn(`Security anomaly detected: ${event.type}`, event);

        // Record in audit log
        await this.auditService.log({
          action: 'SECURITY_ANOMALY' as any,
          userId: 'system',
          workspaceId: 'system',
          userEmail: 'security@system',
          entity: 'security',
          entityId: event.identifier,
          method: 'SYSTEM',
          endpoint: '/security/anomaly',
          metadata: event as any,
        });
      }
    } catch (error) {
      this.logger.error('Failed to record anomaly', error);
    }
  }

  /**
   * Get recent anomalies for an identifier
   */
  async getRecentAnomalies(
    identifier: string,
    limit: number = 10,
  ): Promise<AnomalyEvent[]> {
    // This would need a more sophisticated implementation
    // with proper data storage for production use
    return [];
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetLimit(
    identifier: string,
    category: string = 'default',
  ): Promise<void> {
    const key = `${this.RATE_LIMIT_PREFIX}${category}:${identifier}`;
    const blockKey = `${this.BLOCK_PREFIX}${category}:${identifier}`;

    await Promise.all([
      this.cacheService.del(key),
      this.cacheService.del(blockKey),
    ]);
  }
}
