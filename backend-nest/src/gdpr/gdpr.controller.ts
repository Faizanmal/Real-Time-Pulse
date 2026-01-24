import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { ComplianceService } from './compliance.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  ConsentType,
  GDPRRequestType,
  GDPRRequestStatus,
  ComplianceReportType,
} from '@prisma/client';

@ApiTags('GDPR Compliance')
@ApiBearerAuth()
@Controller('gdpr')
export class GdprController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly complianceService: ComplianceService,
  ) {}

  // Consent Management
  @Post('consents')
  @ApiOperation({ summary: 'Record user consent' })
  async recordConsent(
    @Body()
    body: {
      workspaceId: string;
      userId?: string;
      subjectEmail: string;
      subjectName?: string;
      consentType: ConsentType;
      purpose: string;
      consented: boolean;
      ipAddress?: string;
      userAgent?: string;
      expiresAt?: string;
    },
  ) {
    return this.gdprService.recordConsent({
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Patch('consents/:consentId/revoke')
  @ApiOperation({ summary: 'Revoke consent' })
  async revokeConsent(@Param('consentId') consentId: string, @Body() body: { reason?: string }) {
    return this.gdprService.revokeConsent(consentId, body.reason);
  }

  @Get('consents/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all consents for a workspace' })
  async getConsents(
    @Param('workspaceId') workspaceId: string,
    @Query('subjectEmail') subjectEmail?: string,
    @Query('consentType') consentType?: ConsentType,
    @Query('consented') consented?: string,
  ) {
    return this.gdprService.getConsents(workspaceId, {
      ...(subjectEmail && { subjectEmail }),
      ...(consentType && { consentType }),
      ...(consented && { consented: consented === 'true' }),
    });
  }

  @Get('consents/:consentId')
  @ApiOperation({ summary: 'Get consent details' })
  async getConsentById(@Param('consentId') consentId: string) {
    return this.gdprService.getConsentById(consentId);
  }

  @Get('consents/workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get consent statistics' })
  async getConsentStats(@Param('workspaceId') workspaceId: string) {
    return this.gdprService.getConsentStats(workspaceId);
  }

  // Data Requests
  @Post('requests')
  @ApiOperation({ summary: 'Create GDPR data request' })
  async createDataRequest(
    @Body()
    body: {
      workspaceId: string;
      requesterEmail: string;
      requesterName?: string;
      requestType: GDPRRequestType;
    },
  ) {
    return this.gdprService.createDataRequest(body);
  }

  @Get('requests/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all data requests for a workspace' })
  async getDataRequests(
    @Param('workspaceId') workspaceId: string,
    @Query('requesterEmail') requesterEmail?: string,
    @Query('requestType') requestType?: GDPRRequestType,
    @Query('status') status?: GDPRRequestStatus,
  ) {
    return this.gdprService.getDataRequests(workspaceId, {
      ...(requesterEmail && { requesterEmail }),
      ...(requestType && { requestType }),
      ...(status && { status }),
    });
  }

  @Get('requests/:requestId')
  @ApiOperation({ summary: 'Get data request details' })
  async getDataRequestById(@Param('requestId') requestId: string) {
    return this.gdprService.getDataRequestById(requestId);
  }

  @Patch('requests/:requestId/status')
  @ApiOperation({ summary: 'Update data request status' })
  async updateDataRequestStatus(
    @Param('requestId') requestId: string,
    @Body()
    body: {
      status: GDPRRequestStatus;
      performedBy?: string;
      notes?: string;
    },
  ) {
    return this.gdprService.updateDataRequestStatus(
      requestId,
      body.status,
      body.performedBy,
      body.notes,
    );
  }

  @Post('requests/:requestId/process-access')
  @ApiOperation({ summary: 'Process data access request' })
  async processAccessRequest(
    @Param('requestId') requestId: string,
    @Body() body: { performedBy: string },
  ) {
    return this.gdprService.processDataAccessRequest(requestId, body.performedBy);
  }

  @Post('requests/:requestId/process-erasure')
  @ApiOperation({ summary: 'Process data erasure request' })
  async processErasureRequest(
    @Param('requestId') requestId: string,
    @Body() body: { performedBy: string },
  ) {
    return this.gdprService.processDataErasureRequest(requestId, body.performedBy);
  }

  @Get('requests/workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get data request statistics' })
  async getDataRequestStats(@Param('workspaceId') workspaceId: string) {
    return this.gdprService.getDataRequestStats(workspaceId);
  }

  // Compliance Reporting
  @Post('compliance/reports/generate')
  @ApiOperation({ summary: 'Generate compliance report' })
  async generateComplianceReport(
    @Body()
    body: {
      workspaceId: string;
      reportType: ComplianceReportType;
      generatedBy?: string;
    },
  ) {
    return this.complianceService.generateComplianceReport(
      body.workspaceId,
      body.reportType,
      body.generatedBy,
    );
  }

  @Get('compliance/reports/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get compliance reports' })
  async getComplianceReports(
    @Param('workspaceId') workspaceId: string,
    @Query('reportType') reportType?: ComplianceReportType,
  ) {
    return this.complianceService.getComplianceReports(workspaceId, {
      ...(reportType && { reportType }),
    });
  }

  @Get('compliance/reports/:reportId')
  @ApiOperation({ summary: 'Get compliance report details' })
  async getComplianceReportById(@Param('reportId') reportId: string) {
    return this.complianceService.getComplianceReportById(reportId);
  }

  @Get('compliance/dashboard/:workspaceId')
  @ApiOperation({ summary: 'Get compliance dashboard' })
  async getComplianceDashboard(@Param('workspaceId') workspaceId: string) {
    return this.complianceService.getComplianceDashboard(workspaceId);
  }
}
