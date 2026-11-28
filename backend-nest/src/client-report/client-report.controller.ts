import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportType, ClientReportStatus } from '@prisma/client';
import type { Request } from 'express';
import type { Response } from 'express';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingRoleGuard } from '../billing/billing-role.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import { ClientReportService } from './client-report.service';
import { ReportGeneratorService } from './report-generator.service';

@ApiTags('Client Reports')
@ApiBearerAuth()
@Controller('client-reports')
@UseGuards(JwtAuthGuard, AgencyRoleGuard, BillingRoleGuard)
export class ClientReportController {
  constructor(
    private readonly clientReportService: ClientReportService,
    private readonly reportGenerator: ReportGeneratorService,
  ) {}

  @Get('briefing-feature')
  @ApiOperation({ summary: 'Get client briefing approval feature state' })
  getBriefingFeatureState() {
    return { enabled: process.env.CLIENT_BRIEFINGS_ENABLED === 'true' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new client report' })
  async createReport(
    @Body()
    body: {
      projectId?: string;
      portalId?: string;
      title: string;
      clientName: string;
      reportType: ReportType;
      recipientEmails: string[];
      scheduledFor?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    if (!body.title?.trim() || body.title.length > 160)
      throw new BadRequestException('Title is required and must be 160 characters or fewer');
    if (!body.clientName?.trim() || body.clientName.length > 200)
      throw new BadRequestException('Client name is required');
    if (!Object.values(ReportType).includes(body.reportType))
      throw new BadRequestException('Unsupported report type');
    if (
      !Array.isArray(body.recipientEmails) ||
      body.recipientEmails.length > 50 ||
      body.recipientEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      throw new BadRequestException('Recipients must be valid email addresses');
    }
    return this.clientReportService.createReport({
      ...body,
      workspaceId: user.workspaceId,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });
  }

  @Get('project-options')
  @ApiOperation({ summary: 'List reportable projects in the authenticated workspace' })
  async getProjectOptions(@CurrentUser() user: RequestUser) {
    return this.clientReportService.getProjectOptions(user.workspaceId);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all reports for a workspace' })
  async getReports(
    @Param('workspaceId') workspaceId: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: ClientReportStatus,
    @Query('clientName') clientName?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    if (user?.workspaceId !== workspaceId) throw new ForbiddenException('Workspace access denied');
    return this.clientReportService.getReports(user.workspaceId, {
      ...(projectId && { projectId }),
      ...(status && { status }),
      ...(clientName && { clientName }),
    });
  }

  @Get(':reportId')
  @ApiOperation({ summary: 'Get report details' })
  async getReportById(@Param('reportId') reportId: string, @CurrentUser() user: RequestUser) {
    return this.clientReportService.getReportById(reportId, user.workspaceId);
  }

  @Patch(':reportId')
  @ApiOperation({ summary: 'Update report' })
  async updateReport(
    @Param('reportId') reportId: string,
    @Body()
    body: {
      title?: string;
      executiveSummary?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    if (body.title !== undefined && (!body.title.trim() || body.title.length > 160)) {
      throw new BadRequestException('Title must contain 1 to 160 characters');
    }
    if (body.executiveSummary !== undefined && body.executiveSummary.length > 20000) {
      throw new BadRequestException('Summary must be 20,000 characters or fewer');
    }
    return this.clientReportService.updateReport(reportId, user.workspaceId, {
      title: body.title,
      executiveSummary: body.executiveSummary,
    });
  }

  @Delete(':reportId')
  @ApiOperation({ summary: 'Delete report' })
  async deleteReport(@Param('reportId') reportId: string, @CurrentUser() user: RequestUser) {
    return this.clientReportService.deleteReport(reportId, user.workspaceId);
  }

  @Post(':reportId/generate')
  @ApiOperation({ summary: 'Generate a verified client briefing draft' })
  async generateReport(@Param('reportId') reportId: string, @CurrentUser() user: RequestUser) {
    return this.reportGenerator.generateReportOnDemand(reportId, user.workspaceId);
  }

  @Get(':reportId/preview')
  @ApiOperation({ summary: 'Preview the exact report content before approval' })
  async previewReport(@Param('reportId') reportId: string, @CurrentUser() user: RequestUser) {
    return this.reportGenerator.getPreview(reportId, user.workspaceId);
  }

  @Get(':reportId/revisions/:version/:format')
  @ApiOperation({ summary: 'Download an approved report revision as PDF or CSV' })
  async downloadRevision(
    @Param('reportId') reportId: string,
    @Param('version') versionValue: string,
    @Param('format') formatValue: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const version = Number(versionValue);
    if (!Number.isInteger(version) || version < 1) throw new BadRequestException('Invalid report version');
    if (formatValue !== 'pdf' && formatValue !== 'csv') throw new BadRequestException('Unsupported report format');
    const buffer = await this.reportGenerator.exportRevision(reportId, version, user.workspaceId, formatValue);
    response.set({
      'Content-Type': formatValue === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="report-${reportId}-v${version}.${formatValue}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(buffer);
  }

  @Post(':reportId/retry-delivery')
  @ApiOperation({ summary: 'Retry delivery of the consented approved revision' })
  async retryDelivery(@Param('reportId') reportId: string, @CurrentUser() user: RequestUser) {
    return this.reportGenerator.retryDelivery(reportId, user.workspaceId);
  }

  @Post(':reportId/revise')
  @ApiOperation({ summary: 'Create a new draft revision while preserving approved history' })
  async startRevision(@Param('reportId') reportId: string, @CurrentUser() user: RequestUser) {
    return this.clientReportService.startRevision(reportId, user.workspaceId, user.id, user.email);
  }

  @Post(':reportId/approve')
  @ApiOperation({ summary: 'Approve a verified briefing; notify only with explicit consent' })
  async approveReport(
    @Param('reportId') reportId: string,
    @Body() body: { notifyClient?: boolean; consentNote?: string },
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (process.env.CLIENT_BRIEFINGS_ENABLED !== 'true') {
      throw new NotFoundException('Briefing approvals are disabled');
    }
    if (body.notifyClient && (body.consentNote?.trim().length ?? 0) < 8) {
      throw new BadRequestException(
        'A consent note of at least 8 characters is required when notifying the client',
      );
    }
    if (body.consentNote && body.consentNote.trim().length > 500) {
      throw new BadRequestException('Consent note must be 500 characters or fewer');
    }
    return this.reportGenerator.approveBriefing({
      reportId,
      workspaceId: user.workspaceId,
      userId: user.id,
      userEmail: user.email,
      notifyClient: body.notifyClient === true,
      consentNote: body.consentNote?.trim(),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get('workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get report statistics' })
  async getReportStats(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.workspaceId !== workspaceId) throw new ForbiddenException('Workspace access denied');
    return this.clientReportService.getReportStats(user.workspaceId);
  }
}
