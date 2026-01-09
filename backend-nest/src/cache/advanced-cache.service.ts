/**
 * =============================================================================
 * REAL-TIME PULSE - ADVANCED CACHING SERVICE
 * =============================================================================
 *
 * Enhanced caching with stale-while-revalidate, cache warming, pub/sub
 * invalidation, and comprehensive metrics.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';

interface CacheOptions {
  ttl?: number;
  staleWhileRevalidate?: number; // Grace period to serve stale data
  tags?: string[]; // Tags for grouped invalidation
  compress?: boolean;
}

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttl: number;
  staleUntil: number;
  tags: string[];
  version: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  staleHits: number;
  revalidations: number;
  invalidations: number;
  errors: number;
  avgFetchTime: number;
  totalFetchTime: number;
}

@Injectable()
export class AdvancedCacheService implements OnModuleInit {
  private readonly logger = new Logger(AdvancedCacheService.name);
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly DEFAULT_STALE_WINDOW = 300; // 5 minutes grace period
  private readonly CACHE_PREFIX = 'cache:';
  private readonly TAG_PREFIX = 'tag:';
  private readonly LOCK_PREFIX = 'lock:';
  private readonly VERSION_KEY = 'cache:version';

  private currentVersion = 1;
  private pendingRevalidations = new Map<string, Promise<unknown>>();

  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    revalidations: 0,
    invalidations: 0,
    errors: 0,
    avgFetchTime: 0,
    totalFetchTime: 0,
  };

  constructor(
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Subscribe to cache invalidation events
    void this.setupPubSub();

    // Load current version
    await this.loadVersion();

    this.logger.log('Advanced cache service initialized');
  }

  /**
   * Setup Redis pub/sub for distributed cache invalidation
   */
  private async setupPubSub() {
    try {
      const subscriber = this.redis.getClient().duplicate();
      await subscriber.subscribe('cache:invalidate');

      subscriber.on('message', (channel, message) => {
        if (channel === 'cache:invalidate') {
          const { pattern, tags, global } = JSON.parse(message);

          if (global) {
            void this.incrementVersion();
          } else if (tags) {
            void this.invalidateByTagsLocal(tags);
          } else if (pattern) {
            void this.invalidatePatternLocal(pattern);
          }
        }
      });
    } catch {
      this.logger.warn('Failed to setup pub/sub, running in single-node mode');
    }
  }

  /**
   * Load current cache version from Redis
   */
  private async loadVersion() {
    try {
      const version = await this.redis.get(this.VERSION_KEY);
      this.currentVersion = version ? parseInt(version, 10) : 1;
    } catch {
      this.currentVersion = 1;
    }
  }

  /**
   * Increment cache version (invalidates all entries)
   */
  private async incrementVersion() {
    this.currentVersion++;
    await this.redis.set(this.VERSION_KEY, this.currentVersion.toString());
  }

  /**
   * Get or fetch with stale-while-revalidate pattern
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const {
      ttl = this.DEFAULT_TTL,
      staleWhileRevalidate = this.DEFAULT_STALE_WINDOW,
      tags = [],
    } = options;

    const fullKey = this.getFullKey(key);

    try {
      // Try to get from cache
      const cached = await this.getCacheEntry<T>(fullKey);

      if (cached) {
        const now = Date.now();
        const isExpired = now > cached.createdAt + cached.ttl * 1000;
        const isStale = isExpired && now < cached.staleUntil;
        const isVersionMismatch = cached.version !== this.currentVersion;

        // Fresh cache hit
        if (!isExpired && !isVersionMismatch) {
          this.metrics.hits++;
          return cached.data;
        }

        // Stale but within grace period - return stale and revalidate in background
        if (isStale && !isVersionMismatch) {
          this.metrics.staleHits++;
          this.revalidateInBackground(key, fullKey, fetchFn, options);
          return cached.data;
        }
      }

      // Cache miss - fetch fresh data
      this.metrics.misses++;
      return await this.fetchAndCache(key, fullKey, fetchFn, {
        ttl,
        staleWhileRevalidate,
        tags,
      });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache error for key ${key}:`, error);

      // Fallback to direct fetch
      return await fetchFn();
    }
  }

  /**
   * Get cached entry with metadata
   */
  private async getCacheEntry<T>(
    fullKey: string,
  ): Promise<CacheEntry<T> | null> {
    const data = await this.redis.get(fullKey);
    if (!data) return null;

    try {
      return JSON.parse(data) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  /**
   * Fetch fresh data and cache it
   */
  private async fetchAndCache<T>(
    key: string,
    fullKey: string,
    fetchFn: () => Promise<T>,
    options: { ttl: number; staleWhileRevalidate: number; tags: string[] },
  ): Promise<T> {
    const startTime = Date.now();

    // Acquire lock to prevent thundering herd
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const lockAcquired = await this.acquireLock(lockKey, 30);

    if (!lockAcquired) {
      // Another process is fetching, wait a bit and try cache again
      await new Promise((resolve) => setTimeout(resolve, 100));
      const cached = await this.getCacheEntry<T>(fullKey);
      if (cached) {
        return cached.data;
      }
    }

    try {
      const data = await fetchFn();
      const fetchTime = Date.now() - startTime;

      this.metrics.totalFetchTime += fetchTime;
      this.metrics.avgFetchTime =
        this.metrics.totalFetchTime /
        (this.metrics.misses + this.metrics.revalidations);

      const entry: CacheEntry<T> = {
        data,
        createdAt: Date.now(),
        ttl: options.ttl,
        staleUntil:
          Date.now() + (options.ttl + options.staleWhileRevalidate) * 1000,
        tags: options.tags,
        version: this.currentVersion,
      };

      await this.redis.set(
        fullKey,
        JSON.stringify(entry),
        options.ttl + options.staleWhileRevalidate,
      );

      // Store tag associations
      for (const tag of options.tags) {
        await this.addKeyToTag(tag, fullKey);
      }

      return data;
    } finally {
      if (lockAcquired) {
        await this.releaseLock(lockKey);
      }
    }
  }

  /**
   * Revalidate cache in background (non-blocking)
   */
  private revalidateInBackground<T>(
    key: string,
    fullKey: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions,
  ): void {
    // Prevent multiple concurrent revalidations for the same key
    if (this.pendingRevalidations.has(key)) {
      return;
    }

    const revalidation = (async () => {
      try {
        this.metrics.revalidations++;
        await this.fetchAndCache(key, fullKey, fetchFn, {
          ttl: options.ttl || this.DEFAULT_TTL,
          staleWhileRevalidate:
            options.staleWhileRevalidate || this.DEFAULT_STALE_WINDOW,
          tags: options.tags || [],
        });
      } catch (error) {
        this.logger.warn(`Background revalidation failed for ${key}:`, error);
      } finally {
        this.pendingRevalidations.delete(key);
      }
    })();

    this.pendingRevalidations.set(key, revalidation);
  }

  /**
   * Simple distributed lock
   */
  private async acquireLock(
    lockKey: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.redis
      .getClient()
      .set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    await this.redis.del(lockKey);
  }

  /**
   * Add key to tag set
   */
  private async addKeyToTag(tag: string, key: string): Promise<void> {
    await this.redis.getClient().sadd(`${this.TAG_PREFIX}${tag}`, key);
  }

  /**
   * Get full cache key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.CACHE_PREFIX}${key}`;
  }

  /**
   * Invalidate cache by pattern (local)
   */
  private async invalidatePatternLocal(pattern: string): Promise<void> {
    const keys = await this.redis
      .getClient()
      .keys(`${this.CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await this.redis.getClient().del(...keys);
      this.metrics.invalidations += keys.length;
    }
  }

  /**
   * Invalidate cache by tags (local)
   */
  private async invalidateByTagsLocal(tags: string[]): Promise<void> {
    for (const tag of tags) {
      const keys = await this.redis
        .getClient()
        .smembers(`${this.TAG_PREFIX}${tag}`);
      if (keys.length > 0) {
        await this.redis.getClient().del(...keys);
        await this.redis.getClient().del(`${this.TAG_PREFIX}${tag}`);
        this.metrics.invalidations += keys.length;
      }
    }
  }

  /**
   * Invalidate cache by pattern (distributed via pub/sub)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    await this.invalidatePatternLocal(pattern);

    // Broadcast to other instances
    await this.redis
      .getClient()
      .publish('cache:invalidate', JSON.stringify({ pattern }));
  }

  /**
   * Invalidate cache by tags (distributed via pub/sub)
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    await this.invalidateByTagsLocal(tags);

    // Broadcast to other instances
    await this.redis
      .getClient()
      .publish('cache:invalidate', JSON.stringify({ tags }));
  }

  /**
   * Invalidate all cache (distributed)
   */
  async invalidateAll(): Promise<void> {
    await this.incrementVersion();

    // Broadcast to other instances
    await this.redis
      .getClient()
      .publish('cache:invalidate', JSON.stringify({ global: true }));
  }

  /**
   * Pre-warm cache with common data
   */
  async warmCache<T>(
    entries: Array<{
      key: string;
      fetchFn: () => Promise<T>;
      options?: CacheOptions;
    }>,
  ): Promise<void> {
    this.logger.log(`Warming cache with ${entries.length} entries...`);

    const results = await Promise.allSettled(
      entries.map(async ({ key, fetchFn, options }) => {
        const fullKey = this.getFullKey(key);
        await this.fetchAndCache(key, fullKey, fetchFn, {
          ttl: options?.ttl || this.DEFAULT_TTL,
          staleWhileRevalidate:
            options?.staleWhileRevalidate || this.DEFAULT_STALE_WINDOW,
          tags: options?.tags || [],
        });
      }),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(
      `Cache warming complete: ${successful}/${entries.length} entries`,
    );
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & { hitRate: number } {
    const total =
      this.metrics.hits + this.metrics.misses + this.metrics.staleHits;
    const hitRate =
      total > 0 ? (this.metrics.hits + this.metrics.staleHits) / total : 0;

    return {
      ...this.metrics,
      hitRate,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      revalidations: 0,
      invalidations: 0,
      errors: 0,
      avgFetchTime: 0,
      totalFetchTime: 0,
    };
  }

  /**
   * Simple get (for backwards compatibility)
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = await this.getCacheEntry<T>(this.getFullKey(key));
    if (entry && entry.version === this.currentVersion) {
      const now = Date.now();
      const isExpired = now > entry.createdAt + entry.ttl * 1000;
      if (!isExpired) {
        return entry.data;
      }
    }
    return null;
  }

  /**
   * Simple set (for backwards compatibility)
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {},
  ): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttl = options.ttl || this.DEFAULT_TTL;
    const staleWhileRevalidate =
      options.staleWhileRevalidate || this.DEFAULT_STALE_WINDOW;

    const entry: CacheEntry<T> = {
      data,
      createdAt: Date.now(),
      ttl,
      staleUntil: Date.now() + (ttl + staleWhileRevalidate) * 1000,
      tags: options.tags || [],
      version: this.currentVersion,
    };

    await this.redis.set(
      fullKey,
      JSON.stringify(entry),
      ttl + staleWhileRevalidate,
    );
  }

  /**
   * Delete specific key
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(this.getFullKey(key));
    this.metrics.invalidations++;
  }
}
