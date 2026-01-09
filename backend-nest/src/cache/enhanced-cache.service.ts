/**
 * Enhanced Cache Service
 * Advanced Redis caching with tags, TTL, and invalidation patterns
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for grouped invalidation
  compress?: boolean; // Compress large values
  staleWhileRevalidate?: number; // Serve stale while fetching fresh
}

interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  deletes: number;
  hitRate: number;
}

@Injectable()
export class EnhancedCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnhancedCacheService.name);
  private redis: Redis;
  private subscriber: Redis;
  private localCache = new Map<string, { value: unknown; expiry: number }>();
  private stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  
  // Default TTLs by category
  private readonly defaultTtls = {
    session: 3600, // 1 hour
    user: 1800, // 30 minutes
    workspace: 900, // 15 minutes
    widget: 300, // 5 minutes
    dashboard: 600, // 10 minutes
    integration: 60, // 1 minute
    analytics: 120, // 2 minutes
    static: 86400, // 24 hours
  };

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.config.get('REDIS_URL', 'redis://localhost:6379');
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.subscriber = this.redis.duplicate();

    try {
      await this.redis.connect();
      await this.subscriber.connect();
      this.setupSubscriber();
      this.logger.log('Enhanced cache service connected to Redis');
    } catch (error) {
      this.logger.warn('Failed to connect to Redis, using local cache only', error);
    }

    // Cleanup expired local cache entries periodically
    setInterval(() => this.cleanupLocalCache(), 60000);
  }

  async onModuleDestroy() {
    await this.redis?.quit();
    await this.subscriber?.quit();
  }

  private setupSubscriber() {
    this.subscriber.subscribe('cache:invalidate');
    
    this.subscriber.on('message', (channel, message) => {
      if (channel === 'cache:invalidate') {
        const { pattern } = JSON.parse(message);
        this.invalidateLocalCache(pattern);
      }
    });
  }

  // ==================== CORE METHODS ====================

  async get<T>(key: string): Promise<T | null> {
    // Check local cache first (L1)
    const local = this.localCache.get(key);
    if (local && local.expiry > Date.now()) {
      this.stats.hits++;
      return local.value as T;
    }

    // Check Redis (L2)
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.hits++;
        const parsed = JSON.parse(cached);
        
        // Update local cache
        this.localCache.set(key, {
          value: parsed,
          expiry: Date.now() + 30000, // 30 seconds local TTL
        });
        
        return parsed as T;
      }
    } catch (error) {
      this.logger.warn(`Cache get error for key ${key}:`, error);
    }

    this.stats.misses++;
    return null;
  }

  async set(
    key: string,
    value: unknown,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 300;
    const serialized = JSON.stringify(value);

    try {
      // Set in Redis with TTL
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      // Track tags for grouped invalidation
      if (options.tags?.length) {
        await this.addToTags(key, options.tags, ttl);
      }

      // Update local cache
      this.localCache.set(key, {
        value,
        expiry: Date.now() + Math.min(ttl * 1000, 30000),
      });

      this.stats.writes++;
    } catch (error) {
      this.logger.warn(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.localCache.delete(key);
      this.stats.deletes++;
    } catch (error) {
      this.logger.warn(`Cache delete error for key ${key}:`, error);
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        keys.forEach((k) => this.localCache.delete(k));
        
        // Notify other instances
        await this.redis.publish(
          'cache:invalidate',
          JSON.stringify({ pattern })
        );
      }
      return keys.length;
    } catch (error) {
      this.logger.warn(`Cache delete by pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  // ==================== ADVANCED PATTERNS ====================

  /**
   * Get or set pattern - fetches from cache or executes factory
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Stale-while-revalidate pattern
   * Returns stale data immediately while refreshing in background
   */
  async getStaleWhileRevalidate<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions & { staleWhileRevalidate: number }
  ): Promise<T | null> {
    const metaKey = `${key}:meta`;
    
    // Get cached value and metadata
    const [cached, meta] = await Promise.all([
      this.get<T>(key),
      this.get<{ fetchedAt: number }>(metaKey),
    ]);

    if (cached !== null) {
      // Check if we should revalidate in background
      const age = meta ? Date.now() - meta.fetchedAt : Infinity;
      if (age > (options.staleWhileRevalidate || 60) * 1000) {
        // Revalidate in background
        this.revalidateInBackground(key, factory, options);
      }
      return cached;
    }

    // No cached value, fetch synchronously
    const value = await factory();
    await this.set(key, value, options);
    await this.set(metaKey, { fetchedAt: Date.now() }, { ttl: options.ttl });
    return value;
  }

  private async revalidateInBackground<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const value = await factory();
      await this.set(key, value, options);
      await this.set(`${key}:meta`, { fetchedAt: Date.now() }, { ttl: options.ttl });
    } catch (error) {
      this.logger.warn(`Background revalidation failed for ${key}:`, error);
    }
  }

  /**
   * Multi-get for batch operations
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    try {
      const values = await this.redis.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        results.set(key, value ? JSON.parse(value) : null);
      });
    } catch (error) {
      this.logger.warn('Cache mget error:', error);
      keys.forEach((key) => results.set(key, null));
    }

    return results;
  }

  /**
   * Multi-set for batch operations
   */
  async mset(
    entries: Map<string, unknown>,
    options: CacheOptions = {}
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    const ttl = options.ttl || 300;

    entries.forEach((value, key) => {
      if (ttl > 0) {
        pipeline.setex(key, ttl, JSON.stringify(value));
      } else {
        pipeline.set(key, JSON.stringify(value));
      }
    });

    try {
      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Cache mset error:', error);
    }
  }

  // ==================== TAG-BASED INVALIDATION ====================

  private async addToTags(key: string, tags: string[], ttl: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    tags.forEach((tag) => {
      const tagKey = `tag:${tag}`;
      pipeline.sadd(tagKey, key);
      if (ttl > 0) {
        pipeline.expire(tagKey, ttl + 60); // Extra minute for tag cleanup
      }
    });

    await pipeline.exec();
  }

  async invalidateByTag(tag: string): Promise<number> {
    const tagKey = `tag:${tag}`;
    
    try {
      const keys = await this.redis.smembers(tagKey);
      if (keys.length > 0) {
        await this.redis.del(...keys, tagKey);
        keys.forEach((k) => this.localCache.delete(k));
        
        await this.redis.publish(
          'cache:invalidate',
          JSON.stringify({ pattern: `tag:${tag}` })
        );
      }
      return keys.length;
    } catch (error) {
      this.logger.warn(`Cache invalidate by tag error for ${tag}:`, error);
      return 0;
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invalidateByTag(tag);
    }
    return total;
  }

  // ==================== RATE LIMITING ====================

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;
    
    try {
      const count = await this.redis.incr(windowKey);
      
      if (count === 1) {
        await this.redis.expire(windowKey, windowSeconds);
      }

      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt: (Math.floor(now / (windowSeconds * 1000)) + 1) * windowSeconds * 1000,
      };
    } catch (error) {
      this.logger.warn('Rate limit check error:', error);
      return { allowed: true, remaining: maxRequests, resetAt: now + windowSeconds * 1000 };
    }
  }

  // ==================== DISTRIBUTED LOCKING ====================

  async acquireLock(
    lockKey: string,
    ttlSeconds: number = 30
  ): Promise<string | null> {
    const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    try {
      const result = await this.redis.set(
        `lock:${lockKey}`,
        lockId,
        'EX',
        ttlSeconds,
        'NX'
      );

      return result === 'OK' ? lockId : null;
    } catch (error) {
      this.logger.warn(`Lock acquire error for ${lockKey}:`, error);
      return null;
    }
  }

  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(script, 1, `lock:${lockKey}`, lockId);
      return result === 1;
    } catch (error) {
      this.logger.warn(`Lock release error for ${lockKey}:`, error);
      return false;
    }
  }

  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options: { ttl?: number; retries?: number; retryDelay?: number } = {}
  ): Promise<T | null> {
    const { ttl = 30, retries = 3, retryDelay = 100 } = options;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      const lockId = await this.acquireLock(lockKey, ttl);
      
      if (lockId) {
        try {
          return await fn();
        } finally {
          await this.releaseLock(lockKey, lockId);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
    }

    return null;
  }

  // ==================== STATISTICS ====================

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  }

  // ==================== HELPERS ====================

  private cleanupLocalCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.expiry < now) {
        this.localCache.delete(key);
      }
    }
  }

  private invalidateLocalCache(pattern: string): void {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of this.localCache.keys()) {
        if (regex.test(key)) {
          this.localCache.delete(key);
        }
      }
    } else {
      this.localCache.delete(pattern);
    }
  }

  // ==================== CACHE KEY BUILDERS ====================

  static keys = {
    user: (userId: string) => `user:${userId}`,
    workspace: (workspaceId: string) => `workspace:${workspaceId}`,
    portal: (portalId: string) => `portal:${portalId}`,
    widget: (widgetId: string) => `widget:${widgetId}`,
    widgetData: (widgetId: string, hash: string) => `widget:${widgetId}:data:${hash}`,
    dashboard: (dashboardId: string) => `dashboard:${dashboardId}`,
    integration: (integrationId: string) => `integration:${integrationId}`,
    integrationData: (integrationId: string, query: string) => 
      `integration:${integrationId}:${Buffer.from(query).toString('base64')}`,
    analytics: (workspaceId: string, metric: string) => 
      `analytics:${workspaceId}:${metric}`,
    session: (sessionId: string) => `session:${sessionId}`,
    template: (templateId: string) => `template:${templateId}`,
    templateList: (category?: string) => `templates:list:${category || 'all'}`,
  };

  static tags = {
    user: (userId: string) => `user:${userId}`,
    workspace: (workspaceId: string) => `workspace:${workspaceId}`,
    portal: (portalId: string) => `portal:${portalId}`,
    widgets: (portalId: string) => `widgets:${portalId}`,
    integrations: (workspaceId: string) => `integrations:${workspaceId}`,
    templates: 'templates',
  };
}
