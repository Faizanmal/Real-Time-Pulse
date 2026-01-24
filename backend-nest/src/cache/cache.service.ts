import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  private readonly DEFAULT_TTL = 3600; // 1 hour in seconds
  private readonly CACHE_PREFIX = 'portal:';

  constructor(private readonly redis: RedisService) {}

  /**
   * Generate cache key for workspace data
   */
  private getWorkspaceKey(workspaceId: string): string {
    return `${this.CACHE_PREFIX}workspace:${workspaceId}`;
  }

  /**
   * Generate cache key for portal data
   */
  private getPortalKey(portalId: string): string {
    return `${this.CACHE_PREFIX}portal:${portalId}`;
  }

  /**
   * Generate cache key for widget data
   */
  private getWidgetDataKey(widgetId: string): string {
    return `${this.CACHE_PREFIX}widget:${widgetId}:data`;
  }

  /**
   * Generate cache key for integration data
   */
  private getIntegrationDataKey(integrationId: string, endpoint: string): string {
    return `${this.CACHE_PREFIX}integration:${integrationId}:${endpoint}`;
  }

  /**
   * Cache workspace data
   */
  async cacheWorkspace(workspaceId: string, data: any, ttl?: number): Promise<void> {
    const key = this.getWorkspaceKey(workspaceId);
    await this.redis.setJSON(key, data, ttl || this.DEFAULT_TTL);
  }

  /**
   * Get cached workspace data
   */
  async getWorkspace<T>(workspaceId: string): Promise<T | null> {
    const key = this.getWorkspaceKey(workspaceId);
    return this.redis.getJSON<T>(key);
  }

  /**
   * Cache portal data
   */
  async cachePortal(portalId: string, data: any, ttl?: number): Promise<void> {
    const key = this.getPortalKey(portalId);
    await this.redis.setJSON(key, data, ttl || this.DEFAULT_TTL);
  }

  /**
   * Get cached portal data
   */
  async getPortal<T>(portalId: string): Promise<T | null> {
    const key = this.getPortalKey(portalId);
    return this.redis.getJSON<T>(key);
  }

  /**
   * Cache widget data
   */
  async cacheWidgetData(widgetId: string, data: any, ttl?: number): Promise<void> {
    const key = this.getWidgetDataKey(widgetId);
    await this.redis.setJSON(key, data, ttl || this.DEFAULT_TTL);
  }

  /**
   * Get cached widget data
   */
  async getWidgetData<T>(widgetId: string): Promise<T | null> {
    const key = this.getWidgetDataKey(widgetId);
    return this.redis.getJSON<T>(key);
  }

  /**
   * Cache integration API response
   */
  async cacheIntegrationData(
    integrationId: string,
    endpoint: string,
    data: any,
    ttl?: number,
  ): Promise<void> {
    const key = this.getIntegrationDataKey(integrationId, endpoint);
    await this.redis.setJSON(key, data, ttl || this.DEFAULT_TTL);
  }

  /**
   * Get cached integration data
   */
  async getIntegrationData<T>(integrationId: string, endpoint: string): Promise<T | null> {
    const key = this.getIntegrationDataKey(integrationId, endpoint);
    return this.redis.getJSON<T>(key);
  }

  /**
   * Invalidate workspace cache
   */
  async invalidateWorkspace(workspaceId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}workspace:${workspaceId}*`;
    await this.redis.invalidatePattern(pattern);
  }

  /**
   * Invalidate portal cache
   */
  async invalidatePortal(portalId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}portal:${portalId}*`;
    await this.redis.invalidatePattern(pattern);
  }

  /**
   * Invalidate widget cache
   */
  async invalidateWidget(widgetId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}widget:${widgetId}*`;
    await this.redis.invalidatePattern(pattern);
  }

  /**
   * Invalidate all integration caches
   */
  async invalidateIntegration(integrationId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}integration:${integrationId}*`;
    await this.redis.invalidatePattern(pattern);
  }

  /**
   * Clear all portal caches
   */
  async clearAll(): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}*`;
    await this.redis.invalidatePattern(pattern);
  }

  /**
   * Generic get method for any cache key
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Generic set method for any cache key
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.redis.set(key, value, ttl);
  }

  /**
   * Generic delete method for cache keys (supports patterns with wildcards)
   */
  async del(pattern: string): Promise<void> {
    // If pattern contains wildcards, treat as pattern, otherwise treat as exact key
    if (pattern.includes('*')) {
      await this.redis.invalidatePattern(pattern);
    } else {
      await this.redis.del(pattern);
    }
  }
}
