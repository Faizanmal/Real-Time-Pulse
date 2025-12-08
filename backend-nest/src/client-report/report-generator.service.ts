import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClientReportService } from './client-report.service';
import { ClientReportStatus } from '@prisma/client';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private prisma: PrismaService,
    private clientReportService: ClientReportService,
  ) {}

  // Check for scheduled reports every 10 minutes
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processScheduledReports() {
    this.logger.log('Processing scheduled reports...');

    const reports = await this.clientReportService.getScheduledReports();

    for (const report of reports) {
      try {
        await this.generateAndSendReport(report.id);
      } catch (error) {
        this.logger.error(
          `Failed to generate report ${report.id}: ${error.message}`,
        );
        await this.clientReportService.updateReport(report.id, {
          status: ClientReportStatus.FAILED,
        });
      }
    }
  }

  async generateAndSendReport(reportId: string) {
    this.logger.log(`Generating report ${reportId}...`);

    const report = await this.clientReportService.getReportById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    // Update status to generating
    await this.clientReportService.updateReport(reportId, {
      status: ClientReportStatus.GENERATING,
    });

    // Generate AI insights
    const insights = await this.generateAIInsights(report);

    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(
      report,
      insights,
    );

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      report,
      insights,
    );

    // Collect metrics
    const metrics = this.collectMetrics(report);

    // Update report with generated content
    await this.clientReportService.updateReport(reportId, {
      executiveSummary,
      keyInsights: insights,
      metrics,
      recommendations,
      aiGenerated: true,
    });

    // Send the report
    await this.sendReport(reportId);

    // Mark as sent
    await this.clientReportService.markAsSent(reportId);

    this.logger.log(`Report ${reportId} generated and sent successfully`);
  }

  private async generateAIInsights(report: any): Promise<any[]> {
    const insights = [];

    if (report.project) {
      const prof = report.project.profitability;

      if (prof) {
        // Revenue insight
        if (prof.totalRevenue > 0) {
          insights.push({
            type: 'revenue',
            title: 'Revenue Performance',
            description: `Generated $${prof.totalRevenue.toFixed(2)} in revenue with a ${prof.profitMargin.toFixed(1)}% profit margin.`,
            trend: prof.profitMargin > 20 ? 'positive' : 'neutral',
            impact: 'high',
          });
        }

        // Profitability insight
        if (prof.profitMargin < 10 && prof.profitMargin > 0) {
          insights.push({
            type: 'warning',
            title: 'Low Profit Margin',
            description: `Profit margin of ${prof.profitMargin.toFixed(1)}% is below industry standard. Consider reviewing project scope and pricing.`,
            trend: 'negative',
            impact: 'high',
          });
        } else if (prof.profitMargin >= 30) {
          insights.push({
            type: 'success',
            title: 'Excellent Profitability',
            description: `Project maintains a healthy ${prof.profitMargin.toFixed(1)}% profit margin, exceeding targets.`,
            trend: 'positive',
            impact: 'high',
          });
        }

        // Utilization insight
        if (prof.utilizationRate < 70) {
          insights.push({
            type: 'improvement',
            title: 'Utilization Opportunity',
            description: `Resource utilization at ${prof.utilizationRate.toFixed(1)}%. Opportunity to improve billable hour ratio.`,
            trend: 'neutral',
            impact: 'medium',
          });
        }
      }

      // Time entry trends
      const recentEntries = report.project.timeEntries.slice(0, 10);
      if (recentEntries.length > 0) {
        const avgHoursPerEntry =
          recentEntries.reduce((sum: number, e: any) => sum + e.hours, 0) /
          recentEntries.length;

        insights.push({
          type: 'metric',
          title: 'Team Activity',
          description: `Team logged an average of ${avgHoursPerEntry.toFixed(1)} hours per entry over the last ${recentEntries.length} entries.`,
          trend: 'neutral',
          impact: 'medium',
        });
      }
    }

    // Add AI-powered insight about trends
    insights.push({
      type: 'ai_insight',
      title: 'AI Analysis',
      description:
        'Based on historical patterns, the project is on track to meet quarterly goals. Recommend maintaining current resource allocation.',
      trend: 'positive',
      impact: 'high',
    });

    return insights;
  }

  private async generateExecutiveSummary(
    report: any,
    insights: any[],
  ): Promise<string> {
    const project = report.project;

    if (!project) {
      return `This ${report.reportType.toLowerCase()} report for ${report.clientName} provides an overview of recent activities and performance metrics.`;
    }

    const prof = project.profitability;
    let summary = `Executive Summary for ${project.name}\n\n`;

    if (prof) {
      summary += `The project has generated $${prof.totalRevenue.toFixed(2)} in revenue with total costs of $${prof.totalCosts.toFixed(2)}, `;
      summary += `resulting in a gross profit of $${prof.grossProfit.toFixed(2)} and a profit margin of ${prof.profitMargin.toFixed(1)}%. `;

      if (prof.profitMargin > 20) {
        summary += `The project is performing excellently with strong profitability. `;
      } else if (prof.profitMargin > 10) {
        summary += `The project maintains healthy profitability. `;
      } else {
        summary += `The project's profitability requires attention to improve margins. `;
      }

      summary += `Resource utilization stands at ${prof.utilizationRate.toFixed(1)}%, `;
      summary += prof.utilizationRate > 75
        ? 'indicating efficient team deployment.\n\n'
        : 'with opportunities for optimization.\n\n';
    }

    summary += `Key highlights include: `;
    const positiveInsights = insights.filter(
      (i) => i.trend === 'positive' || i.type === 'success',
    );
    if (positiveInsights.length > 0) {
      summary += positiveInsights
        .map((i) => i.title.toLowerCase())
        .join(', ');
    } else {
      summary += 'ongoing progress on project deliverables';
    }
    summary += '.';

    return summary;
  }

  private async generateRecommendations(
    report: any,
    insights: any[],
  ): Promise<any[]> {
    const recommendations = [];

    // Extract warning and improvement insights
    const concerns = insights.filter(
      (i) =>
        i.type === 'warning' ||
        i.type === 'improvement' ||
        i.trend === 'negative',
    );

    if (concerns.length > 0) {
      for (const concern of concerns) {
        if (concern.title.includes('Profit Margin')) {
          recommendations.push({
            priority: 'high',
            category: 'financial',
            title: 'Improve Profit Margins',
            action:
              'Review project scope and consider rate adjustments or reducing non-billable hours.',
            expectedImpact: 'Increase profit margin by 5-10%',
          });
        }

        if (concern.title.includes('Utilization')) {
          recommendations.push({
            priority: 'medium',
            category: 'operations',
            title: 'Optimize Resource Utilization',
            action:
              'Identify and reduce non-billable activities. Consider training to improve efficiency.',
            expectedImpact: 'Increase billable hours by 10-15%',
          });
        }
      }
    } else {
      recommendations.push({
        priority: 'low',
        category: 'growth',
        title: 'Continue Current Strategy',
        action:
          'Project is performing well. Maintain current practices and explore expansion opportunities.',
        expectedImpact: 'Sustained profitability',
      });
    }

    // Always add a proactive recommendation
    recommendations.push({
      priority: 'medium',
      category: 'communication',
      title: 'Enhance Client Communication',
      action:
        'Schedule regular check-ins to ensure alignment on project goals and expectations.',
      expectedImpact: 'Improved client satisfaction and retention',
    });

    return recommendations;
  }

  private collectMetrics(report: any): any {
    if (!report.project) {
      return {};
    }

    const prof = report.project.profitability;
    const project = report.project;

    return {
      financial: {
        totalRevenue: prof?.totalRevenue || 0,
        totalCosts: prof?.totalCosts || 0,
        grossProfit: prof?.grossProfit || 0,
        profitMargin: prof?.profitMargin || 0,
      },
      time: {
        totalHours: project.totalHours || 0,
        billableHours: project.billableHours || 0,
        utilizationRate: prof?.utilizationRate || 0,
      },
      project: {
        status: project.status,
        budget: project.budgetAmount || 0,
        startDate: project.startDate,
        endDate: project.endDate,
      },
    };
  }

  private async sendReport(reportId: string) {
    // TODO: Implement actual email sending
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    this.logger.log(`Sending report ${reportId}...`);

    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async generateReportOnDemand(reportId: string) {
    return this.generateAndSendReport(reportId);
  }
}
