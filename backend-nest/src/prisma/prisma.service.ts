import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Enhanced Prisma Service with:
 * - Query logging and performance monitoring
 * - Soft delete middleware
 * - Connection pooling configuration
 * - Transaction helpers
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private queryCount = 0;
  private slowQueryThreshold = 1000; // 1 second

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Setup query logging in development
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.LOG_QUERIES === 'true'
    ) {
      this.setupQueryLogging();
    }

    // Setup soft delete middleware
    this.setupSoftDeleteMiddleware();
  }

  /**
   * Setup query logging for development and debugging
   */
  private setupQueryLogging(): void {
    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      this.queryCount++;
      const duration = event.duration;

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        this.logger.warn({
          message: 'Slow query detected',
          query: event.query.substring(0, 500), // Truncate long queries
          params: event.params,
          duration: `${duration}ms`,
          queryNumber: this.queryCount,
        });
      } else if (process.env.LOG_ALL_QUERIES === 'true') {
        this.logger.debug({
          message: 'Query executed',
          query: event.query.substring(0, 200),
          duration: `${duration}ms`,
          queryNumber: this.queryCount,
        });
      }
    });
  }

  /**
   * Setup soft delete middleware for applicable models
   * Models with deletedAt field will be soft deleted
   */
  private setupSoftDeleteMiddleware(): void {
    // Soft delete models list
    // const softDeleteModels = [
    //   'Portal',
    //   'Widget',
    //   'Integration',
    //   'Alert',
    //   'ScheduledReport',
    //   'ShareLink',
    //   'Comment',
    //   'Webhook',
    // ];
    // Middleware for find operations - exclude soft deleted records
    // this.$use(async (params, next) => {
    //   if (softDeleteModels.includes(params.model || '')) {
    //     // For find operations, exclude deleted records by default
    //     if (params.action === 'findUnique' || params.action === 'findFirst') {
    //       params.action = 'findFirst';
    //       params.args.where = {
    //         ...params.args.where,
    //         deletedAt: null,
    //       };
    //     }
    //     if (params.action === 'findMany') {
    //       if (!params.args) params.args = {};
    //       if (!params.args.where) params.args.where = {};
    //       // Allow explicit query for deleted records
    //       if (params.args.where.deletedAt === undefined) {
    //         params.args.where.deletedAt = null;
    //       }
    //     }
    //     // Convert delete to soft delete
    //     if (params.action === 'delete') {
    //       params.action = 'update';
    //       params.args.data = { deletedAt: new Date() };
    //     }
    //     if (params.action === 'deleteMany') {
    //       params.action = 'updateMany';
    //       if (!params.args) params.args = {};
    //       params.args.data = { deletedAt: new Date() };
    //     }
    //   }
    //   return next(params);
    // });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');

    // Log connection pool info
    this.logger.log({
      message: 'Database connection established',
      poolSize: process.env.DATABASE_POOL_SIZE || 'default',
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }

  /**
   * Execute a transaction with automatic retry on deadlock
   */
  async executeWithRetry<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.$transaction(fn, {
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        lastError = error as Error;

        // Check if it's a deadlock or serialization failure
        const isRetryable =
          lastError.message.includes('deadlock') ||
          lastError.message.includes('could not serialize') ||
          lastError.message.includes('P2034');

        if (isRetryable && attempt < maxRetries) {
          this.logger.warn({
            message: 'Transaction failed, retrying',
            attempt,
            error: lastError.message,
          });

          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /**
   * Batch operations helper
   */
  async batchOperation<T, R>(
    items: T[],
    operation: (item: T, tx: Prisma.TransactionClient) => Promise<R>,
    batchSize = 100,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchResults = await this.$transaction(async (tx) => {
        return Promise.all(batch.map((item) => operation(item, tx)));
      });

      results.push(...(batchResults as R[]));
    }

    return results;
  }

  /**
   * Get query statistics
   */
  getQueryStats(): { queryCount: number; slowQueryThreshold: number } {
    return {
      queryCount: this.queryCount,
      slowQueryThreshold: this.slowQueryThreshold,
    };
  }

  /**
   * Reset query count (for testing)
   */
  resetQueryCount(): void {
    this.queryCount = 0;
  }

  /**
   * Hard delete - permanently remove soft-deleted records
   * Use with caution!
   */
  async hardDelete(
    model: string,
    where: Record<string, unknown>,
  ): Promise<number> {
    const modelKey = model.toLowerCase() as keyof PrismaClient;
    const prismaModel = this[modelKey] as any;

    if (!prismaModel || typeof prismaModel.deleteMany !== 'function') {
      throw new Error(`Model ${model} not found`);
    }

    // Ensure we're only deleting already soft-deleted records
    const result = await prismaModel.deleteMany({
      where: {
        ...where,
        deletedAt: { not: null },
      },
    });

    this.logger.log({
      message: 'Hard delete executed',
      model,
      count: result.count,
    });

    return result.count;
  }

  /**
   * Restore soft-deleted record
   */
  async restore(
    model: string,
    where: Record<string, unknown>,
  ): Promise<number> {
    const modelKey = model.toLowerCase() as keyof PrismaClient;
    const prismaModel = this[modelKey] as any;

    if (!prismaModel || typeof prismaModel.updateMany !== 'function') {
      throw new Error(`Model ${model} not found`);
    }

    const result = await prismaModel.updateMany({
      where: {
        ...where,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
      },
    });

    this.logger.log({
      message: 'Records restored',
      model,
      count: result.count,
    });

    return result.count;
  }

  /**
   * Clean all data from database (useful for testing)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('This method is only allowed in test environment');
    }

    const modelKeys = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );

    for (const modelKey of modelKeys) {
      const model = this[modelKey as keyof this];

      if (model && typeof (model as any).deleteMany === 'function') {
        await (model as any).deleteMany();
      }
    }
  }
}
