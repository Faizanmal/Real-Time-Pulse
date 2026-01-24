/**
 * Database Query Optimizer
 * Optimized queries, indexing recommendations, and query analysis
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface QueryAnalysis {
  query: string;
  executionTime: number;
  rowsAffected: number;
  indexUsed: boolean;
  recommendations: string[];
}

interface IndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: string;
}

interface TableStats {
  name: string;
  rowCount: number;
  sizeBytes: number;
  indexCount: number;
  lastAnalyzed: Date;
}

@Injectable()
export class DatabaseOptimizerService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseOptimizerService.name);
  private queryStats = new Map<string, { count: number; totalTime: number; avgTime: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureOptimalIndexes();
  }

  // ==================== INDEX MANAGEMENT ====================

  /**
   * Ensure optimal indexes exist for common query patterns
   */
  async ensureOptimalIndexes(): Promise<void> {
    const indexDefinitions = [
      // Widget queries by portal
      { table: 'Widget', columns: ['portalId', 'createdAt'], name: 'idx_widget_portal_created' },
      // User sessions
      { table: 'Session', columns: ['userId', 'expiresAt'], name: 'idx_session_user_expires' },
      // Audit logs
      {
        table: 'AuditLog',
        columns: ['userId', 'action', 'createdAt'],
        name: 'idx_audit_user_action_created',
      },
      // Notifications
      {
        table: 'Notification',
        columns: ['userId', 'read', 'createdAt'],
        name: 'idx_notification_user_read_created',
      },
      // Integration data
      {
        table: 'IntegrationData',
        columns: ['integrationId', 'fetchedAt'],
        name: 'idx_integration_data_fetched',
      },
      // Comments
      { table: 'Comment', columns: ['widgetId', 'createdAt'], name: 'idx_comment_widget_created' },
      // Share links
      { table: 'ShareLink', columns: ['portalId', 'expiresAt'], name: 'idx_share_portal_expires' },
    ];

    for (const idx of indexDefinitions) {
      try {
        await this.createIndexIfNotExists(idx.table, idx.columns, idx.name);
      } catch (error) {
        this.logger.warn(`Failed to create index ${idx.name}:`, error);
      }
    }
  }

  private async createIndexIfNotExists(
    table: string,
    columns: string[],
    name: string,
  ): Promise<void> {
    const columnList = columns.map((c) => `"${c}"`).join(', ');

    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" 
        ON "${table}" (${columnList})
      `);
      this.logger.log(`Ensured index ${name} on ${table}`);
    } catch (error) {
      // Index might already exist
      this.logger.debug(`Index ${name} check: ${error}`);
    }
  }

  // ==================== OPTIMIZED QUERIES ====================

  /**
   * Paginated query with cursor-based pagination
   * More efficient than OFFSET for large datasets
   */
  async paginatedQuery<T>(
    model: string,
    options: {
      cursor?: string;
      take?: number;
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      include?: Record<string, boolean | Record<string, unknown>>;
    },
  ): Promise<{ items: T[]; nextCursor: string | null; hasMore: boolean }> {
    const take = options.take || 20;
    const cursorObj = options.cursor ? { id: options.cursor } : undefined;

    const items = (await (this.prisma as Record<string, any>)[model].findMany({
      take: take + 1,
      skip: cursorObj ? 1 : 0,
      cursor: cursorObj,
      where: options.where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      include: options.include,
    })) as T[];

    const hasMore = items.length > take;
    if (hasMore) {
      items.pop();
    }

    const nextCursor = hasMore ? (items[items.length - 1] as { id: string }).id : null;

    return { items, nextCursor, hasMore };
  }

  /**
   * Batch upsert for bulk operations
   */
  async batchUpsert<T extends Record<string, unknown>>(
    model: string,
    data: T[],
    uniqueKey: string | string[],
    batchSize = 100,
  ): Promise<number> {
    let processed = 0;
    const batches = this.chunkArray(data, batchSize);

    for (const batch of batches) {
      await Promise.all(
        batch.map((item: Record<string, unknown>) => {
          const where = Array.isArray(uniqueKey)
            ? Object.fromEntries(uniqueKey.map((k) => [k, item[k]]))
            : { [uniqueKey]: item[uniqueKey] };

          return (this.prisma as Record<string, any>)[model].upsert({
            where,
            update: item,
            create: item,
          });
        }),
      );
      processed += batch.length;
    }

    return processed;
  }

  /**
   * Efficient count with optional cache
   */
  async countWithCache(
    model: string,
    where: Record<string, unknown>,
    _cacheKey?: string,
  ): Promise<number> {
    // Direct count for now - can add cache integration
    return (this.prisma as Record<string, any>)[model].count({ where });
  }

  /**
   * Aggregation query with multiple metrics
   */
  async aggregate(
    model: string,
    options: {
      where?: Record<string, unknown>;
      _count?: boolean | Record<string, boolean>;
      _avg?: Record<string, boolean>;
      _sum?: Record<string, boolean>;
      _min?: Record<string, boolean>;
      _max?: Record<string, boolean>;
      groupBy?: string[];
    },
  ): Promise<unknown> {
    if (options.groupBy) {
      return (this.prisma as Record<string, any>)[model].groupBy({
        by: options.groupBy,
        where: options.where,
        _count: options._count,
        _avg: options._avg,
        _sum: options._sum,
        _min: options._min,
        _max: options._max,
      });
    }

    return (this.prisma as Record<string, any>)[model].aggregate({
      where: options.where,
      _count: options._count,
      _avg: options._avg,
      _sum: options._sum,
      _min: options._min,
      _max: options._max,
    });
  }

  // ==================== QUERY ANALYSIS ====================

  /**
   * Analyze a query for performance issues
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const startTime = Date.now();

    try {
      const explainResult = await this.prisma.$queryRawUnsafe<unknown[]>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
      );

      const executionTime = Date.now() - startTime;
      const plan = (explainResult[0] as Record<string, unknown>)?.['QUERY PLAN'] as Record<
        string,
        unknown
      >[];

      const recommendations: string[] = [];
      let indexUsed = false;
      let rowsAffected = 0;

      if (plan && plan.length > 0) {
        const planDetails = plan[0];
        rowsAffected =
          ((planDetails['Plan'] as Record<string, unknown>)?.['Actual Rows'] as number) || 0;

        // Check for sequential scans on large tables
        const nodeType = (planDetails['Plan'] as Record<string, unknown>)?.['Node Type'] as string;
        if (nodeType === 'Seq Scan') {
          recommendations.push('Consider adding an index to avoid sequential scan');
        } else if (nodeType?.includes('Index')) {
          indexUsed = true;
        }

        // Check for slow execution
        if (executionTime > 1000) {
          recommendations.push('Query execution time exceeds 1 second');
        }

        // Check for large result sets
        if (rowsAffected > 10000) {
          recommendations.push('Consider pagination for large result sets');
        }
      }

      return {
        query,
        executionTime,
        rowsAffected,
        indexUsed,
        recommendations,
      };
    } catch (error) {
      return {
        query,
        executionTime: Date.now() - startTime,
        rowsAffected: 0,
        indexUsed: false,
        recommendations: [`Error analyzing query: ${error}`],
      };
    }
  }

  /**
   * Get index recommendations based on query patterns
   */
  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Analyze slow queries from stats
    const slowQueries = Array.from(this.queryStats.entries())
      .filter(([, stats]) => stats.avgTime > 100)
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 10);

    for (const [query, stats] of slowQueries) {
      // Basic pattern matching for common query types
      const tableMatch = query.match(/FROM\s+"?(\w+)"?/i);
      const whereMatch = query.match(/WHERE\s+(\w+)\s*=/gi);

      if (tableMatch && whereMatch) {
        const table = tableMatch[1];
        const columns = whereMatch
          .map((w) => {
            const match = w.match(/WHERE\s+(\w+)\s*=/i);
            return match ? match[1] : '';
          })
          .filter(Boolean);

        if (columns.length > 0) {
          recommendations.push({
            table,
            columns,
            reason: `Query averaging ${stats.avgTime.toFixed(0)}ms with ${stats.count} executions`,
            estimatedImprovement: '50-80% faster',
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<TableStats[]> {
    const result = await this.prisma.$queryRaw<
      Array<{
        relname: string;
        n_live_tup: bigint;
        pg_total_relation_size: bigint;
        idx_count: bigint;
        last_analyze: Date;
      }>
    >`
      SELECT 
        c.relname,
        s.n_live_tup,
        pg_total_relation_size(c.oid) as pg_total_relation_size,
        (SELECT count(*) FROM pg_indexes WHERE tablename = c.relname) as idx_count,
        s.last_analyze
      FROM pg_class c
      JOIN pg_stat_user_tables s ON c.relname = s.relname
      WHERE c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 20
    `;

    return result.map((row) => ({
      name: row.relname,
      rowCount: Number(row.n_live_tup),
      sizeBytes: Number(row.pg_total_relation_size),
      indexCount: Number(row.idx_count),
      lastAnalyzed: row.last_analyze,
    }));
  }

  // ==================== MAINTENANCE ====================

  /**
   * Run VACUUM ANALYZE on tables
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runMaintenance(): Promise<void> {
    this.logger.log('Running database maintenance...');

    try {
      // Get tables that need analysis
      const tables = await this.getTableStats();

      for (const table of tables) {
        // Analyze tables that haven't been analyzed recently
        const hoursSinceAnalyze = table.lastAnalyzed
          ? (Date.now() - table.lastAnalyzed.getTime()) / (1000 * 60 * 60)
          : Infinity;

        if (hoursSinceAnalyze > 24) {
          try {
            await this.prisma.$executeRawUnsafe(`ANALYZE "${table.name}"`);
            this.logger.log(`Analyzed table ${table.name}`);
          } catch (error) {
            this.logger.warn(`Failed to analyze ${table.name}:`, error);
          }
        }
      }

      this.logger.log('Database maintenance completed');
    } catch (error) {
      this.logger.error('Database maintenance failed:', error);
    }
  }

  /**
   * Clean up old data
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldData(): Promise<void> {
    this.logger.log('Cleaning up old data...');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    try {
      // Delete expired sessions
      const deletedSessions = await this.prisma.userSession.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      this.logger.log(`Deleted ${deletedSessions.count} expired sessions`);

      // Delete old notifications (read ones older than 30 days)
      const deletedNotifications = await this.prisma.notification.deleteMany({
        where: {
          AND: [{ read: true }, { createdAt: { lt: thirtyDaysAgo } }],
        },
      });
      this.logger.log(`Deleted ${deletedNotifications.count} old notifications`);

      // Archive old audit logs (older than 90 days)
      // Note: In production, you'd move these to cold storage instead
      const oldAuditLogs = await this.prisma.auditLog.count({
        where: { createdAt: { lt: ninetyDaysAgo } },
      });
      this.logger.log(`Found ${oldAuditLogs} audit logs older than 90 days for archival`);

      // Delete expired share links
      const deletedShareLinks = await this.prisma.shareLink.deleteMany({
        where: {
          AND: [{ expiresAt: { not: null } }, { expiresAt: { lt: now } }],
        },
      });
      this.logger.log(`Deleted ${deletedShareLinks.count} expired share links`);

      this.logger.log('Old data cleanup completed');
    } catch (error) {
      this.logger.error('Data cleanup failed:', error);
    }
  }

  // ==================== QUERY MONITORING ====================

  /**
   * Record query execution for analysis
   */
  recordQueryExecution(queryHash: string, executionTime: number): void {
    const existing = this.queryStats.get(queryHash);

    if (existing) {
      const newCount = existing.count + 1;
      const newTotalTime = existing.totalTime + executionTime;
      this.queryStats.set(queryHash, {
        count: newCount,
        totalTime: newTotalTime,
        avgTime: newTotalTime / newCount,
      });
    } else {
      this.queryStats.set(queryHash, {
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime,
      });
    }

    // Keep only top 1000 queries
    if (this.queryStats.size > 1000) {
      const sorted = Array.from(this.queryStats.entries()).sort((a, b) => b[1].count - a[1].count);
      this.queryStats = new Map(sorted.slice(0, 1000));
    }
  }

  /**
   * Get slow query report
   */
  getSlowQueryReport(): Array<{
    queryHash: string;
    count: number;
    avgTime: number;
    totalTime: number;
  }> {
    return Array.from(this.queryStats.entries())
      .filter(([, stats]) => stats.avgTime > 100)
      .sort((a, b) => b[1].totalTime - a[1].totalTime)
      .slice(0, 50)
      .map(([queryHash, stats]) => ({
        queryHash,
        count: stats.count,
        avgTime: stats.avgTime,
        totalTime: stats.totalTime,
      }));
  }

  // ==================== HELPERS ====================

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
