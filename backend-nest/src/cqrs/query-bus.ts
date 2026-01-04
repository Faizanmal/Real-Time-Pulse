/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX QUERY BUS
 * ============================================================================
 * Query bus implementation with caching, pagination, and read model optimization.
 */

import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

// Base Query Interface
export interface IQuery {
  readonly queryType: string;
  readonly timestamp: Date;
  readonly metadata: {
    userId?: string;
    workspaceId?: string;
    correlationId?: string;
    cacheKey?: string;
    skipCache?: boolean;
  };
}

// Query Handler Interface
export interface IQueryHandler<T extends IQuery = IQuery, R = any> {
  execute(query: T): Promise<R>;
}

// Query Middleware Interface
export interface IQueryMiddleware {
  handle(query: IQuery, next: () => Promise<any>): Promise<any>;
}

// Paginated Query Interface
export interface IPaginatedQuery extends IQuery {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// Paginated Result Interface
export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Query Result
export interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
  timestamp: Date;
  executionTime?: number;
}

@Injectable()
export class QueryBus {
  private readonly logger = new Logger(QueryBus.name);
  private readonly handlers = new Map<string, Type<IQueryHandler>>();
  private readonly middlewares: IQueryMiddleware[] = [];
  private readonly cache = new Map<string, { data: any; expiresAt: number }>();

  constructor(private readonly moduleRef: ModuleRef) {}

  // Register a query handler
  register<T extends IQuery>(
    queryType: string,
    handler: Type<IQueryHandler<T>>,
  ): void {
    this.handlers.set(queryType, handler);
    this.logger.log(`Registered query handler for: ${queryType}`);
  }

  // Add middleware to the pipeline
  use(middleware: IQueryMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.log(`Added middleware: ${middleware.constructor.name}`);
  }

  // Execute a query
  async execute<T extends IQuery, R = any>(query: T): Promise<QueryResult<R>> {
    const startTime = Date.now();
    const correlationId =
      query.metadata?.correlationId || this.generateCorrelationId();

    this.logger.debug({
      message: `Executing query: ${query.queryType}`,
      correlationId,
    });

    try {
      // Check cache first
      if (!query.metadata?.skipCache && query.metadata?.cacheKey) {
        const cached = this.getFromCache(query.metadata.cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            fromCache: true,
            timestamp: new Date(),
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Build the middleware chain
      const executeHandler = async (): Promise<R> => {
        const handlerType = this.handlers.get(query.queryType);

        if (!handlerType) {
          throw new Error(`No handler found for query: ${query.queryType}`);
        }

        const handler =
          await this.moduleRef.resolve<IQueryHandler<T, R>>(handlerType);
        return handler.execute(query);
      };

      // Execute through middleware chain
      const result = await this.executeWithMiddleware(query, executeHandler);

      // Cache the result if cacheKey is provided
      if (query.metadata?.cacheKey) {
        this.setCache(query.metadata.cacheKey, result);
      }

      return {
        success: true,
        data: result,
        fromCache: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error({
        message: `Query execution failed: ${query.queryType}`,
        correlationId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
      };
    }
  }

  // Execute query through middleware chain
  private async executeWithMiddleware<R>(
    query: IQuery,
    finalHandler: () => Promise<R>,
  ): Promise<R> {
    if (this.middlewares.length === 0) {
      return finalHandler();
    }

    let index = 0;
    const next = async (): Promise<any> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware.handle(query, next);
      }
      return finalHandler();
    };

    return next();
  }

  // Cache management
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private generateCorrelationId(): string {
    return `qry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Built-in Query Middlewares

// Performance Tracking Middleware
export class PerformanceMiddleware implements IQueryMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private readonly slowQueryThreshold: number;

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }

  async handle(query: IQuery, next: () => Promise<any>): Promise<any> {
    const start = Date.now();
    const result = await next();
    const duration = Date.now() - start;

    if (duration > this.slowQueryThreshold) {
      this.logger.warn(
        `Slow query detected: ${query.queryType} took ${duration}ms`,
      );
    }

    return result;
  }
}

// Pagination Helper Middleware
export class PaginationMiddleware implements IQueryMiddleware {
  async handle(query: IQuery, next: () => Promise<any>): Promise<any> {
    const paginatedQuery = query as IPaginatedQuery;

    // Set defaults if not provided
    if (paginatedQuery.page === undefined) {
      paginatedQuery.page = 1;
    }
    if (paginatedQuery.pageSize === undefined) {
      paginatedQuery.pageSize = 20;
    }
    if (paginatedQuery.pageSize > 100) {
      paginatedQuery.pageSize = 100; // Max page size
    }

    return next();
  }
}

// Authorization Middleware
export class AuthorizationMiddleware implements IQueryMiddleware {
  private readonly logger = new Logger(AuthorizationMiddleware.name);

  async handle(query: IQuery, next: () => Promise<any>): Promise<any> {
    // Check if user has permission to execute this query
    const { userId, workspaceId } = query.metadata;

    if (!userId) {
      this.logger.warn(`Unauthorized query attempt: ${query.queryType}`);
      throw new Error('Unauthorized: User ID required');
    }

    // Add additional authorization logic here
    return next();
  }
}

// Data Transformation Middleware
export class TransformMiddleware implements IQueryMiddleware {
  private readonly transformers: Map<string, (data: any) => any>;

  constructor(transformers?: Map<string, (data: any) => any>) {
    this.transformers = transformers || new Map();
  }

  registerTransformer(
    queryType: string,
    transformer: (data: any) => any,
  ): void {
    this.transformers.set(queryType, transformer);
  }

  async handle(query: IQuery, next: () => Promise<any>): Promise<any> {
    const result = await next();

    const transformer = this.transformers.get(query.queryType);
    if (transformer) {
      return transformer(result);
    }

    return result;
  }
}

// Field Selection Middleware (GraphQL-like field selection)
export class FieldSelectionMiddleware implements IQueryMiddleware {
  async handle(query: IQuery, next: () => Promise<any>): Promise<any> {
    const result = await next();

    const fields = (query as any).fields;
    if (!fields || fields.length === 0) {
      return result;
    }

    // Apply field selection
    if (Array.isArray(result)) {
      return result.map((item) => this.selectFields(item, fields));
    }

    return this.selectFields(result, fields);
  }

  private selectFields(obj: any, fields: string[]): any {
    const result: any = {};
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields
        const [parent, child] = field.split('.');
        if (obj[parent]) {
          result[parent] = result[parent] || {};
          result[parent][child] = obj[parent][child];
        }
      } else if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    }
    return result;
  }
}
