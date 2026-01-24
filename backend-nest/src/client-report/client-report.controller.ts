import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { ClientReportService } from './client-report.service';
import { ReportGeneratorService } from './report-generator.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportType, ClientReportStatus } from '@prisma/client';

@ApiTags('Client Reports')
@ApiBearerAuth()
@Controller('client-reports')
export class ClientReportController {
  constructor(
    private readonly clientReportService: ClientReportService,
    private readonly reportGenerator: ReportGeneratorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new client report' })
  async createReport(
    @Body()
    body: {
      workspaceId: string;
      projectId?: string;
      title: string;
      clientName: string;
      reportType: ReportType;
      recipientEmails: string[];
      scheduledFor?: string;
    },
  ) {
    return this.clientReportService.createReport({
      ...body,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all reports for a workspace' })
  async getReports(
    @Param('workspaceId') workspaceId: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: ClientReportStatus,
    @Query('clientName') clientName?: string,
  ) {
    return this.clientReportService.getReports(workspaceId, {
      ...(projectId && { projectId }),
      ...(status && { status }),
      ...(clientName && { clientName }),
    });
  }

  @Get(':reportId')
  @ApiOperation({ summary: 'Get report details' })
  async getReportById(@Param('reportId') reportId: string) {
    return this.clientReportService.getReportById(reportId);
  }

  @Patch(':reportId')
  @ApiOperation({ summary: 'Update report' })
  async updateReport(
    @Param('reportId') reportId: string,
    @Body()
    body: {
      title?: string;
      executiveSummary?: string;
      keyInsights?: any;
      metrics?: any;
      recommendations?: any;
      status?: ClientReportStatus;
    },
  ) {
    return this.clientReportService.updateReport(reportId, body);
  }

  @Delete(':reportId')
  @ApiOperation({ summary: 'Delete report' })
  async deleteReport(@Param('reportId') reportId: string) {
    return this.clientReportService.deleteReport(reportId);
  }

  @Post(':reportId/generate')
  @ApiOperation({ summary: 'Generate report with AI' })
  async generateReport(@Param('reportId') reportId: string) {
    return this.reportGenerator.generateReportOnDemand(reportId);
  }

  @Get('workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get report statistics' })
  async getReportStats(@Param('workspaceId') workspaceId: string) {
    return this.clientReportService.getReportStats(workspaceId);
  }
}
