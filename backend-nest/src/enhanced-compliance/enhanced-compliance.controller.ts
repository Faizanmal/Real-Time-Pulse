import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnhancedComplianceService } from './enhanced-compliance.service';
import {
  DataSensitivity,
  IncidentSeverity,
  IncidentCategory,
  IncidentStatus,
} from '@prisma/client';

@Controller('enhanced-compliance')
@UseGuards(JwtAuthGuard)
export class EnhancedComplianceController {
  constructor(private readonly enhancedComplianceService: EnhancedComplianceService) {}

  // Frameworks
  @Get('frameworks')
  async getFrameworks() {
    return this.enhancedComplianceService.getFrameworks();
  }

  @Get('frameworks/:id')
  async getFramework(@Param('id') id: string) {
    return this.enhancedComplianceService.getFramework(id);
  }

  @Post('frameworks')
  async createFramework(
    @Body()
    data: {
      name: string;
      description?: string;
      requirements: any;
      controls: any;
      auditSchedule?: string;
    },
  ) {
    return this.enhancedComplianceService.createFramework(data);
  }

  // Assessments
  @Post('assessments')
  async createAssessment(@Req() req: any, @Body() data: { frameworkId: string }) {
    return this.enhancedComplianceService.createAssessment(
      req.user.workspaceId,
      data.frameworkId,
      req.user.email,
    );
  }

  @Get('assessments')
  async getAssessments(@Req() req: any, @Query('frameworkId') frameworkId?: string) {
    return this.enhancedComplianceService.getAssessments(req.user.workspaceId, frameworkId);
  }

  @Get('assessments/:id')
  async getAssessment(@Param('id') id: string, @Req() req: any) {
    return this.enhancedComplianceService.getAssessment(id, req.user.workspaceId);
  }

  @Patch('assessments/:id/remediation')
  async updateRemediationPlan(
    @Param('id') id: string,
    @Req() req: any,
    @Body() data: { remediationPlan: any; remediationStatus: string },
  ) {
    return this.enhancedComplianceService.updateRemediationPlan(
      id,
      req.user.workspaceId,
      data.remediationPlan,
      data.remediationStatus,
    );
  }

  // Data Mapping
  @Post('data-mappings')
  async createDataMapping(
    @Req() req: any,
    @Body()
    data: {
      dataType: string;
      location: string;
      fields: any;
      sensitivity: DataSensitivity;
      category: string;
      processingPurpose: string;
      legalBasis?: string;
      retentionPeriod?: string;
      encryptionMethod?: string;
      accessControls?: any;
    },
  ) {
    return this.enhancedComplianceService.createDataMapping(req.user.workspaceId, data);
  }

  @Get('data-mappings')
  async getDataMappings(@Req() req: any, @Query('sensitivity') sensitivity?: DataSensitivity) {
    return this.enhancedComplianceService.getDataMappings(req.user.workspaceId, sensitivity);
  }

  @Get('data-mappings/:id')
  async getDataMapping(@Param('id') id: string, @Req() req: any) {
    return this.enhancedComplianceService.getDataMapping(id, req.user.workspaceId);
  }

  @Patch('data-mappings/:id')
  async updateDataMapping(@Param('id') id: string, @Req() req: any, @Body() data: any) {
    return this.enhancedComplianceService.updateDataMapping(id, req.user.workspaceId, data);
  }

  @Delete('data-mappings/:id')
  async deleteDataMapping(@Param('id') id: string, @Req() req: any) {
    return this.enhancedComplianceService.deleteDataMapping(id, req.user.workspaceId);
  }

  // Security Incidents
  @Post('incidents')
  async createIncident(
    @Req() req: any,
    @Body()
    data: {
      title: string;
      description: string;
      severity: IncidentSeverity;
      category: IncidentCategory;
      affectedSystems?: any;
      affectedUsers?: any;
      assignedTo?: string;
    },
  ) {
    return this.enhancedComplianceService.createIncident(req.user.workspaceId, data);
  }

  @Get('incidents')
  async getIncidents(
    @Req() req: any,
    @Query('severity') severity?: IncidentSeverity,
    @Query('status') status?: IncidentStatus,
    @Query('category') category?: IncidentCategory,
  ) {
    return this.enhancedComplianceService.getIncidents(req.user.workspaceId, {
      severity,
      status,
      category,
    });
  }

  @Get('incidents/:id')
  async getIncident(@Param('id') id: string, @Req() req: any) {
    return this.enhancedComplianceService.getIncident(id, req.user.workspaceId);
  }

  @Patch('incidents/:id')
  async updateIncident(@Param('id') id: string, @Req() req: any, @Body() data: any) {
    return this.enhancedComplianceService.updateIncident(id, req.user.workspaceId, data);
  }

  // Dashboard
  @Get('dashboard')
  async getComplianceDashboard(@Req() req: any) {
    return this.enhancedComplianceService.getComplianceDashboard(req.user.workspaceId);
  }
}
