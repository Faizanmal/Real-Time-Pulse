import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientReportDeliveryStatus, ClientReportStatus, Prisma } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import { ClientReportService } from './client-report.service';
import { reportEmail, reportPdf, ReportSnapshot, reportSnapshotDigest, reportCsv } from './report-delivery';
import {
  redactPii,
  summaryForFacts,
  verifyNumericClaims,
  VerifiedFact,
} from './verified-briefing';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientReportService: ClientReportService,
    private readonly emailService: EmailService,
  ) {}

  /** Scheduled reports become agency drafts; this job never contacts recipients. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processScheduledReports() {
    const reports = await this.clientReportService.getScheduledReports();
    for (const report of reports) {
      try {
        await this.generateReportDraft(report.id, report.workspaceId);
      } catch (error) {
        this.logger.error(`Failed to prepare briefing ${report.id}: ${(error as Error).message}`);
        await this.clientReportService.updateReport(report.id, report.workspaceId, {
          status: ClientReportStatus.FAILED,
        });
      }
    }
  }

  async generateReportDraft(reportId: string, workspaceId: string) {
    const report = await this.clientReportService.getReportById(reportId, workspaceId);
    if (!report) throw new NotFoundException('Report not found');
    if (
      report.status !== ClientReportStatus.DRAFT &&
      report.status !== ClientReportStatus.SCHEDULED
    ) {
      throw new ConflictException('Only draft or scheduled reports can be generated');
    }
    await this.clientReportService.updateReport(reportId, workspaceId, {
      status: ClientReportStatus.GENERATING,
    });
    const metrics = this.collectMetrics(report);
    return this.clientReportService.updateReport(reportId, workspaceId, {
      executiveSummary: summaryForFacts(metrics.verifiedFacts),
      keyInsights: [],
      metrics,
      recommendations: [],
      aiGenerated: false,
      status: ClientReportStatus.DRAFT,
    });
  }

  async approveBriefing(input: {
    reportId: string;
    workspaceId: string;
    userId: string;
    userEmail: string;
    notifyClient: boolean;
    consentNote?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const report = await this.clientReportService.getReportById(input.reportId, input.workspaceId);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ClientReportStatus.DRAFT)
      throw new ConflictException('Only a draft can be approved, once');
    if (input.notifyClient && !input.consentNote?.trim())
      throw new BadRequestException('Notification consent is required');
    if (input.notifyClient && !report.recipientEmails.length)
      throw new BadRequestException('No recipients are configured');

    const facts =
      (report.metrics as { verifiedFacts?: VerifiedFact[] } | null)?.verifiedFacts ?? [];
    const verification = verifyNumericClaims(report.executiveSummary ?? '', facts);
    if (!verification.supported) {
      const details = [
        ...(verification.unsupportedNumbers.length
          ? [`unsupported numbers: ${verification.unsupportedNumbers.join(', ')}`]
          : []),
        ...(verification.unsupportedSentences.length
          ? [`unsupported sentences: ${verification.unsupportedSentences.join(' | ')}`]
          : []),
      ];
      throw new BadRequestException(
        `${details.join('; ')}. Label human-entered text with "Human note (unverified):".`,
      );
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.clientReport.updateMany({
        where: {
          id: input.reportId,
          workspaceId: input.workspaceId,
          status: ClientReportStatus.DRAFT,
        },
        data: { status: ClientReportStatus.APPROVED },
      });
      if (!changed.count)
        throw new ConflictException('Briefing has already been approved or changed');
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          userEmail: input.userEmail,
          action: 'UPDATE',
          entity: 'ClientReport',
          entityId: input.reportId,
          method: 'POST',
          endpoint: `/api/v1/client-reports/${input.reportId}/approve`,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          oldValues: { status: 'DRAFT' },
          newValues: { status: 'APPROVED', notificationConsent: input.notifyClient },
          metadata: {
            notificationConsent: input.notifyClient,
            hasUnverifiedHumanNotes:
              report.executiveSummary?.includes('Human note (unverified):') ?? false,
            ...(input.notifyClient ? { consentNote: input.consentNote } : {}),
          },
        },
      });
      const approvedReport = await tx.clientReport.findFirst({
        where: { id: input.reportId, workspaceId: input.workspaceId },
      });
      if (!approvedReport) throw new NotFoundException('Report not found');
      const snapshot = this.createSnapshot(approvedReport);
      const revision = await tx.clientReportRevision.create({
        data: {
          reportId: input.reportId,
          version: approvedReport.revision,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          snapshotDigest: reportSnapshotDigest(snapshot),
          approvedById: input.userId,
          notificationConsent: input.notifyClient,
          consentNote: input.notifyClient ? input.consentNote : null,
        },
      });
      return { report: approvedReport, revision };
    });
    if (!approved) throw new NotFoundException('Report not found');
    if (!input.notifyClient) return { ...approved.report, revisions: [approved.revision] };
    return this.deliverApprovedReport(input.reportId, input.workspaceId);
  }

  async getPreview(reportId: string, workspaceId: string) {
    const report = await this.clientReportService.getReportById(reportId, workspaceId);
    return this.createSnapshot(report);
  }

  async exportRevision(reportId: string, version: number, workspaceId: string, format: 'pdf' | 'csv') {
    const revision = await this.clientReportService.getApprovedRevision(reportId, version, workspaceId);
    const snapshot = revision.snapshot as unknown as ReportSnapshot;
    if (reportSnapshotDigest(snapshot) !== revision.snapshotDigest)
      throw new ConflictException('Approved report revision integrity check failed');
    return format === 'pdf' ? reportPdf(snapshot) : Promise.resolve(reportCsv(snapshot));
  }

  async retryDelivery(reportId: string, workspaceId: string) {
    return this.deliverApprovedReport(reportId, workspaceId);
  }

  private async deliverApprovedReport(reportId: string, workspaceId: string) {
    const report = await this.clientReportService.getReportById(reportId, workspaceId);
    if (report.status !== ClientReportStatus.APPROVED && report.status !== ClientReportStatus.SENT)
      throw new ConflictException('Only an approved report can be delivered');
    const revision = report.revisions?.[0];
    if (!revision || !revision.notificationConsent)
      throw new BadRequestException('This approved revision has no recorded client-notification consent');
    if (!report.recipientEmails.length) throw new BadRequestException('No recipients are configured');
    const claim = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientReportDelivery.findUnique({ where: { revisionId: revision.id } });
      if (existing?.status === ClientReportDeliveryStatus.SENT) return { claimed: false };
      if (existing?.status === ClientReportDeliveryStatus.SENDING)
        throw new ConflictException('A delivery attempt is already in progress');
      if (existing) {
        const changed = await tx.clientReportDelivery.updateMany({
          where: { id: existing.id, status: ClientReportDeliveryStatus.FAILED },
          data: { status: ClientReportDeliveryStatus.SENDING, attemptCount: { increment: 1 }, lastError: null },
        });
        if (!changed.count) throw new ConflictException('A delivery attempt is already in progress');
      } else {
        await tx.clientReportDelivery.create({
          data: { reportId, revisionId: revision.id, status: ClientReportDeliveryStatus.SENDING, attemptCount: 1 },
        });
      }
      return { claimed: true };
    });
    if (!claim.claimed) {
      if (report.status === ClientReportStatus.APPROVED)
        return this.clientReportService.markAsSent(reportId, workspaceId);
      return report;
    }
    try {
      await this.sendReport(report, revision.snapshot as unknown as ReportSnapshot);
    } catch {
      await this.prisma.clientReportDelivery.update({
        where: { revisionId: revision.id },
        data: { status: ClientReportDeliveryStatus.FAILED, lastError: 'Email delivery failed' },
      });
      throw new ServiceUnavailableException('Report was approved, but email delivery failed; retry is available');
    }
    await this.prisma.clientReportDelivery.update({
      where: { revisionId: revision.id },
      data: { status: ClientReportDeliveryStatus.SENT, sentAt: new Date(), lastError: null },
    });
    await this.clientReportService.markAsSent(reportId, workspaceId);
    return this.clientReportService.getReportById(reportId, workspaceId);
  }

  private createSnapshot(report: any): ReportSnapshot {
    const facts = (report.metrics?.verifiedFacts ?? []).filter((fact: unknown): fact is VerifiedFact =>
      Boolean(fact && typeof fact === 'object' && typeof (fact as VerifiedFact).label === 'string' &&
        typeof (fact as VerifiedFact).value === 'number' && Number.isFinite((fact as VerifiedFact).value) &&
        typeof (fact as VerifiedFact).unit === 'string' && typeof (fact as VerifiedFact).sourceReference === 'string'))
      .map((fact) => ({
        ...fact,
        label: redactPii(fact.label),
        unit: redactPii(fact.unit),
        sourceReference: redactPii(fact.sourceReference),
      }));
    return {
      reportId: report.id,
      version: report.revision ?? 1,
      title: redactPii(report.title),
      clientName: redactPii(report.clientName),
      reportType: report.reportType,
      executiveSummary: redactPii(report.executiveSummary || 'Not enough verified data to report an outcome.'),
      facts,
      asOf: report.metrics?.asOf ?? null,
      approvedAt: new Date().toISOString(),
    };
  }

  private collectMetrics(report: any): { verifiedFacts: VerifiedFact[]; asOf: string | null } {
    const facts: VerifiedFact[] = [];
    const project = report.project;
    const calculatedAt = project?.profitability?.lastCalculatedAt ?? project?.updatedAt;
    const calculatedDate =
      typeof calculatedAt === 'string' ||
      typeof calculatedAt === 'number' ||
      calculatedAt instanceof Date
        ? new Date(calculatedAt)
        : null;
    const asOf =
      calculatedDate && Number.isFinite(calculatedDate.getTime())
        ? calculatedDate.toISOString()
        : null;
    if (!calculatedDate || !asOf || Date.now() - calculatedDate.getTime() > 24 * 60 * 60 * 1000) {
      return { verifiedFacts: facts, asOf };
    }
    const add = (label: string, value: unknown, unit: string, sourceReference: string) => {
      if (typeof value === 'number' && Number.isFinite(value))
        facts.push({ label, value, unit, sourceReference });
    };
    if (project) {
      const currencyValue: unknown = project.currency;
      const currency = typeof currencyValue === 'string' ? currencyValue : 'USD';
      add('Total hours', project.totalHours, 'hours', 'Project.totalHours');
      add('Billable hours', project.billableHours, 'hours', 'Project.billableHours');
      add('Budget', project.budgetAmount, currency, 'Project.budgetAmount');
      const profitability = project.profitability;
      if (profitability) {
        add(
          'Total revenue',
          profitability.totalRevenue,
          currency,
          'ProjectProfitability.totalRevenue',
        );
        add('Total costs', profitability.totalCosts, currency, 'ProjectProfitability.totalCosts');
        add(
          'Gross profit',
          profitability.grossProfit,
          currency,
          'ProjectProfitability.grossProfit',
        );
        add('Profit margin', profitability.profitMargin, '%', 'ProjectProfitability.profitMargin');
        add(
          'Utilization rate',
          profitability.utilizationRate,
          '%',
          'ProjectProfitability.utilizationRate',
        );
      }
    }
    return { verifiedFacts: facts, asOf };
  }

  private async sendReport(report: any, snapshot: ReportSnapshot) {
    const { html, text } = reportEmail(snapshot);
    const sent = await this.emailService.sendEmail({
      to: report.recipientEmails,
      subject: `Client briefing: ${snapshot.title.replace(/[\r\n]+/g, ' ')}`,
      html,
      text,
    });
    if (!sent) throw new Error('Email transport failed');
  }

  async generateReportOnDemand(reportId: string, workspaceId: string) {
    return this.generateReportDraft(reportId, workspaceId);
  }
}
