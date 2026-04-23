import { Injectable, Logger } from '@nestjs/common';
import { ReportType, ClientReportStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

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
