import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportService } from '../exports/export.service';
import { EmailService } from '../email/email.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
} from './dto/scheduled-report.dto';
import { ReportFormat, ReportStatus } from '@prisma/client';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a scheduled report
   */
  async create(
    workspaceId: string,
    userId: string,
    dto: CreateScheduledReportDto,
  ) {
    // Verify portal exists
    const portal = await this.prisma.portal.findFirst({
      where: { id: dto.portalId, workspaceId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // Calculate next run time
    const nextRunAt = this.calculateNextRun(
      dto.schedule,
      dto.timezone || 'UTC',
    );

    const report = await this.prisma.scheduledReport.create({
      data: {
        workspaceId,
        portalId: dto.portalId,
        name: dto.name,
        description: dto.description,
        format: dto.format || ReportFormat.PDF,
        schedule: dto.schedule,
        timezone: dto.timezone || 'UTC',
        recipients: dto.recipients,
        templateId: dto.templateId,
        customTemplate: dto.customTemplate,
        isActive: dto.isActive ?? true,
        nextRunAt,
        createdById: userId,
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    this.logger.log(`Scheduled report created: ${report.id}`);
    return report;
  }

  /**
   * Get all scheduled reports for a workspace
   */
  async findAll(workspaceId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { workspaceId },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: {
          select: { runs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single scheduled report
   */
  async findOne(id: string, workspaceId: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id, workspaceId },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        runs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Scheduled report not found');
    }

    return report;
  }

  /**
   * Update a scheduled report
   */
  async update(id: string, workspaceId: string, dto: UpdateScheduledReportDto) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id, workspaceId },
    });

    if (!report) {
      throw new NotFoundException('Scheduled report not found');
    }

    // Recalculate next run if schedule changed
    let nextRunAt = report.nextRunAt;
    if (dto.schedule) {
      nextRunAt = this.calculateNextRun(
        dto.schedule,
        dto.timezone || report.timezone,
      );
    }

    return this.prisma.scheduledReport.update({
      where: { id },
      data: {
        ...dto,
        nextRunAt,
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Delete a scheduled report
   */
  async delete(id: string, workspaceId: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id, workspaceId },
    });

    if (!report) {
      throw new NotFoundException('Scheduled report not found');
    }

    await this.prisma.scheduledReport.delete({ where: { id } });
    this.logger.log(`Scheduled report deleted: ${id}`);
    return { message: 'Report deleted successfully' };
  }

  /**
   * Manually trigger a report run
   */
  async triggerRun(id: string, workspaceId: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id, workspaceId },
      include: {
        portal: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Scheduled report not found');
    }

    return this.executeReport(report);
  }

  /**
   * Get run history for a report
   */
  async getRunHistory(id: string, workspaceId: string, limit = 20) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id, workspaceId },
    });

    if (!report) {
      throw new NotFoundException('Scheduled report not found');
    }

    return this.prisma.reportRun.findMany({
      where: { reportId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Cron job to check and run scheduled reports
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledReports() {
    const now = new Date();

    // Find reports due to run
    const dueReports = await this.prisma.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
      include: {
        portal: true,
      },
    });

    this.logger.log(`Found ${dueReports.length} reports due for execution`);

    for (const report of dueReports) {
      try {
        await this.executeReport(report);
      } catch (error) {
        this.logger.error(
          `Failed to execute report ${report.id}:`,
          (error as Error).message,
        );
      }
    }
  }

  /**
   * Execute a single report
   */
  private async executeReport(report: any) {
    // Create run record
    const run = await this.prisma.reportRun.create({
      data: {
        reportId: report.id,
        status: ReportStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Generate report based on format
      let reportBuffer: Buffer | Uint8Array;
      let contentType: string;
      let extension: string;

      switch (report.format) {
        case 'PDF':
          reportBuffer = await this.exportService.exportPortalToPDF(
            report.portalId,
            report.workspaceId,
          );
          contentType = 'application/pdf';
          extension = 'pdf';
          break;
        case 'CSV':
          reportBuffer = await this.exportService.exportPortalToCSV(
            report.portalId,
            report.workspaceId,
          );
          contentType = 'text/csv';
          extension = 'csv';
          break;
        case 'EXCEL':
          reportBuffer = await this.exportService.exportPortalToExcel(
            report.portalId,
            report.workspaceId,
          );
          contentType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          extension = 'xlsx';
          break;
        default:
          throw new Error(`Unsupported format: ${report.format}`);
      }

      // Send to recipients
      const sentTo: string[] = [];
      for (const recipient of report.recipients) {
        try {
          await this.emailService.sendEmail({
            to: recipient,
            subject: `${report.name} - ${new Date().toLocaleDateString()}`,
            template: 'scheduled-report',
            context: {
              reportName: report.name,
              portalName: report.portal.name,
              generatedAt: new Date().toLocaleString(),
            },
          });
          sentTo.push(recipient);
        } catch (emailError) {
          this.logger.error(
            `Failed to send report to ${recipient}:`,
            (emailError as Error).message,
          );
        }
      }

      // Update run record
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status:
            sentTo.length === report.recipients.length
              ? ReportStatus.COMPLETED
              : ReportStatus.PARTIALLY_SENT,
          completedAt: new Date(),
          fileSize: reportBuffer.length,
          recipientsSent: sentTo,
        },
      });

      // Update report with next run time
      const nextRunAt = this.calculateNextRun(report.schedule, report.timezone);
      await this.prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt,
          lastRunStatus:
            sentTo.length === report.recipients.length
              ? ReportStatus.COMPLETED
              : ReportStatus.PARTIALLY_SENT,
          runCount: { increment: 1 },
        },
      });

      this.logger.log(`Report ${report.id} executed successfully`);
      return run;
    } catch (error) {
      // Update run record with error
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: ReportStatus.FAILED,
          completedAt: new Date(),
          error: (error as Error).message,
        },
      });

      // Update report status
      await this.prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: ReportStatus.FAILED,
          nextRunAt: this.calculateNextRun(report.schedule, report.timezone),
        },
      });

      throw error;
    }
  }

  /**
   * Calculate the next run time based on cron expression
   */
  private calculateNextRun(cronExpression: string, timezone: string): Date {
    // Simple cron parser for common patterns
    // In production, use a library like 'cron-parser'
    const parts = cronExpression.split(' ');

    if (parts.length !== 5) {
      // Default to next hour if invalid cron
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      return nextHour;
    }

    // For now, return next occurrence (simplified)
    // Use cron-parser for accurate calculation
    const now = new Date();
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    const next = new Date(now);
    next.setSeconds(0, 0);

    // Parse hour
    if (hour !== '*') {
      const targetHour = parseInt(hour, 10);
      if (now.getHours() >= targetHour) {
        next.setDate(next.getDate() + 1);
      }
      next.setHours(targetHour);
    } else {
      next.setHours(next.getHours() + 1);
    }

    // Parse minute
    if (minute !== '*') {
      next.setMinutes(parseInt(minute, 10));
    } else {
      next.setMinutes(0);
    }

    return next;
  }
}
