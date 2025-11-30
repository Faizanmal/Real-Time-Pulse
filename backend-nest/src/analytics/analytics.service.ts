import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsageMetricType, PeriodType } from '@prisma/client';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get workspace dashboard overview
   */
  async getDashboardOverview(workspaceId: string) {
    const [
      portals,
      widgets,
      integrations,
      activeAlerts,
      recentInsights,
      subscription,
    ] = await Promise.all([
      this.prisma.portal.count({ where: { workspaceId } }),
      this.prisma.widget.count({ where: { portal: { workspaceId } } }),
      this.prisma.integration.findMany({
        where: { workspaceId },
        select: { provider: true, status: true, lastSyncedAt: true },
      }),
      this.prisma.alert.count({ where: { workspaceId, isActive: true } }),
      this.prisma.aIInsight.count({
        where: { workspaceId, status: { not: 'DISMISSED' } },
      }),
      this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { plan: true, status: true, maxPortals: true, maxUsers: true },
      }),
    ]);

    const activeIntegrations = integrations.filter(
      (i) => i.status === 'ACTIVE',
    ).length;

    return {
      overview: {
        portals,
        widgets,
        integrations: {
          total: integrations.length,
          active: activeIntegrations,
        },
        activeAlerts,
        pendingInsights: recentInsights,
      },
      subscription: subscription || {
        plan: 'TRIAL',
        status: 'TRIALING',
        maxPortals: 5,
        maxUsers: 1,
      },
      integrationStatus: integrations,
    };
  }

  /**
   * Get portal analytics
   */
  async getPortalAnalytics(workspaceId: string, portalId: string) {
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: {
          select: {
            id: true,
            name: true,
            type: true,
            lastRefreshedAt: true,
            refreshInterval: true,
          },
        },
        _count: {
          select: {
            widgets: true,
            shareLinks: true,
            scheduledReports: true,
            aiInsights: true,
          },
        },
      },
    });

    if (!portal) {
      return null;
    }

    // Get view metrics
    const viewMetrics = await this.getMetrics(workspaceId, {
      metricType: 'PORTAL_VIEWS',
      portalId,
      periodType: 'DAILY',
      days: 30,
    });

    return {
      portal: {
        id: portal.id,
        name: portal.name,
        slug: portal.slug,
        isPublic: portal.isPublic,
        createdAt: portal.createdAt,
        lastCachedAt: portal.lastCachedAt,
      },
      stats: portal._count,
      widgets: portal.widgets,
      viewMetrics,
    };
  }

  /**
   * Get usage metrics
   */
  async getMetrics(
    workspaceId: string,
    options: {
      metricType?: UsageMetricType;
      portalId?: string;
      periodType?: PeriodType;
      days?: number;
    },
  ) {
    const { metricType, portalId, periodType = 'DAILY', days = 30 } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.prisma.usageMetric.findMany({
      where: {
        workspaceId,
        ...(metricType && { metricType }),
        ...(portalId && { portalId }),
        periodType,
        period: { gte: startDate },
      },
      orderBy: { period: 'asc' },
    });

    // Group by date for charting
    const grouped = metrics.reduce(
      (acc, metric) => {
        const dateKey = metric.period.toISOString().split('T')[0];
        if (!acc[dateKey]) {
          acc[dateKey] = {};
        }
        acc[dateKey][metric.metricType] =
          (acc[dateKey][metric.metricType] || 0) + metric.value;
        return acc;
      },
      {} as Record<string, Record<string, number>>,
    );

    return {
      raw: metrics,
      grouped,
      summary: this.calculateMetricSummary(metrics),
    };
  }

  /**
   * Record a usage metric
   */
  async recordMetric(
    workspaceId: string,
    metricType: UsageMetricType,
    value: number,
    options?: {
      portalId?: string;
      widgetId?: string;
      userId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    // Upsert hourly metric
    await this.prisma.usageMetric.upsert({
      where: {
        id: `${workspaceId}-${metricType}-${hourStart.toISOString()}`,
      },
      create: {
        workspaceId,
        metricType,
        value,
        period: hourStart,
        periodType: 'HOURLY',
        portalId: options?.portalId,
        widgetId: options?.widgetId,
        userId: options?.userId,
        metadata: options?.metadata,
      },
      update: {
        value: { increment: value },
      },
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(workspaceId: string) {
    // Widget refresh performance
    const widgets = await this.prisma.widget.findMany({
      where: { portal: { workspaceId } },
      select: {
        id: true,
        name: true,
        type: true,
        lastRefreshedAt: true,
        refreshInterval: true,
        integration: {
          select: { provider: true, status: true },
        },
      },
    });

    const now = new Date();
    const staleWidgets = widgets.filter((w) => {
      if (!w.lastRefreshedAt) return true;
      const hoursSinceRefresh =
        (now.getTime() - w.lastRefreshedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceRefresh > 24;
    });

    // Integration sync status
    const integrations = await this.prisma.integration.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        lastSyncError: true,
      },
    });

    const failedIntegrations = integrations.filter(
      (i) => i.status === 'ERROR' || i.lastSyncError,
    );

    // Report execution stats
    const recentReports = await this.prisma.reportRun.findMany({
      where: {
        report: { workspaceId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { status: true },
    });

    const reportStats = {
      total: recentReports.length,
      completed: recentReports.filter((r) => r.status === 'COMPLETED').length,
      failed: recentReports.filter((r) => r.status === 'FAILED').length,
    };

    return {
      widgets: {
        total: widgets.length,
        stale: staleWidgets.length,
        healthy: widgets.length - staleWidgets.length,
        staleWidgets: staleWidgets.slice(0, 10),
      },
      integrations: {
        total: integrations.length,
        active: integrations.filter((i) => i.status === 'ACTIVE').length,
        failed: failedIntegrations.length,
        failedIntegrations,
      },
      reports: reportStats,
    };
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(workspaceId: string, limit = 50) {
    const [auditLogs, notifications] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          userEmail: true,
          createdAt: true,
          success: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          createdAt: true,
          read: true,
        },
      }),
    ]);

    // Merge and sort by date
    const feed = [
      ...auditLogs.map((log) => ({
        ...log,
        type: 'audit' as const,
      })),
      ...notifications.map((notif) => ({
        ...notif,
        type: 'notification' as const,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return feed.slice(0, limit);
  }

  /**
   * Get trending data
   */
  async getTrendingData(workspaceId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Compare last 7 days to previous 7 days
    const [recentPortalViews, previousPortalViews] = await Promise.all([
      this.prisma.usageMetric.aggregate({
        where: {
          workspaceId,
          metricType: 'PORTAL_VIEWS',
          period: { gte: sevenDaysAgo },
        },
        _sum: { value: true },
      }),
      this.prisma.usageMetric.aggregate({
        where: {
          workspaceId,
          metricType: 'PORTAL_VIEWS',
          period: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
        },
        _sum: { value: true },
      }),
    ]);

    const recentViews = recentPortalViews._sum.value || 0;
    const previousViews = previousPortalViews._sum.value || 0;
    const viewsChange =
      previousViews > 0
        ? ((recentViews - previousViews) / previousViews) * 100
        : 0;

    // Most viewed portals
    const topPortals = await this.prisma.usageMetric.groupBy({
      by: ['portalId'],
      where: {
        workspaceId,
        metricType: 'PORTAL_VIEWS',
        portalId: { not: null },
        period: { gte: thirtyDaysAgo },
      },
      _sum: { value: true },
      orderBy: { _sum: { value: 'desc' } },
      take: 5,
    });

    // Get portal names for top portals
    const portalIds = topPortals
      .map((p) => p.portalId)
      .filter((id): id is string => id !== null);
    const portals = await this.prisma.portal.findMany({
      where: { id: { in: portalIds } },
      select: { id: true, name: true },
    });

    const portalMap = new Map(portals.map((p) => [p.id, p.name]));

    return {
      views: {
        current: recentViews,
        previous: previousViews,
        changePercent: viewsChange.toFixed(1),
        trend: viewsChange >= 0 ? 'up' : 'down',
      },
      topPortals: topPortals.map((p) => ({
        portalId: p.portalId,
        name: portalMap.get(p.portalId!) || 'Unknown',
        views: p._sum.value,
      })),
    };
  }

  /**
   * Aggregate daily metrics (scheduled job)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyMetrics() {
    this.logger.log('Starting daily metrics aggregation');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all hourly metrics from yesterday
    const hourlyMetrics = await this.prisma.usageMetric.findMany({
      where: {
        periodType: 'HOURLY',
        period: { gte: yesterday, lt: today },
      },
    });

    // Group by workspace, metric type, and portal
    const grouped = hourlyMetrics.reduce(
      (acc, metric) => {
        const key = `${metric.workspaceId}-${metric.metricType}-${metric.portalId || 'null'}`;
        if (!acc[key]) {
          acc[key] = {
            workspaceId: metric.workspaceId,
            metricType: metric.metricType,
            portalId: metric.portalId,
            value: 0,
          };
        }
        acc[key].value += metric.value;
        return acc;
      },
      {} as Record<string, any>,
    );

    // Create daily aggregates
    for (const data of Object.values(grouped)) {
      await this.prisma.usageMetric.create({
        data: {
          workspaceId: data.workspaceId,
          metricType: data.metricType,
          portalId: data.portalId,
          value: data.value,
          period: yesterday,
          periodType: 'DAILY',
        },
      });
    }

    this.logger.log(`Aggregated ${Object.keys(grouped).length} daily metrics`);
  }

  /**
   * Calculate metric summary
   */
  private calculateMetricSummary(
    metrics: { metricType: UsageMetricType; value: number }[],
  ) {
    const byType = metrics.reduce(
      (acc, m) => {
        if (!acc[m.metricType]) {
          acc[m.metricType] = { total: 0, count: 0 };
        }
        acc[m.metricType].total += m.value;
        acc[m.metricType].count++;
        return acc;
      },
      {} as Record<string, { total: number; count: number }>,
    );

    return Object.entries(byType).map(([type, data]) => ({
      type,
      total: data.total,
      average: data.total / data.count,
    }));
  }
}
