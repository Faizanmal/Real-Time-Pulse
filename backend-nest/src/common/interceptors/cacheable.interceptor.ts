import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../../cache/cache.service';
import {
  CACHE_METADATA_KEY,
  CacheConfig,
  INVALIDATE_CACHE_KEY,
} from '../decorators/cache.decorator';
import * as crypto from 'crypto';

@Injectable()
export class CacheableInterceptor implements NestInterceptor {
  private readonly logger = new Logger('CacheInterceptor');

  constructor(
    private reflector: Reflector,
    private cacheService: CacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const cacheConfig = this.reflector.get<CacheConfig>(
      CACHE_METADATA_KEY,
      context.getHandler(),
    );

    const invalidateKeys = this.reflector.get<string[]>(
      INVALIDATE_CACHE_KEY,
      context.getHandler(),
    );

    // Handle cache invalidation
    if (invalidateKeys && invalidateKeys.length > 0) {
      return next.handle().pipe(
        tap(() => {
          void this.invalidateCaches(invalidateKeys, context);
        }),
      );
    }

    // No cache config, pass through
    if (!cacheConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(context, request, cacheConfig);

    // Try to get from cache
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return of(JSON.parse(cached));
      }
    } catch (error) {
      this.logger.warn(`Cache read error: ${error}`);
    }

    // Cache miss - execute and store
    this.logger.debug(`Cache miss: ${cacheKey}`);

    return next.handle().pipe(
      tap((result) => {
        void (async () => {
          try {
            await this.cacheService.set(
              cacheKey,
              JSON.stringify(result),
              cacheConfig.ttlSeconds,
            );
            this.logger.debug(
              `Cached: ${cacheKey} for ${cacheConfig.ttlSeconds}s`,
            );
          } catch (error) {
            this.logger.warn(`Cache write error: ${error}`);
          }
        })();
      }),
    );
  }

  private generateCacheKey(
    context: ExecutionContext,
    request: Record<string, unknown>,
    config: CacheConfig,
  ): string {
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const prefix = config.keyPrefix || `${controller}:${handler}`;

    let scopeKey = '';
    const user = request.user as
      | { id?: string; workspaceId?: string }
      | undefined;

    switch (config.scope) {
      case 'user':
        scopeKey = user?.id || 'anonymous';
        break;
      case 'workspace':
        scopeKey = user?.workspaceId || 'default';
        break;
      case 'global':
      default:
        scopeKey = 'global';
    }

    // Generate a hash of the request parameters
    const params = {
      query: request.query,
      params: request.params,
      body: request.body,
    };
    const paramsHash = this.hashObject(params);

    return `cache:${prefix}:${scopeKey}:${paramsHash}`;
  }

  private hashObject(obj: unknown): string {
    const str = JSON.stringify(obj, Object.keys(obj as object).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  private async invalidateCaches(
    patterns: string[],
    context: ExecutionContext,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { id?: string; workspaceId?: string }
      | undefined;

    for (const pattern of patterns) {
      // Replace placeholders in pattern
      const resolvedPattern = pattern
        .replace(':userId', user?.id || '*')
        .replace(':workspaceId', user?.workspaceId || '*');

      try {
        await this.cacheService.del(`cache:${resolvedPattern}`);
        this.logger.debug(`Invalidated cache pattern: ${resolvedPattern}`);
      } catch (error) {
        this.logger.warn(`Cache invalidation error: ${error}`);
      }
    }
  }
}
