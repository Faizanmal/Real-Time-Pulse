import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { DataValidationService } from './data-validation.service';
import { ValidationEngineService } from './validation-engine.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';

@ApiTags('Data Validation')
@ApiBearerAuth()
@Controller('data-validation')
export class DataValidationController {
  constructor(
    private readonly dataValidationService: DataValidationService,
    private readonly validationEngine: ValidationEngineService,
  ) {}

  @Post('rules')
  @ApiOperation({ summary: 'Create a validation rule' })
  async createRule(
    @Body()
    body: {
      workspaceId: string;
      name: string;
      description?: string;
      integrationId?: string;
      dataSource?: string;
      fieldPath: string;
      ruleType: ValidationRuleType;
      config: any;
      severity?: ValidationSeverity;
      notifyOnFailure?: boolean;
      notifyEmails?: string[];
    },
  ) {
    return this.dataValidationService.createRule(body);
  }

  @Get('rules/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all validation rules for a workspace' })
  async getRules(
    @Param('workspaceId') workspaceId: string,
    @Query('enabled') enabled?: string,
  ) {
    return this.dataValidationService.getRules(workspaceId, {
      ...(enabled && { enabled: enabled === 'true' }),
    });
  }

  @Get('rules/:ruleId')
  @ApiOperation({ summary: 'Get validation rule details' })
  async getRuleById(@Param('ruleId') ruleId: string) {
    return this.dataValidationService.getRuleById(ruleId);
  }

  @Patch('rules/:ruleId')
  @ApiOperation({ summary: 'Update validation rule' })
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      enabled?: boolean;
      config?: any;
      severity?: ValidationSeverity;
      notifyOnFailure?: boolean;
      notifyEmails?: string[];
    },
  ) {
    return this.dataValidationService.updateRule(ruleId, body);
  }

  @Delete('rules/:ruleId')
  @ApiOperation({ summary: 'Delete validation rule' })
  async deleteRule(@Param('ruleId') ruleId: string) {
    return this.dataValidationService.deleteRule(ruleId);
  }

  @Get('violations/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get violations for a workspace' })
  async getViolations(
    @Param('workspaceId') workspaceId: string,
    @Query('resolved') resolved?: string,
    @Query('severity') severity?: ValidationSeverity,
    @Query('ruleId') ruleId?: string,
  ) {
    return this.dataValidationService.getViolations(workspaceId, {
      ...(resolved && { resolved: resolved === 'true' }),
      ...(severity && { severity }),
      ...(ruleId && { ruleId }),
    });
  }

  @Patch('violations/:violationId/resolve')
  @ApiOperation({ summary: 'Resolve a violation' })
  async resolveViolation(
    @Param('violationId') violationId: string,
    @Body() body: { resolvedBy: string; notes?: string },
  ) {
    return this.dataValidationService.resolveViolation(
      violationId,
      body.resolvedBy,
      body.notes,
    );
  }

  @Get('violations/workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get violation statistics' })
  async getViolationStats(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    return this.dataValidationService.getViolationStats(
      workspaceId,
      days ? parseInt(days) : 7,
    );
  }

  @Post('validate-on-demand')
  @ApiOperation({ summary: 'Validate data on demand' })
  async validateOnDemand(
    @Body()
    body: {
      workspaceId: string;
      data: any;
      fieldPath: string;
    },
  ) {
    return this.validationEngine.validateDataOnDemand(
      body.workspaceId,
      body.data,
      body.fieldPath,
    );
  }
}
