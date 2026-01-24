import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { DataHealthService } from './data-health.service';
import { HealthMonitorService } from './health-monitor.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Data Health')
@ApiBearerAuth()
@Controller('data-health')
export class DataHealthController {
  constructor(
    private readonly dataHealthService: DataHealthService,
    private readonly healthMonitorService: HealthMonitorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create health monitor for an integration' })
  async createHealthMonitor(
    @Body()
    body: {
      workspaceId: string;
      integrationId: string;
      freshnessThreshold?: number;
      alertThreshold?: number;
    },
  ) {
    return this.dataHealthService.createHealthMonitor(body);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all health monitors for a workspace' })
  async getWorkspaceHealth(@Param('workspaceId') workspaceId: string) {
    return this.dataHealthService.getHealthStatus(workspaceId);
  }

  @Get(':healthId')
  @ApiOperation({ summary: 'Get detailed health information' })
  async getHealthDetails(@Param('healthId') healthId: string) {
    return this.dataHealthService.getHealthById(healthId);
  }

  @Post(':healthId/check')
  @ApiOperation({ summary: 'Manually trigger a health check' })
  async triggerHealthCheck(@Param('healthId') healthId: string) {
    return this.healthMonitorService.performHealthCheck(healthId);
  }

  @Get('workspace/:workspaceId/metrics')
  @ApiOperation({ summary: 'Get health metrics for workspace' })
  async getHealthMetrics(@Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    return this.dataHealthService.getHealthMetrics(workspaceId, days ? parseInt(days) : 7);
  }

  @Patch(':healthId/settings')
  @ApiOperation({ summary: 'Update alert settings' })
  async updateAlertSettings(
    @Param('healthId') healthId: string,
    @Body()
    settings: {
      alertsEnabled?: boolean;
      alertThreshold?: number;
      freshnessThreshold?: number;
    },
  ) {
    return this.dataHealthService.updateAlertSettings(healthId, settings);
  }

  @Post(':healthId/acknowledge-schema-change')
  @ApiOperation({ summary: 'Acknowledge schema change' })
  async acknowledgeSchemaChange(@Param('healthId') healthId: string) {
    return this.dataHealthService.acknowledgeSchemaChange(healthId);
  }

  @Get('workspace/:workspaceId/degraded')
  @ApiOperation({ summary: 'Get degraded/down data sources' })
  async getDegradedSources(@Param('workspaceId') workspaceId: string) {
    return this.dataHealthService.getDegradedSources(workspaceId);
  }
}
