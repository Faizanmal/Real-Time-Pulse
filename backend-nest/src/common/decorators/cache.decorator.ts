import { SetMetadata, applyDecorators } from '@nestjs/common';

export const CACHE_METADATA_KEY = 'cache_config';

export interface CacheConfig {
  ttlSeconds: number;
  keyPrefix?: string;
  keyGenerator?: string; // Name of method that generates cache key
  invalidateOn?: string[]; // Events that should invalidate this cache
  scope?: 'user' | 'workspace' | 'global';
}

/**
 * Decorator to cache method results
 * 
 * @param ttlSeconds - Time to live in seconds
 * @param options - Additional cache configuration
 * 
 * @example
 * ```typescript
 * @Cacheable(300, { scope: 'workspace', keyPrefix: 'dashboard' })
 * async getDashboardData(workspaceId: string) {
 *   // This result will be cached for 5 minutes per workspace
 * }
 * ```
 */
export function Cacheable(
  ttlSeconds: number,
  options?: Omit<CacheConfig, 'ttlSeconds'>,
): MethodDecorator {
  const config: CacheConfig = {
    ttlSeconds,
    scope: 'global',
    ...options,
  };

  return applyDecorators(SetMetadata(CACHE_METADATA_KEY, config));
}

/**
 * Decorator to mark a method as cache-invalidating
 * When this method is called, specified cache keys will be invalidated
 * 
 * @param keys - Cache key patterns to invalidate
 * 
 * @example
 * ```typescript
 * @InvalidateCache(['workspace:*:dashboard', 'user:*:preferences'])
 * async updateSettings(workspaceId: string, settings: any) {
 *   // After this method completes, matching caches will be invalidated
 * }
 * ```
 */
export const INVALIDATE_CACHE_KEY = 'invalidate_cache';

export function InvalidateCache(keys: string[]): MethodDecorator {
  return SetMetadata(INVALIDATE_CACHE_KEY, keys);
}

/**
 * Decorator for cache-aside pattern
 * Tries to get from cache first, if miss, executes method and caches result
 */
export const CACHE_ASIDE_KEY = 'cache_aside';

export interface CacheAsideConfig {
  ttlSeconds: number;
  keyGenerator: (args: unknown[]) => string;
  condition?: (result: unknown) => boolean; // Only cache if condition is true
}

export function CacheAside(config: CacheAsideConfig): MethodDecorator {
  return SetMetadata(CACHE_ASIDE_KEY, config);
}
