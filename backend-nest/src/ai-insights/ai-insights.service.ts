import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AIInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all insights for a workspace
   */
  async getWorkspaceInsights(
    workspaceId: string,
    status?: string,
    type?: string,
  ) {
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
      const hoursSinceRefresh =
        (Date.now() - widget.lastRefreshedAt.getTime()) / (1000 * 60 * 60);
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
          availableIntegrations: [
            'Asana',
            'Google Analytics',
            'Harvest',
            'GitHub',
            'Jira',
          ],
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
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // Placeholder for ML model integration
    return {
      message: 'Predictive insights require ML model integration',
      suggestedIntegrations: ['OpenAI API', 'Google Cloud AI', 'AWS SageMaker'],
    };
  }
}
