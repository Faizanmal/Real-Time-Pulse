import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GdprService } from './gdpr.service';
import { ComplianceReportType, Prisma } from '@prisma/client';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private prisma: PrismaService,
    private gdprService: GdprService,
  ) {}

  // Generate monthly compliance reports on the 1st of each month
  @Cron('0 0 1 * *')
  async generateMonthlyReports() {
    this.logger.log('Generating monthly compliance reports...');

    const workspaces = await this.prisma.workspace.findMany();

    for (const workspace of workspaces) {
      try {
        await this.generateComplianceReport(
          workspace.id,
          ComplianceReportType.MONTHLY,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate compliance report for workspace ${workspace.id}: ${error.message}`,
        );
      }
    }
  }

  async generateComplianceReport(
    workspaceId: string,
    reportType: ComplianceReportType,
    generatedBy?: string,
  ) {
    const period = this.getPeriodString(reportType);

    // Collect metrics
    const consentStats = await this.gdprService.getConsentStats(workspaceId);
    const requestStats = await this.gdprService.getDataRequestStats(
      workspaceId,
    );

    // Calculate compliance score (0-100)
    const complianceScore = this.calculateComplianceScore({
      consentStats,
      requestStats,
    });

    // Generate findings
    const findings = this.generateFindings({
      consentStats,
      requestStats,
      complianceScore,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      consentStats,
      requestStats,
      complianceScore,
    });

    // Generate summary
    const summary = this.generateSummary({
      period,
      consentStats,
      requestStats,
      complianceScore,
    });

    // Create the report
    const report = await this.prisma.complianceReport.create({
      data: {
        workspaceId,
        reportType,
        period,
        totalDataSubjects: this.countUniqueDataSubjects(workspaceId),
        activeConsents: consentStats.active,
        revokedConsents: consentStats.revoked,
        dataRequests: requestStats.total,
        dataRequestsCompleted: requestStats.byStatus.COMPLETED || 0,
        averageResponseTime: requestStats.avgResponseTimeHours,
        complianceScore,
        summary,
        findings: findings as Prisma.InputJsonValue,
        recommendations: recommendations as Prisma.InputJsonValue,
        generatedBy,
      },
    });

    this.logger.log(
      `Generated ${reportType} compliance report for workspace ${workspaceId}`,
    );

    return report;
  }

  private getPeriodString(reportType: ComplianceReportType): string {
    const now = new Date();

    switch (reportType) {
      case ComplianceReportType.MONTHLY:
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      case ComplianceReportType.QUARTERLY:
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `${now.getFullYear()}-Q${quarter}`;
      case ComplianceReportType.ANNUAL:
        return `${now.getFullYear()}`;
      default:
        return now.toISOString().split('T')[0];
    }
  }

  private async countUniqueDataSubjects(workspaceId: string): Promise<number> {
    const consents = await this.prisma.gDPRConsent.findMany({
      where: { workspaceId },
      select: { subjectEmail: true },
    });

    const uniqueEmails = new Set(consents.map((c) => c.subjectEmail));
    return uniqueEmails.size;
  }

  private calculateComplianceScore(data: {
    consentStats: any;
    requestStats: any;
  }): number {
    let score = 100;

    // Deduct points for consent issues
    if (data.consentStats.expired > 0) {
      score -= Math.min(
        20,
        (data.consentStats.expired / data.consentStats.total) * 20,
      );
    }

    // Deduct points for slow request processing
    if (data.requestStats.avgResponseTimeHours > 72) {
      // GDPR requires response within 30 days, but best practice is much faster
      score -= 15;
    } else if (data.requestStats.avgResponseTimeHours > 48) {
      score -= 10;
    } else if (data.requestStats.avgResponseTimeHours > 24) {
      score -= 5;
    }

    // Deduct points for pending requests
    const pendingRequests = data.requestStats.byStatus.PENDING || 0;
    if (pendingRequests > 5) {
      score -= 15;
    } else if (pendingRequests > 2) {
      score -= 10;
    }

    // Bonus for good practices
    if (data.requestStats.avgResponseTimeHours < 24) {
      score += 10;
    }

    if (data.consentStats.active > 0 && data.consentStats.expired === 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateFindings(data: {
    consentStats: any;
    requestStats: any;
    complianceScore: number;
  }): any[] {
    const findings = [];

    // Consent findings
    if (data.consentStats.expired > 0) {
      findings.push({
        type: 'warning',
        category: 'consent',
        title: 'Expired Consents',
        description: `${data.consentStats.expired} consents have expired and need renewal.`,
        severity: 'medium',
      });
    }

    if (data.consentStats.revoked > data.consentStats.total * 0.1) {
      findings.push({
        type: 'info',
        category: 'consent',
        title: 'High Revocation Rate',
        description: `${data.consentStats.revoked} consents have been revoked (${((data.consentStats.revoked / data.consentStats.total) * 100).toFixed(1)}%).`,
        severity: 'low',
      });
    }

    // Request findings
    if (data.requestStats.avgResponseTimeHours > 48) {
      findings.push({
        type: 'warning',
        category: 'requests',
        title: 'Slow Request Processing',
        description: `Average response time of ${data.requestStats.avgResponseTimeHours.toFixed(1)} hours exceeds recommended threshold.`,
        severity: 'high',
      });
    }

    const pendingRequests = data.requestStats.byStatus.PENDING || 0;
    if (pendingRequests > 2) {
      findings.push({
        type: 'warning',
        category: 'requests',
        title: 'Pending Requests',
        description: `${pendingRequests} data requests are currently pending processing.`,
        severity: 'medium',
      });
    }

    // Positive findings
    if (data.complianceScore >= 90) {
      findings.push({
        type: 'success',
        category: 'overall',
        title: 'Excellent Compliance',
        description: 'GDPR compliance practices are well-maintained.',
        severity: 'info',
      });
    }

    return findings;
  }

  private generateRecommendations(data: {
    consentStats: any;
    requestStats: any;
    complianceScore: number;
  }): any[] {
    const recommendations = [];

    if (data.consentStats.expired > 0) {
      recommendations.push({
        priority: 'high',
        category: 'consent',
        title: 'Renew Expired Consents',
        action:
          'Contact users with expired consents to obtain renewed permissions.',
        impact: 'Ensures continued legal data processing',
      });
    }

    if (data.requestStats.avgResponseTimeHours > 48) {
      recommendations.push({
        priority: 'high',
        category: 'operations',
        title: 'Improve Request Processing Speed',
        action:
          'Implement automated workflows for common data requests to reduce response time.',
        impact: 'Better compliance with GDPR timelines',
      });
    }

    if (data.requestStats.byStatus.PENDING > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'operations',
        title: 'Process Pending Requests',
        action: 'Review and process all pending data requests promptly.',
        impact: 'Maintain compliance and user trust',
      });
    }

    // Always include a proactive recommendation
    recommendations.push({
      priority: 'medium',
      category: 'documentation',
      title: 'Regular Compliance Audits',
      action:
        'Schedule quarterly reviews of GDPR compliance processes and documentation.',
      impact: 'Proactive identification of compliance gaps',
    });

    if (data.complianceScore >= 90) {
      recommendations.push({
        priority: 'low',
        category: 'improvement',
        title: 'Maintain Current Practices',
        action:
          'Continue current compliance procedures and monitor for any changes in regulations.',
        impact: 'Sustained compliance excellence',
      });
    }

    return recommendations;
  }

  private generateSummary(data: {
    period: string;
    consentStats: any;
    requestStats: any;
    complianceScore: number;
  }): string {
    let summary = `GDPR Compliance Report for ${data.period}\n\n`;

    summary += `Compliance Score: ${data.complianceScore}/100\n\n`;

    summary += `Consent Management:\n`;
    summary += `- Total Consents: ${data.consentStats.total}\n`;
    summary += `- Active: ${data.consentStats.active}\n`;
    summary += `- Revoked: ${data.consentStats.revoked}\n`;
    summary += `- Expired: ${data.consentStats.expired}\n\n`;

    summary += `Data Requests:\n`;
    summary += `- Total Requests: ${data.requestStats.total}\n`;
    summary += `- Completed: ${data.requestStats.byStatus.COMPLETED || 0}\n`;
    summary += `- Pending: ${data.requestStats.byStatus.PENDING || 0}\n`;
    summary += `- Average Response Time: ${data.requestStats.avgResponseTimeHours.toFixed(1)} hours\n\n`;

    if (data.complianceScore >= 90) {
      summary += 'Overall, GDPR compliance is excellent with strong processes in place.';
    } else if (data.complianceScore >= 75) {
      summary += 'GDPR compliance is good with minor areas for improvement.';
    } else if (data.complianceScore >= 60) {
      summary +=
        'GDPR compliance requires attention in several areas to meet best practices.';
    } else {
      summary +=
        'Immediate action required to address GDPR compliance gaps.';
    }

    return summary;
  }

  async getComplianceReports(
    workspaceId: string,
    filters?: {
      reportType?: ComplianceReportType;
    },
  ) {
    return this.prisma.complianceReport.findMany({
      where: {
        workspaceId,
        ...(filters?.reportType && { reportType: filters.reportType }),
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async getComplianceReportById(reportId: string) {
    return this.prisma.complianceReport.findUnique({
      where: { id: reportId },
    });
  }

  async getComplianceDashboard(workspaceId: string) {
    const consentStats = await this.gdprService.getConsentStats(workspaceId);
    const requestStats = await this.gdprService.getDataRequestStats(
      workspaceId,
    );
    const complianceScore = this.calculateComplianceScore({
      consentStats,
      requestStats,
    });

    const latestReport = await this.prisma.complianceReport.findFirst({
      where: { workspaceId },
      orderBy: { generatedAt: 'desc' },
    });

    return {
      complianceScore,
      consentStats,
      requestStats,
      latestReport,
      recommendations: this.generateRecommendations({
        consentStats,
        requestStats,
        complianceScore,
      }).slice(0, 3), // Top 3 recommendations
    };
  }
}
