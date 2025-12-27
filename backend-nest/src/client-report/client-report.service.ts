import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ClientReportStatus, Prisma } from '@prisma/client';

@Injectable()
export class ClientReportService {
  private readonly logger = new Logger(ClientReportService.name);

  constructor(private prisma: PrismaService) {}

  async createReport(data: {
    workspaceId: string;
    projectId?: string;
    title: string;
    clientName: string;
    reportType: ReportType;
    recipientEmails: string[];
    scheduledFor?: Date;
  }) {
    return this.prisma.clientReport.create({
      data: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        title: data.title,
        clientName: data.clientName,
        reportType: data.reportType,
        recipientEmails: data.recipientEmails,
        scheduledFor: data.scheduledFor,
        status: data.scheduledFor
          ? ClientReportStatus.SCHEDULED
          : ClientReportStatus.DRAFT,
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReportById(reportId: string) {
    return this.prisma.clientReport.findUnique({
      where: { id: reportId },
      include: {
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
  }

  async updateReport(
    reportId: string,
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
    return this.prisma.clientReport.update({
      where: { id: reportId },
      data: {
        ...data,
        ...(data.keyInsights && {
          keyInsights: data.keyInsights as Prisma.InputJsonValue,
        }),
        ...(data.metrics && {
          metrics: data.metrics as Prisma.InputJsonValue,
        }),
        ...(data.recommendations && {
          recommendations: data.recommendations as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async deleteReport(reportId: string) {
    return this.prisma.clientReport.delete({
      where: { id: reportId },
    });
  }

  async markAsSent(reportId: string) {
    return this.prisma.clientReport.update({
      where: { id: reportId },
      data: {
        status: ClientReportStatus.SENT,
        sentAt: new Date(),
      },
    });
  }

  async getScheduledReports() {
    const now = new Date();

    return this.prisma.clientReport.findMany({
      where: {
        status: ClientReportStatus.SCHEDULED,
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        project: {
          include: {
            profitability: true,
            timeEntries: {
              orderBy: { date: 'desc' },
              take: 50,
            },
            expenses: {
              orderBy: { date: 'desc' },
              take: 50,
            },
          },
        },
      },
    });
  }

  async getReportStats(workspaceId: string) {
    const reports = await this.prisma.clientReport.findMany({
      where: { workspaceId },
    });

    const total = reports.length;
    const sent = reports.filter(
      (r) => r.status === ClientReportStatus.SENT,
    ).length;
    const scheduled = reports.filter(
      (r) => r.status === ClientReportStatus.SCHEDULED,
    ).length;
    const draft = reports.filter(
      (r) => r.status === ClientReportStatus.DRAFT,
    ).length;
    const failed = reports.filter(
      (r) => r.status === ClientReportStatus.FAILED,
    ).length;

    const aiGenerated = reports.filter((r) => r.aiGenerated).length;

    return {
      total,
      sent,
      scheduled,
      draft,
      failed,
      aiGenerated,
      aiGeneratedPercent: total > 0 ? (aiGenerated / total) * 100 : 0,
    };
  }
}
