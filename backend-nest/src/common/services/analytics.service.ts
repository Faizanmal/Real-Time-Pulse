import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

export interface AnalyticsEvent {
  workspaceId: string;
  portalId?: string;
  widgetId?: string;
  userId?: string;
  sessionId: string;
  eventType: string;
  eventData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  timestamp: Date;
}

export interface AnalyticsQuery {
  workspaceId: string;
  portalId?: string;
  widgetId?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Track an analytics event
   */
  async track(event: AnalyticsEvent): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          workspaceId: event.workspaceId,
          portalId: event.portalId,
          widgetId: event.widgetId,
          userId: event.userId,
          sessionId: event.sessionId,
          eventType: event.eventType,
          eventData: event.eventData || {},
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          referrer: event.referrer,
          timestamp: event.timestamp,
        },
      });

      // Invalidate related caches
      await this.invalidateCaches(event);
    } catch (error) {
      // Don't throw - analytics shouldn't break the main flow
      this.logger.error('Failed to track analytics event', error);
    }
  }

  /**
   * Get portal views over time
   */
  async getPortalViews(query: AnalyticsQuery): Promise<Array<{ date: string; count: number }>> {
    const cacheKey = `analytics:portal_views:${JSON.stringify(query)}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Array<{ date: string; count: number }>;
    }

    const where: Record<string, unknown> = {
      workspaceId: query.workspaceId,
      eventType: 'portal_view',
    };

    if (query.portalId) where.portalId = query.portalId;
    if (query.startDate) {
      where.timestamp = {
        ...((where.timestamp as Record<string, unknown>) || {}),
        gte: query.startDate,
      };
    }
    if (query.endDate) {
      where.timestamp = {
        ...((where.timestamp as Record<string, unknown>) || {}),
        lte: query.endDate,
      };
    }

    const events = await this.prisma.analyticsEvent.findMany({
      where: where as any,
      select: {
        timestamp: true,
        portalId: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    const result = this.aggregateByTime(events as any, query.groupBy || 'day');
    await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);

    return result;
  }

  /**
   * Get widget interactions
   */
  async getWidgetInteractions(
    query: AnalyticsQuery,
  ): Promise<Array<{ widgetId: string | null; eventType: string; count: number }>> {
    const cacheKey = `analytics:widget_interactions:${JSON.stringify(query)}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Array<{
        widgetId: string | null;
        eventType: string;
        count: number;
      }>;
    }

    const where: Record<string, unknown> = {
      workspaceId: query.workspaceId,
      eventType: { in: ['widget_view', 'widget_click', 'widget_interact'] },
    };

    if (query.widgetId) where.widgetId = query.widgetId;
    if (query.portalId) where.portalId = query.portalId;
    if (query.startDate) {
      where.timestamp = {
        ...((where.timestamp as Record<string, unknown>) || {}),
        gte: query.startDate,
      };
    }
    if (query.endDate) {
      where.timestamp = {
        ...((where.timestamp as Record<string, unknown>) || {}),
        lte: query.endDate,
      };
    }

    const events = await this.prisma.analyticsEvent.groupBy({
      by: ['widgetId', 'eventType'],
      where: where as any,
      _count: true,
    });

    const result = events.map((e) => ({
      widgetId: e.widgetId,
      eventType: e.eventType,
      count: e._count,
    }));

    await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
    return result;
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    uniqueSessions: number;
    avgSessionDuration: number;
  }> {
    const cacheKey = `analytics:user_engagement:${workspaceId}:${String(startDate)}:${String(endDate)}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as {
        totalEvents: number;
        uniqueUsers: number;
        uniqueSessions: number;
        avgSessionDuration: number;
      };
    }

    const where: any = { workspaceId };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [totalEvents, uniqueUsers, uniqueSessions, avgSessionDuration] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),

      this.prisma.analyticsEvent.findMany({
        where,
        distinct: ['userId'],
        select: { userId: true },
      }),

      this.prisma.analyticsEvent.findMany({
        where,
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      this.calculateAvgSessionDuration(workspaceId, startDate, endDate),
    ]);

    const result = {
      totalEvents,
      uniqueUsers: uniqueUsers.filter((u) => u.userId).length,
      uniqueSessions: uniqueSessions.length,
      avgSessionDuration,
    };

    await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
    return result;
  }

  /**
   * Get top performing portals
   */
  async getTopPortals(
    workspaceId: string,
    limit = 10,
  ): Promise<
    Array<{
      id: string | null;
      name: string | null;
      slug: string | null;
      views: number;
    } | null>
  > {
    const cacheKey = `analytics:top_portals:${workspaceId}:${limit}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Array<{
        id: string | null;
        name: string | null;
        slug: string | null;
        views: number;
      } | null>;
    }

    const portals = await (this.prisma.analyticsEvent.groupBy as any)({
      by: ['portalId'],
      where: {
        workspaceId,
        portalId: { not: null },
        eventType: 'portal_view',
      },
      _count: true,
      orderBy: {
        _count: {
          portalId: 'desc',
        },
      },
      take: limit,
    });

    const result = await Promise.all(
      portals.map(async (p: any) => {
        const portal = await this.prisma.portal.findUnique({
          where: { id: p.portalId! },
          select: { id: true, name: true, slug: true },
        });
        return {
          ...portal,

          views: p._count,
        };
      }),
    );

    await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
    return result;
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(query: AnalyticsQuery) {
    const where: any = {
      workspaceId: query.workspaceId,
    };

    if (query.portalId) where.portalId = query.portalId;
    if (query.widgetId) where.widgetId = query.widgetId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.startDate) {
      where.timestamp = {
        ...((where.timestamp as Record<string, unknown>) || {}),
        gte: query.startDate,
      };
    }
    if (query.endDate) {
      where.timestamp = {
        ...((where.timestamp as Record<string, unknown>) || {}),
        lte: query.endDate,
      };
    }

    return this.prisma.analyticsEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000, // Limit to prevent massive exports
    });
  }

  private async calculateAvgSessionDuration(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    // This is a simplified calculation - in production you'd want more sophisticated session tracking

    const where: any = { workspaceId };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const sessions = await (this.prisma.analyticsEvent.groupBy as any)({
      by: ['sessionId'],
      where,
      _min: { timestamp: true },
      _max: { timestamp: true },
    });

    if (sessions.length === 0) return 0;

    const totalDuration = sessions.reduce((sum: number, session: any) => {
      const duration =
        (session._max.timestamp as Date).getTime() - (session._min.timestamp as Date).getTime();
      return sum + duration;
    }, 0);

    return Math.round(totalDuration / sessions.length / 1000); // Return in seconds
  }

  private aggregateByTime(
    events: any[],
    groupBy: 'hour' | 'day' | 'week' | 'month',
  ): Array<{ date: string; count: number }> {
    const grouped = new Map<string, number>();

    events.forEach((event: any) => {
      const date = new Date(event.timestamp);
      let key: string;

      switch (groupBy) {
        case 'hour':
          key = date.toISOString().slice(0, 13);
          break;
        case 'day':
          key = date.toISOString().slice(0, 10);
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        }
        case 'month':
          key = date.toISOString().slice(0, 7);
          break;
      }

      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return Array.from(grouped.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  private async invalidateCaches(event: AnalyticsEvent) {
    const patterns = [
      `analytics:portal_views:*${event.workspaceId}*`,
      `analytics:widget_interactions:*${event.workspaceId}*`,
      `analytics:user_engagement:${event.workspaceId}*`,
      `analytics:top_portals:${event.workspaceId}*`,
    ];

    for (const pattern of patterns) {
      await this.cache.del(pattern);
    }
  }
}
