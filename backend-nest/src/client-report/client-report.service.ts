import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ReportType, ClientReportStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { redactPii } from './verified-briefing';
@Injectable()
export class ClientReportService {
  private readonly logger = new Logger(ClientReportService.name);

  constructor(private prisma: PrismaService) {}

  async getProjectOptions(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true, clientName: true },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async createReport(data: {
    workspaceId: string;
    projectId?: string;
    portalId?: string;
    title: string;
    clientName: string;
    reportType: ReportType;
    recipientEmails: string[];
    scheduledFor?: Date;
  }) {
    if (data.portalId) {
      const portal = await this.prisma.portal.findFirst({
        where: { id: data.portalId, workspaceId: data.workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!portal) throw new NotFoundException('Portal not found');
    }
    if (data.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: data.projectId, workspaceId: data.workspaceId },
        select: { id: true, clientName: true },
      });
      if (!project) throw new NotFoundException('Project not found');
      data.clientName = project.clientName;
    }
    return this.prisma.clientReport.create({
      data: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        portalId: data.portalId,
        title: data.title,
        clientName: data.clientName,
        reportType: data.reportType,
        recipientEmails: data.recipientEmails,
        scheduledFor: data.scheduledFor,
        status: data.scheduledFor ? ClientReportStatus.SCHEDULED : ClientReportStatus.DRAFT,
      },
      include: {
        project: true,
      },
    });
  }

  async getReports(
    workspaceId: string,
    filters?: {
      projectId?: string;
      status?: ClientReportStatus;
      clientName?: string;
    },
  ) {
    return this.prisma.clientReport.findMany({
      where: {
        workspaceId,
        ...(filters?.projectId && { projectId: filters.projectId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.clientName && {
          clientName: {
            contains: filters.clientName,
            mode: 'insensitive',
          },
        }),
      },
      include: {
        project: true,
        revisions: { orderBy: { version: 'desc' }, take: 3 },
        deliveries: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReportById(reportId: string, workspaceId: string) {
    const report = await this.prisma.clientReport.findFirst({
      where: { id: reportId, workspaceId },
      include: {
        revisions: { orderBy: { version: 'desc' } },
        deliveries: { orderBy: { createdAt: 'desc' }, take: 5 },
        project: {
          include: {
            profitability: true,
            timeEntries: {
              orderBy: { date: 'desc' },
              take: 20,
            },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async getApprovedRevision(reportId: string, version: number, workspaceId: string) {
    const revision = await this.prisma.clientReportRevision.findFirst({
      where: { reportId, version, report: { workspaceId } },
      include: { report: { select: { id: true, title: true, clientName: true, reportType: true, recipientEmails: true } } },
    });
    if (!revision) throw new NotFoundException('Approved report revision not found');
    return revision;
  }

  async listDeliveredPortalReports(portalId: string, workspaceId: string) {
    const revisions = await this.prisma.clientReportRevision.findMany({
      where: {
        notificationConsent: true,
        report: { portalId, workspaceId },
        delivery: { status: 'SENT' },
      },
      include: { delivery: { select: { sentAt: true } } },
      orderBy: { approvedAt: 'desc' },
      take: 50,
    });
    return revisions.map((revision) => {
      const snapshot = revision.snapshot as Record<string, unknown>;
      return {
        version: revision.version,
        title: snapshot.title,
        reportType: snapshot.reportType,
        executiveSummary: snapshot.executiveSummary,
        facts: snapshot.facts,
        asOf: snapshot.asOf,
        approvedAt: revision.approvedAt,
        deliveredAt: revision.delivery?.sentAt ?? null,
      };
    });
  }

  async updateReport(
    reportId: string,
    workspaceId: string,
    data: {
      title?: string;
      executiveSummary?: string;
      keyInsights?: any;
      metrics?: any;
      recommendations?: any;
      aiGenerated?: boolean;
      status?: ClientReportStatus;
      pdfUrl?: string;
      presentationUrl?: string;
    },
  ) {
    const existing = await this.getReportById(reportId, workspaceId);
    if (!existing) throw new NotFoundException('Report not found');
    if (data.status === undefined && existing.status !== ClientReportStatus.DRAFT) {
      throw new ConflictException('Only draft briefings can be edited');
    }
    const updated = await this.prisma.clientReport.updateMany({
      where: {
        id: reportId,
        workspaceId,
        ...(data.status === undefined ? { status: ClientReportStatus.DRAFT } : {}),
      },
      data: {
        ...data,
        ...(data.executiveSummary !== undefined && {
          executiveSummary: redactPii(data.executiveSummary),
        }),
        ...(data.keyInsights !== undefined && {
          keyInsights: data.keyInsights as Prisma.InputJsonValue,
        }),
        ...(data.metrics !== undefined && { metrics: data.metrics as Prisma.InputJsonValue }),
        ...(data.recommendations !== undefined && {
          recommendations: data.recommendations as Prisma.InputJsonValue,
        }),
      },
    });
    if (!updated.count) throw new ConflictException('Briefing changed before it could be updated');
    return this.getReportById(reportId, workspaceId);
  }

  async startRevision(reportId: string, workspaceId: string, userId: string, userEmail: string) {
    const current = await this.prisma.clientReport.findFirst({
      where: { id: reportId, workspaceId },
      select: { id: true, status: true, revision: true },
    });
    if (!current) throw new NotFoundException('Report not found');
    if (current.status !== ClientReportStatus.APPROVED && current.status !== ClientReportStatus.SENT)
      throw new ConflictException('Only an approved or sent report can be revised');
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.clientReport.updateMany({
        where: { id: reportId, workspaceId, status: current.status, revision: current.revision },
        data: { status: ClientReportStatus.DRAFT, revision: { increment: 1 }, sentAt: null },
      });
      if (!updated.count) throw new ConflictException('Report changed before a new revision could be started');
      await tx.auditLog.create({
        data: {
          workspaceId, userId, userEmail, action: 'UPDATE', entity: 'ClientReport', entityId: reportId,
          method: 'POST', endpoint: `/api/v1/client-reports/${reportId}/revise`,
          oldValues: { status: current.status, revision: current.revision },
          newValues: { status: 'DRAFT', revision: current.revision + 1 },
        },
      });
    });
    return this.getReportById(reportId, workspaceId);
  }

  async deleteReport(reportId: string, workspaceId: string) {
    const deleted = await this.prisma.clientReport.deleteMany({
      where: { id: reportId, workspaceId, status: ClientReportStatus.DRAFT },
    });
    if (!deleted.count) throw new NotFoundException('Draft report not found');
    return { deleted: true };
  }

  async markAsSent(reportId: string, workspaceId: string) {
    const sent = await this.prisma.clientReport.updateMany({
      where: { id: reportId, workspaceId, status: ClientReportStatus.APPROVED },
      data: {
        status: ClientReportStatus.SENT,
        sentAt: new Date(),
      },
    });
    if (!sent.count) {
      const alreadySent = await this.prisma.clientReport.findFirst({
        where: { id: reportId, workspaceId, status: ClientReportStatus.SENT },
        select: { id: true },
      });
      if (!alreadySent) throw new ConflictException('Only an approved briefing can be marked sent');
    }
    return this.getReportById(reportId, workspaceId);
  }

  async getScheduledReports() {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return this.prisma.clientReport.findMany({
      where: {
        status: ClientReportStatus.SCHEDULED,
        scheduledFor: {
          lte: now,
        },
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        title: true,
        clientName: true,
        reportType: true,
        scheduledFor: true,
        recipientEmails: true,
        status: true,
        project: {
          select: {
            id: true,
            name: true,
            clientName: true,
            profitability: {
              select: {
                id: true,
                totalRevenue: true,
                profitMargin: true,
                utilizationRate: true,
              },
            },
            timeEntries: {
              where: {
                date: {
                  gte: thirtyDaysAgo,
                },
              },
              select: {
                id: true,
                date: true,
                hours: true,
              },
              orderBy: { date: 'desc' },
              take: 20,
            },
            expenses: {
              where: {
                date: {
                  gte: thirtyDaysAgo,
                },
              },
              select: {
                id: true,
                date: true,
                amount: true,
              },
              orderBy: { date: 'desc' },
              take: 20,
            },
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50, // Limit to prevent excessive data loading
    });
  }

  async getReportStats(workspaceId: string) {
    // Use aggregation instead of loading all records - much more efficient
    const [totalData, sentData, scheduledData, draftData, failedData, aiGeneratedData] =
      await Promise.all([
        this.prisma.clientReport.count({
          where: { workspaceId },
        }),
        this.prisma.clientReport.count({
          where: { workspaceId, status: ClientReportStatus.SENT },
        }),
        this.prisma.clientReport.count({
          where: { workspaceId, status: ClientReportStatus.SCHEDULED },
        }),
        this.prisma.clientReport.count({
          where: { workspaceId, status: ClientReportStatus.DRAFT },
        }),
        this.prisma.clientReport.count({
          where: { workspaceId, status: ClientReportStatus.FAILED },
        }),
        this.prisma.clientReport.count({
          where: { workspaceId, aiGenerated: true },
        }),
      ]);

    return {
      total: totalData,
      sent: sentData,
      scheduled: scheduledData,
      draft: draftData,
      failed: failedData,
      aiGenerated: aiGeneratedData,
      aiGeneratedPercent: totalData > 0 ? (aiGeneratedData / totalData) * 100 : 0,
    };
  }
}
