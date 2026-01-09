import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface DateRange {
  start: Date;
  end: Date;
}

interface SystemMetrics {
  users: {
    total: number;
    activeThisMonth: number;
    newThisMonth: number;
    byPlan: Record<string, number>;
  };
  workspaces: {
    total: number;
    activeThisMonth: number;
    newThisMonth: number;
  };
  portals: {
    total: number;
    public: number;
    private: number;
    totalViews: number;
  };
  widgets: {
    total: number;
    byType: Record<string, number>;
  };
  integrations: {
    total: number;
    active: number;
    byProvider: Record<string, number>;
  };
}

interface RevenueMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  averageRevenuePerUser: number;
  byPlan: {
    plan: string;
    count: number;
    revenue: number;
  }[];
  growth: {
    period: string;
    mrr: number;
    subscribers: number;
  }[];
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  database: {
    status: string;
    responseTime: number;
    connectionCount: number;
  };
  cache: {
    status: string;
    hitRate: number;
    memoryUsage: number;
  };
  jobs: {
    pending: number;
    failed: number;
    completed: number;
    failureRate: number;
  };
  integrations: {
    healthy: number;
    failing: number;
    failingProviders: string[];
  };
  alerts: {
    criticalCount: number;
    unresolvedCount: number;
  };
}

interface UserActivityMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  sessionStats: {
    avgSessionDuration: number;
    avgSessionsPerUser: number;
    bounceRate: number;
  };
  topFeatures: {
    feature: string;
    usageCount: number;
    uniqueUsers: number;
  }[];
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Check if user has admin access
   */
  private async checkAdminAccess(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * Get system-wide overview metrics
   */
  async getSystemMetrics(userId: string): Promise<SystemMetrics> {
    await this.checkAdminAccess(userId);

    const cacheKey = 'admin:system-metrics';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      usersByPlan,
      totalWorkspaces,
      activeWorkspaces,
      newWorkspaces,
      totalPortals,
      publicPortals,
      portalViews,
      totalWidgets,
      widgetsByType,
      totalIntegrations,
      activeIntegrations,
      integrationsByProvider,
    ] = await Promise.all([
      // Users
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: true,
      }),

      // Workspaces
      this.prisma.workspace.count(),
      this.prisma.workspace.count({
        where: { updatedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.workspace.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      // Portals
      this.prisma.portal.count(),
      this.prisma.portal.count({ where: { isPublic: true } }),
      this.prisma.usageMetric.aggregate({
        where: { metricType: 'PORTAL_VIEWS' },
        _sum: { value: true },
      }),

      // Widgets
      this.prisma.widget.count(),
      this.prisma.widget.groupBy({
        by: ['type'],
        _count: true,
      }),

      // Integrations
      this.prisma.integration.count(),
      this.prisma.integration.count({ where: { status: 'ACTIVE' } }),
      this.prisma.integration.groupBy({
        by: ['provider'],
        _count: true,
      }),
    ]);

    const metrics: SystemMetrics = {
      users: {
        total: totalUsers,
        activeThisMonth: activeUsers,
        newThisMonth: newUsers,
        byPlan: usersByPlan.reduce(
          (acc, p) => {
            acc[p.plan] = p._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      workspaces: {
        total: totalWorkspaces,
        activeThisMonth: activeWorkspaces,
        newThisMonth: newWorkspaces,
      },
      portals: {
        total: totalPortals,
        public: publicPortals,
        private: totalPortals - publicPortals,
        totalViews: portalViews._sum.value || 0,
      },
      widgets: {
        total: totalWidgets,
        byType: widgetsByType.reduce(
          (acc, w) => {
            acc[w.type] = w._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      integrations: {
        total: totalIntegrations,
        active: activeIntegrations,
        byProvider: integrationsByProvider.reduce(
          (acc, i) => {
            acc[i.provider] = i._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };

    await this.cacheService.set(
      cacheKey,
      JSON.stringify(metrics),
      this.CACHE_TTL,
    );
    return metrics;
  }

  /**
   * Get revenue and subscription metrics
   */
  async getRevenueMetrics(userId: string): Promise<RevenueMetrics> {
    await this.checkAdminAccess(userId);

    const cacheKey = 'admin:revenue-metrics';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Plan pricing (monthly)
    const planPricing: Record<string, number> = {
      FREE: 0,
      STARTER: 29,
      PROFESSIONAL: 79,
      BUSINESS: 199,
      ENTERPRISE: 499,
    };

    // Get subscription data
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: {
        plan: true,
        createdAt: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    // Calculate MRR
    const mrr = subscriptions.reduce((sum, sub) => {
      return sum + (planPricing[sub.plan] || 0);
    }, 0);

    // Group by plan
    const byPlan = subscriptions.reduce(
      (acc, sub) => {
        if (!acc[sub.plan]) {
          acc[sub.plan] = { count: 0, revenue: 0 };
        }
        acc[sub.plan].count++;
        acc[sub.plan].revenue += planPricing[sub.plan] || 0;
        return acc;
      },
      {} as Record<string, { count: number; revenue: number }>,
    );

    // Calculate churn (subscribers who cancelled in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cancelledCount = await this.prisma.subscription.count({
      where: {
        status: 'CANCELED',
        updatedAt: { gte: thirtyDaysAgo },
      },
    });

    const totalSubscribers = subscriptions.length;
    const churnRate =
      totalSubscribers > 0 ? (cancelledCount / totalSubscribers) * 100 : 0;

    // Get growth data for last 6 months
    const growth: RevenueMetrics['growth'] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthSubs = await this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          createdAt: { lte: monthEnd },
        },
      });

      // Estimate MRR based on average plan value
      const avgPlanValue = mrr / (totalSubscribers || 1);
      growth.push({
        period: monthStart.toISOString().slice(0, 7),
        mrr: Math.round(monthSubs * avgPlanValue),
        subscribers: monthSubs,
      });
    }

    const metrics: RevenueMetrics = {
      mrr,
      arr: mrr * 12,
      churnRate: parseFloat(churnRate.toFixed(2)),
      averageRevenuePerUser:
        totalSubscribers > 0
          ? parseFloat((mrr / totalSubscribers).toFixed(2))
          : 0,
      byPlan: Object.entries(byPlan).map(([plan, data]) => ({
        plan,
        count: (data as { count: number; revenue: number }).count,
        revenue: (data as { count: number; revenue: number }).revenue,
      })),
      growth,
    };

    await this.cacheService.set(
      cacheKey,
      JSON.stringify(metrics),
      this.CACHE_TTL,
    );
    return metrics;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(userId: string): Promise<SystemHealth> {
    await this.checkAdminAccess(userId);

    const _startTime = Date.now();

    // Database health check
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStart;
      if (dbResponseTime > 1000) dbStatus = 'degraded';
    } catch {
      dbStatus = 'critical';
    }

    // Cache health check
    let cacheStatus = 'healthy';
    let cacheHitRate = 95; // Default estimate
    const cacheMemoryUsage = 0;
    try {
      // Simple cache operation test
      await this.cacheService.set('health-check', 'ok', 1);
      const result = await this.cacheService.get('health-check');
      if (result !== 'ok') cacheStatus = 'degraded';
    } catch {
      cacheStatus = 'critical';
      cacheHitRate = 0;
    }

    // Job queue status
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pendingJobs, failedJobs, completedJobs] = await Promise.all([
      this.prisma.reportRun.count({
        where: { status: 'PENDING', createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.reportRun.count({
        where: { status: 'FAILED', createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.reportRun.count({
        where: { status: 'COMPLETED', createdAt: { gte: oneDayAgo } },
      }),
    ]);

    const totalJobs = pendingJobs + failedJobs + completedJobs;
    const jobFailureRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;

    // Integration health
    const integrations = await this.prisma.integration.findMany({
      select: { provider: true, status: true },
    });

    const healthyIntegrations = integrations.filter(
      (i) => i.status === 'ACTIVE',
    ).length;
    const failingIntegrations = integrations.filter(
      (i) => i.status === 'ERROR',
    );
    const failingProviders = failingIntegrations.map(
      (i) => i.provider,
    ) as string[];

    // Alert status
    const [criticalAlerts, unresolvedAlerts] = await Promise.all([
      this.prisma.alert.count({
        where: { isActive: true },
      }),
      this.prisma.alert.count({
        where: { isActive: true },
      }),
    ]);

    // Determine overall status
    let overallStatus: SystemHealth['status'] = 'healthy';
    if (
      dbStatus === 'critical' ||
      cacheStatus === 'critical' ||
      jobFailureRate > 50 ||
      criticalAlerts > 10
    ) {
      overallStatus = 'critical';
    } else if (
      dbStatus === 'degraded' ||
      cacheStatus === 'degraded' ||
      jobFailureRate > 20 ||
      criticalAlerts > 0
    ) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        connectionCount: 0, // Would need native query for actual pool stats
      },
      cache: {
        status: cacheStatus,
        hitRate: cacheHitRate,
        memoryUsage: cacheMemoryUsage,
      },
      jobs: {
        pending: pendingJobs,
        failed: failedJobs,
        completed: completedJobs,
        failureRate: parseFloat(jobFailureRate.toFixed(2)),
      },
      integrations: {
        healthy: healthyIntegrations,
        failing: failingIntegrations.length,
        failingProviders,
      },
      alerts: {
        criticalCount: criticalAlerts,
        unresolvedCount: unresolvedAlerts,
      },
    };
  }

  /**
   * Get user activity metrics
   */
  async getUserActivityMetrics(userId: string): Promise<UserActivityMetrics> {
    await this.checkAdminAccess(userId);

    const cacheKey = 'admin:user-activity';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Active users
    const [dau, wau, mau] = await Promise.all([
      this.prisma.user.count({
        where: { lastLoginAt: { gte: oneDayAgo } },
      }),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    // Feature usage from audit logs
    const featureUsage = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    });

    // Unique users per feature
    const topFeatures = await Promise.all(
      featureUsage.slice(0, 5).map(async (feature) => {
        const uniqueUsers = await this.prisma.auditLog.findMany({
          where: {
            action: feature.action,
            createdAt: { gte: thirtyDaysAgo },
          },
          distinct: ['userId'],
          select: { userId: true },
        });

        return {
          feature: feature.action,
          usageCount: feature._count,
          uniqueUsers: uniqueUsers.length,
        };
      }),
    );

    // Retention calculation
    const calculateRetention = async (days: number): Promise<number> => {
      const cohortStart = new Date(
        now.getTime() - (days + 7) * 24 * 60 * 60 * 1000,
      );
      const cohortEnd = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const cohortUsers = await this.prisma.user.findMany({
        where: {
          createdAt: { gte: cohortStart, lt: cohortEnd },
        },
        select: { id: true, lastLoginAt: true },
      });

      if (cohortUsers.length === 0) return 0;

      const retainedUsers = cohortUsers.filter(
        (u) => u.lastLoginAt && new Date(u.lastLoginAt) >= cohortEnd,
      ).length;

      return parseFloat(
        ((retainedUsers / cohortUsers.length) * 100).toFixed(1),
      );
    };

    const [day1Retention, day7Retention, day30Retention] = await Promise.all([
      calculateRetention(1),
      calculateRetention(7),
      calculateRetention(30),
    ]);

    const metrics: UserActivityMetrics = {
      dailyActiveUsers: dau,
      weeklyActiveUsers: wau,
      monthlyActiveUsers: mau,
      sessionStats: {
        avgSessionDuration: 15.5, // Would need session tracking for real data
        avgSessionsPerUser:
          mau > 0 ? parseFloat(((wau / mau) * 4).toFixed(1)) : 0,
        bounceRate: 25, // Would need analytics integration
      },
      topFeatures,
      retention: {
        day1: day1Retention,
        day7: day7Retention,
        day30: day30Retention,
      },
    };

    await this.cacheService.set(
      cacheKey,
      JSON.stringify(metrics),
      this.CACHE_TTL,
    );
    return metrics;
  }

  /**
   * Get real-time activity feed for admins
   */
  async getAdminActivityFeed(userId: string, limit = 100) {
    await this.checkAdminAccess(userId);

    const activities = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        userEmail: true,
        workspaceId: true,
        ipAddress: true,
        userAgent: true,
        success: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return activities.map((activity) => ({
      ...activity,
      timestamp: activity.createdAt,
      type: this.categorizeActivity(activity.action),
    }));
  }

  /**
   * Get workspace comparison metrics
   */
  async getWorkspaceComparison(userId: string, workspaceIds?: string[]) {
    await this.checkAdminAccess(userId);

    const where = workspaceIds?.length ? { id: { in: workspaceIds } } : {};

    const workspaces = await this.prisma.workspace.findMany({
      where,
      include: {
        _count: {
          select: {
            portals: true,
            users: true,
            integrations: true,
            aiInsights: true,
          },
        },
        subscription: {
          select: { plan: true, status: true },
        },
      },
      take: 50,
    });

    // Get usage metrics for each workspace
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const workspaceMetrics = await Promise.all(
      workspaces.map(async (ws) => {
        const metrics = await this.prisma.usageMetric.aggregate({
          where: {
            workspaceId: ws.id,
            period: { gte: thirtyDaysAgo },
          },
          _sum: { value: true },
        });

        return {
          workspaceId: ws.id,
          name: ws.name,
          plan: ws.subscription?.plan || 'FREE',
          status: ws.subscription?.status || 'NONE',
          portals: ws._count.portals,
          members: ws._count.users,
          integrations: ws._count.integrations,
          insights: ws._count.aiInsights,
          totalActivity: metrics._sum.value || 0,
          createdAt: ws.createdAt,
        };
      }),
    );

    // Sort by activity
    return workspaceMetrics.sort((a, b) => b.totalActivity - a.totalActivity);
  }

  /**
   * Export admin analytics data
   */
  async exportAnalyticsData(
    userId: string,
    options: {
      type: 'users' | 'revenue' | 'activity' | 'workspaces';
      format: 'json' | 'csv';
      dateRange?: DateRange;
    },
  ) {
    await this.checkAdminAccess(userId);

    let data: any;

    switch (options.type) {
      case 'users':
        data = await this.prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
          },
        });
        break;

      case 'revenue':
        data = await this.prisma.subscription.findMany({
          include: {
            workspace: { select: { name: true } },
          },
        });
        break;

      case 'activity':
        data = await this.prisma.auditLog.findMany({
          where: options.dateRange
            ? {
                createdAt: {
                  gte: options.dateRange.start,
                  lte: options.dateRange.end,
                },
              }
            : undefined,
          take: 10000,
        });
        break;

      case 'workspaces':
        data = await this.prisma.workspace.findMany({
          include: {
            subscription: true,
            _count: {
              select: { portals: true, users: true },
            },
          },
        });
        break;
    }

    if (options.format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  /**
   * Generate system report
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateDailySystemReport() {
    this.logger.log('Generating daily system report');

    try {
      // Get admin users to potentially notify
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
      });

      if (admins.length === 0) {
        this.logger.warn('No admin users found for system report');
        return;
      }

      // Use first admin for metrics (admin check will pass)
      const adminId = admins[0].id;

      const [systemMetrics, revenueMetrics, systemHealth] = await Promise.all([
        this.getSystemMetrics(adminId),
        this.getRevenueMetrics(adminId),
        this.getSystemHealth(adminId),
      ]);

      const report = {
        generatedAt: new Date().toISOString(),
        system: systemMetrics,
        revenue: revenueMetrics,
        health: systemHealth,
      };

      this.logger.log('Daily system report generated', {
        status: systemHealth.status,
        mrr: revenueMetrics.mrr,
        totalUsers: systemMetrics.users.total,
      });

      // Store report for historical tracking
      // Could also send email notifications to admins here

      return report;
    } catch (error) {
      this.logger.error('Failed to generate daily system report', error);
    }
  }

  /**
   * Categorize audit action
   */
  private categorizeActivity(action: string): string {
    if (action.includes('CREATE') || action.includes('create')) return 'create';
    if (action.includes('UPDATE') || action.includes('update')) return 'update';
    if (action.includes('DELETE') || action.includes('delete')) return 'delete';
    if (action.includes('LOGIN') || action.includes('login')) return 'auth';
    if (action.includes('EXPORT') || action.includes('export')) return 'export';
    return 'other';
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).includes(',') ? `"${value}"` : String(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}
