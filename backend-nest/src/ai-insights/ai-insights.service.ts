import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InsightType, InsightSeverity, InsightStatus } from '@prisma/client';

interface GeneratedInsight {
  type: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  confidence: number;
  data: any;
  recommendations: { actions: string[] };
}

interface NaturalLanguageQuery {
  query: string;
  portalId?: string;
}

@Injectable()
export class AIInsightsService {
  private readonly openAiApiKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  /**
   * Get all insights for a workspace
   */
  async getWorkspaceInsights(workspaceId: string, status?: string, type?: string) {
    return this.prisma.aIInsight.findMany({
      where: {
        workspaceId,
        ...(status && { status: status as InsightStatus }),
        ...(type && { type: type as InsightType }),
      },
      include: {
        portal: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get insights for a specific portal
   */
  async getPortalInsights(portalId: string, workspaceId: string) {
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    return this.prisma.aIInsight.findMany({
      where: {
        portalId,
        workspaceId,
        status: { not: 'DISMISSED' },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Generate AI insights for a portal
   * This is a simplified version - integrate with OpenAI/Claude for production
   */
  async generateInsights(portalId: string, workspaceId: string) {
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: {
          include: {
            integration: true,
          },
        },
      },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // Example insights generation logic
    const insights: GeneratedInsight[] = [];

    // Anomaly Detection: Check for stale data
    const staleWidgets = portal.widgets.filter((widget) => {
      if (!widget.lastRefreshedAt) return true;
      const hoursSinceRefresh = (Date.now() - widget.lastRefreshedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceRefresh > 24;
    });

    if (staleWidgets.length > 0) {
      insights.push({
        type: 'ANOMALY' as InsightType,
        title: 'Stale Widget Data Detected',
        description: `${staleWidgets.length} widget(s) haven't been refreshed in over 24 hours. This may impact data accuracy.`,
        severity: 'MEDIUM' as InsightSeverity,
        confidence: 0.95,
        data: {
          affectedWidgets: staleWidgets.map((w) => ({
            id: w.id,
            name: w.name,
            lastRefreshedAt: w.lastRefreshedAt,
          })),
        },
        recommendations: {
          actions: [
            'Check integration connection status',
            'Verify widget refresh intervals',
            'Review data sync logs',
          ],
        },
      });
    }

    // Trend: Portal usage patterns
    const widgetCount = portal.widgets.length;
    if (widgetCount < 3) {
      insights.push({
        type: 'RECOMMENDATION' as InsightType,
        title: 'Enhance Portal Visibility',
        description: `Your portal has only ${widgetCount} widget(s). Adding more widgets can provide better insights to your clients.`,
        severity: 'LOW' as InsightSeverity,
        confidence: 0.8,
        data: {
          currentWidgets: widgetCount,
          recommendedMinimum: 5,
        },
        recommendations: {
          actions: [
            'Add key metrics widgets',
            'Include progress tracking widgets',
            'Add client communication widgets',
          ],
        },
      });
    }

    // Check for missing integrations
    const hasIntegrations = portal.widgets.some((w) => w.integrationId);
    if (!hasIntegrations) {
      insights.push({
        type: 'RECOMMENDATION' as InsightType,
        title: 'Connect Integrations',
        description:
          'No integrations detected. Connect tools like Asana, Google Analytics, or Harvest for automatic data updates.',
        severity: 'HIGH' as InsightSeverity,
        confidence: 1.0,
        data: {
          availableIntegrations: ['Asana', 'Google Analytics', 'Harvest', 'GitHub', 'Jira'],
        },
        recommendations: {
          actions: [
            'Connect project management tools',
            'Add analytics integration',
            'Integrate time tracking',
          ],
        },
      });
    }

    // Summary insight
    const lastUpdated = portal.updatedAt;
    const daysSinceUpdate = Math.floor(
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceUpdate > 7) {
      insights.push({
        type: 'SUMMARY' as InsightType,
        title: 'Portal Activity Summary',
        description: `Portal hasn't been updated in ${daysSinceUpdate} days. Regular updates keep clients engaged.`,
        severity: 'INFO' as InsightSeverity,
        confidence: 1.0,
        data: {
          daysSinceUpdate,
          lastUpdated: lastUpdated.toISOString(),
        },
        recommendations: {
          actions: [
            'Review and update widget configurations',
            'Add new metrics or KPIs',
            'Refresh portal layout',
          ],
        },
      });
    }

    // Save insights to database
    const createdInsights = await Promise.all(
      insights.map((insight) =>
        this.prisma.aIInsight.create({
          data: {
            ...insight,
            workspaceId,
            portalId,
            status: 'NEW' as InsightStatus,
          },
        }),
      ),
    );

    return {
      generated: createdInsights.length,
      insights: createdInsights,
    };
  }

  /**
   * Dismiss an insight
   */
  async dismissInsight(id: string, userId: string) {
    return this.prisma.aIInsight.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissedBy: userId,
        dismissedAt: new Date(),
      },
    });
  }

  /**
   * Mark insight as actioned
   */
  async actionInsight(id: string) {
    return this.prisma.aIInsight.update({
      where: { id },
      data: {
        status: 'ACTIONED',
      },
    });
  }

  /**
   * Advanced: Predictive analytics
   * This would use ML models in production
   */
  async generatePredictiveInsights(portalId: string, workspaceId: string) {
    // Example: Predict project completion based on historical data
    // This would integrate with ML services like TensorFlow, scikit-learn, or cloud AI services

    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: {
          include: { integration: true },
        },
      },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    const insights: GeneratedInsight[] = [];

    // Analyze widget refresh patterns for prediction
    const widgetRefreshTimes = portal.widgets
      .filter((w) => w.lastRefreshedAt)
      .map((w) => ({
        widgetId: w.id,
        name: w.name,
        lastRefresh: w.lastRefreshedAt,
        interval: w.refreshInterval,
      }));

    // Predict potential data staleness
    const now = new Date();
    const staleRiskWidgets = widgetRefreshTimes.filter((w) => {
      const hoursSinceRefresh = (now.getTime() - w.lastRefresh.getTime()) / (1000 * 60 * 60);
      const expectedRefreshes = hoursSinceRefresh / (w.interval / 3600);
      return expectedRefreshes > 1.5; // 50% overdue
    });

    if (staleRiskWidgets.length > 0) {
      insights.push({
        type: 'PREDICTION' as InsightType,
        title: 'Data Staleness Risk Detected',
        description: `${staleRiskWidgets.length} widget(s) are at risk of showing stale data based on their refresh patterns.`,
        severity: 'MEDIUM' as InsightSeverity,
        confidence: 0.85,
        data: {
          atRiskWidgets: staleRiskWidgets,
          analysisDate: now.toISOString(),
        },
        recommendations: {
          actions: [
            'Review widget refresh intervals',
            'Check integration connection stability',
            'Consider reducing refresh intervals for critical widgets',
          ],
        },
      });
    }

    // Trend analysis based on portal activity
    const daysSinceCreation = Math.floor(
      (now.getTime() - portal.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const widgetGrowthRate = portal.widgets.length / Math.max(daysSinceCreation, 1);

    if (widgetGrowthRate < 0.1 && daysSinceCreation > 7) {
      insights.push({
        type: 'TREND' as InsightType,
        title: 'Low Portal Growth Detected',
        description: `This portal has had minimal widget additions since creation. Consider adding more widgets to improve client value.`,
        severity: 'LOW' as InsightSeverity,
        confidence: 0.9,
        data: {
          daysSinceCreation,
          widgetCount: portal.widgets.length,
          growthRate: widgetGrowthRate,
        },
        recommendations: {
          actions: [
            'Add KPI widgets for key metrics',
            'Include progress tracking widgets',
            'Connect additional integrations',
          ],
        },
      });
    }

    // Save predictive insights
    const createdInsights = await Promise.all(
      insights.map((insight) =>
        this.prisma.aIInsight.create({
          data: {
            ...insight,
            workspaceId,
            portalId,
            status: 'NEW' as InsightStatus,
          },
        }),
      ),
    );

    return {
      generated: createdInsights.length,
      insights: createdInsights,
    };
  }

  /**
   * Natural language query processing
   * Uses OpenAI for intelligent data querying
   */
  async processNaturalLanguageQuery(workspaceId: string, query: NaturalLanguageQuery) {
    // If OpenAI is not configured, use basic keyword matching
    if (!this.openAiApiKey) {
      return this.processBasicQuery(workspaceId, query);
    }

    try {
      // Gather context about the workspace
      const context = await this.gatherWorkspaceContext(workspaceId, query.portalId);

      // Call OpenAI API
      const response = await this.callOpenAI(query.query, context);

      return {
        query: query.query,
        response,
        source: 'openai',
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Fallback to basic query if OpenAI fails
      return this.processBasicQuery(workspaceId, query);
    }
  }

  /**
   * Basic keyword-based query processing
   */
  private async processBasicQuery(workspaceId: string, query: NaturalLanguageQuery) {
    const lowercaseQuery = query.query.toLowerCase();
    const results: any[] = [];

    // Portal queries
    if (lowercaseQuery.includes('portal') || lowercaseQuery.includes('dashboard')) {
      const portals = await this.prisma.portal.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { widgets: true } },
        },
        take: 10,
      });
      results.push({
        type: 'portals',
        data: portals,
        message: `Found ${portals.length} portal(s) in your workspace`,
      });
    }

    // Widget queries
    if (lowercaseQuery.includes('widget') || lowercaseQuery.includes('component')) {
      const widgets = await this.prisma.widget.findMany({
        where: {
          portal: { workspaceId },
          ...(query.portalId && { portalId: query.portalId }),
        },
        select: {
          id: true,
          name: true,
          type: true,
          lastRefreshedAt: true,
          portal: { select: { name: true } },
        },
        take: 20,
      });
      results.push({
        type: 'widgets',
        data: widgets,
        message: `Found ${widgets.length} widget(s)`,
      });
    }

    // Integration queries
    if (lowercaseQuery.includes('integration') || lowercaseQuery.includes('connect')) {
      const integrations = await this.prisma.integration.findMany({
        where: { workspaceId },
        select: {
          id: true,
          provider: true,
          status: true,
          lastSyncedAt: true,
        },
      });
      results.push({
        type: 'integrations',
        data: integrations,
        message: `Found ${integrations.length} integration(s)`,
      });
    }

    // Insight queries
    if (
      lowercaseQuery.includes('insight') ||
      lowercaseQuery.includes('recommendation') ||
      lowercaseQuery.includes('issue')
    ) {
      const insights = await this.prisma.aIInsight.findMany({
        where: {
          workspaceId,
          status: { not: 'DISMISSED' },
        },
        orderBy: { severity: 'desc' },
        take: 10,
      });
      results.push({
        type: 'insights',
        data: insights,
        message: `Found ${insights.length} active insight(s)`,
      });
    }

    // Stats queries
    if (
      lowercaseQuery.includes('stat') ||
      lowercaseQuery.includes('metric') ||
      lowercaseQuery.includes('overview')
    ) {
      const [portalCount, widgetCount, integrationCount, alertCount] = await Promise.all([
        this.prisma.portal.count({ where: { workspaceId } }),
        this.prisma.widget.count({
          where: { portal: { workspaceId } },
        }),
        this.prisma.integration.count({ where: { workspaceId } }),
        this.prisma.alert.count({
          where: { workspaceId, isActive: true },
        }),
      ]);

      results.push({
        type: 'stats',
        data: {
          portals: portalCount,
          widgets: widgetCount,
          integrations: integrationCount,
          activeAlerts: alertCount,
        },
        message: 'Workspace overview statistics',
      });
    }

    return {
      query: query.query,
      results,
      source: 'keyword-matching',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Gather context for AI queries
   */
  private async gatherWorkspaceContext(workspaceId: string, portalId?: string) {
    const [workspace, portals, integrations, recentInsights] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, createdAt: true },
      }),
      this.prisma.portal.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          _count: { select: { widgets: true } },
        },
        take: 10,
      }),
      this.prisma.integration.findMany({
        where: { workspaceId },
        select: { provider: true, status: true },
      }),
      this.prisma.aIInsight.findMany({
        where: { workspaceId, status: { not: 'DISMISSED' } },
        select: { type: true, title: true, severity: true },
        take: 5,
      }),
    ]);

    return {
      workspace,
      portals,
      integrations,
      recentInsights,
      portalId,
    };
  }

  /**
   * Call OpenAI API for natural language processing
   */
  private async callOpenAI(query: string, context: any): Promise<string> {
    const systemPrompt = `You are an AI assistant for a client dashboard platform called Real-Time Pulse. 
You help users understand their data, portals, widgets, and integrations.
Based on the context provided, answer the user's question helpfully and concisely.

Context:
- Workspace: ${context.workspace?.name}
- Portals: ${context.portals?.length || 0} (${context.portals?.map((p: any) => p.name).join(', ')})
- Integrations: ${context.integrations?.map((i: any) => i.provider).join(', ')}
- Active Insights: ${context.recentInsights?.length || 0}`;

    // In production, make actual API call
    // For now, return a placeholder response
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API call failed');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Unable to generate response';
  }
}
