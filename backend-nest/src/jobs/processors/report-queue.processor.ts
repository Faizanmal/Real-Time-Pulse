import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';
import { ReportJobData } from '../jobs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Processor(QUEUE_NAMES.REPORT)
export class ReportQueueProcessor {
  private readonly logger = new Logger(ReportQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Process('generate-report')
  async handleGenerateReport(job: Job<ReportJobData>) {
    this.logger.log(`Processing report generation job ${job.id}`);

    try {
      await job.progress(10);

      // Fetch data based on report type
      const data = await this.fetchReportData(job.data);
      await job.progress(50);

      // Generate report in specified format
      const reportBuffer = await this.generateReport(data, job.data.format);
      await job.progress(80);

      // Send report via email
      await this.emailService.sendEmail({
        to: job.data.recipientEmail,
        subject: `Your ${job.data.reportType} report is ready`,
        template: 'report-ready',
        context: {
          reportType: job.data.reportType,
          format: job.data.format,
          recordCount: data.length,
          generatedAt: new Date().toISOString(),
        },
      });

      await job.progress(100);
      this.logger.log(`Report generated successfully for job ${job.id}`);

      return {
        success: true,
        reportSize: reportBuffer.length,
        recordCount: data.length,
      };
    } catch (error) {
      this.logger.error(`Failed to generate report for job ${job.id}`, error);
      throw error;
    }
  }

  private async fetchReportData(jobData: ReportJobData): Promise<unknown[]> {
    const { reportType, workspaceId, portalId, startDate, endDate } = jobData;

    this.logger.log(
      `Fetching report data for workspace ${workspaceId}, type: ${reportType}, period: ${startDate?.toISOString()} to ${endDate?.toISOString()}${portalId ? `, portal: ${portalId}` : ''}`,
    );

    const dateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };

    switch (reportType) {
      case 'analytics':
        // Fetch analytics events from audit logs
        return this.prisma.auditLog.findMany({
          where: {
            workspaceId,
            ...(Object.keys(dateFilter).length > 0 && {
              createdAt: dateFilter,
            }),
            action: {
              in: ['READ', 'CREATE', 'UPDATE'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });

      case 'audit':
        // Fetch audit logs
        return this.prisma.auditLog.findMany({
          where: {
            workspaceId,
            ...(Object.keys(dateFilter).length > 0 && {
              createdAt: dateFilter,
            }),
          },
          include: {
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });

      case 'performance':
        // Fetch performance metrics from widgets
        const widgets = await this.prisma.widget.findMany({
          where: {
            portal: {
              workspaceId,
              ...(portalId && { id: portalId }),
            },
          },
          include: {
            portal: { select: { name: true } },
            integration: { select: { provider: true } },
          },
        });

        return widgets.map((w) => ({
          widgetId: w.id,
          widgetName: w.name,
          portalName: w.portal.name,
          type: w.type,
          lastRefreshed: w.lastRefreshedAt,
          refreshInterval: w.refreshInterval,
          integrationProvider: w.integration?.provider,
        }));

      default:
        this.logger.warn(
          `Unknown report type: ${reportType}, returning empty data`,
        );
        return [];
    }
  }

  private async generateReport(
    data: unknown[],
    format: string,
  ): Promise<Buffer> {
    switch (format?.toLowerCase()) {
      case 'csv':
        return this.generateCSV(data);

      case 'excel':
      case 'xlsx':
        return this.generateExcel(data);

      case 'pdf':
        return this.generatePDF(data);

      case 'json':
      default:
        return Buffer.from(JSON.stringify(data, null, 2));
    }
  }

  private generateCSV(data: unknown[]): Buffer {
    if (data.length === 0) {
      return Buffer.from('No data available');
    }

    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const val = (row as Record<string, unknown>)[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object')
          return JSON.stringify(val).replace(/,/g, ';');
        return String(val).replace(/,/g, ';');
      });
      csvRows.push(values.join(','));
    }

    return Buffer.from(csvRows.join('\n'));
  }

  private async generateExcel(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');

    if (data.length === 0) {
      sheet.addRow(['No data available']);
      return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    const headers = Object.keys(data[0] as Record<string, unknown>);

    // Add headers with styling
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const val = (row as Record<string, unknown>)[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      sheet.addRow(values);
    }

    // Auto-fit columns
    sheet.columns.forEach((column) => {
      column.width = 20;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private generatePDF(data: unknown[]): Buffer {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text('Report', { align: 'center' });
      doc.moveDown();
      doc
        .fontSize(10)
        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown(2);

      if (data.length === 0) {
        doc.fontSize(12).text('No data available');
      } else {
        const headers = Object.keys(data[0] as Record<string, unknown>);

        // Simple table representation
        doc.fontSize(10);

        for (let i = 0; i < Math.min(data.length, 100); i++) {
          const row = data[i] as Record<string, unknown>;
          doc.text(`Record ${i + 1}:`, { underline: true });

          for (const header of headers) {
            const val = row[header];
            const displayVal =
              val === null || val === undefined
                ? 'N/A'
                : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val);
            doc.text(`  ${header}: ${displayVal}`);
          }

          doc.moveDown();

          // Add page break if needed
          if (doc.y > 700) {
            doc.addPage();
          }
        }

        if (data.length > 100) {
          doc.moveDown();
          doc.text(`... and ${data.length - 100} more records`);
        }
      }

      doc.end();
    }) as unknown as Buffer;
  }
}
