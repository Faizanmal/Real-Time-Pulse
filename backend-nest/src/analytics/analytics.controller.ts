import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsageMetricType, PeriodType } from '@prisma/client';
import type { Response } from 'express';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/auth.interface';

import { AnalyticsService } from './analytics.service';
import { MetricProvenanceService } from './metric-provenance.service';
import { RecordProductTelemetryDto } from './product-analytics.dto';
import { ProductAnalyticsService } from './product-analytics.service';
import { CreateValueLedgerInput, ValueLedgerService } from './value-ledger.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricProvenance: MetricProvenanceService,
    private readonly valueLedger: ValueLedgerService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  @Get('metric-catalog')
  @UseGuards(AgencyRoleGuard)
  async getMetricCatalog(@Request() req: AuthenticatedRequest) {
    return this.metricProvenance.listCatalog(req.user.workspaceId);
  }

  @Get('metric-mappings')
  @UseGuards(AgencyRoleGuard)
  async getMetricMappings(@Request() req: AuthenticatedRequest) {
    return this.metricProvenance.listMappings(req.user.workspaceId);
  }

  @Post('metric-mappings')
  @UseGuards(AgencyRoleGuard)
  async createMetricMapping(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      portalId: string;
      integrationId: string;
      metricDefinitionId: string;
      displayName: string;
      clientVisible?: boolean;
      allowSourceDrilldown?: boolean;
      targetValue?: number;
      targetUnit?: string;
    },
  ) {
    return this.metricProvenance.createMapping(req.user.workspaceId, body);
  }

  @Post('metric-mappings/:id/reprocess')
  @UseGuards(AgencyRoleGuard)
  async reprocessMetric(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.metricProvenance.reprocess(req.user.workspaceId, req.user.id, id, body.reason);
  }

  @Post('metric-mappings/:id/milestones')
  @UseGuards(AgencyRoleGuard)
  async createMetricMilestone(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; targetValue: number; targetDate: string },
  ) {
    return this.metricProvenance.createMilestone(req.user.workspaceId, id, body);
  }

  @Get('value-ledger')
  @UseGuards(AgencyRoleGuard)
  async getValueLedger(@Request() req: AuthenticatedRequest, @Query('portalId') portalId: string) {
    return this.valueLedger.list(req.user.workspaceId, req.user.id, portalId);
  }

  @Post('value-ledger')
  @UseGuards(AgencyRoleGuard)
  async createValueLedgerDraft(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateValueLedgerInput,
  ) {
    return this.valueLedger.createDraft(req.user.workspaceId, req.user.id, body);
  }

  @Post('value-ledger/:id/approve')
  @UseGuards(AgencyRoleGuard)
  async approveValueLedgerEntry(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { expectedRevision: number; clientVisible: boolean },
  ) {
    return this.valueLedger.approve(
      req.user.workspaceId,
      req.user.id,
      id,
      body.expectedRevision,
      body.clientVisible,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get workspace dashboard overview' })
  @ApiResponse({ status: 200, description: 'Returns dashboard overview' })
  async getDashboardOverview(@Request() req: AuthenticatedRequest) {
    return this.analyticsService.getDashboardOverview(req.user.workspaceId);
  }

  @Get('portal/:portalId')
  @ApiOperation({ summary: 'Get portal analytics' })
  @ApiResponse({ status: 200, description: 'Returns portal analytics' })
  async getPortalAnalytics(
    @Request() req: AuthenticatedRequest,
    @Param('portalId') portalId: string,
  ) {
    return this.analyticsService.getPortalAnalytics(req.user.workspaceId, portalId);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get usage metrics' })
  @ApiResponse({ status: 200, description: 'Returns usage metrics' })
  async getMetrics(
    @Request() req: AuthenticatedRequest,
    @Query('metricType') metricType?: UsageMetricType,
    @Query('portalId') portalId?: string,
    @Query('periodType') periodType?: PeriodType,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getMetrics(req.user.workspaceId, {
      metricType,
      portalId,
      periodType,
      days: days ? parseInt(String(days), 10) : 30,
    });
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({ status: 200, description: 'Returns performance metrics' })
  async getPerformanceMetrics(@Request() req: AuthenticatedRequest) {
    return this.analyticsService.getPerformanceMetrics(req.user.workspaceId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get activity feed' })
  @ApiResponse({ status: 200, description: 'Returns activity feed' })
  async getActivityFeed(@Request() req: AuthenticatedRequest, @Query('limit') limit?: number) {
    return this.analyticsService.getActivityFeed(
      req.user.workspaceId,
      limit ? parseInt(String(limit), 10) : 50,
    );
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending data' })
  @ApiResponse({ status: 200, description: 'Returns trending data' })
  async getTrendingData(@Request() req: AuthenticatedRequest) {
    return this.analyticsService.getTrendingData(req.user.workspaceId);
  }

  @Post('track')
  @ApiOperation({ summary: 'Track a usage metric' })
  @ApiResponse({ status: 201, description: 'Metric recorded' })
  async trackMetric(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      metricType: UsageMetricType;
      value: number;
      portalId?: string;
      widgetId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    await this.analyticsService.recordMetric(req.user.workspaceId, body.metricType, body.value, {
      portalId: body.portalId,
      widgetId: body.widgetId,
      userId: req.user.id,
      metadata: body.metadata,
    });
    return { message: 'Metric recorded' };
  }

  @Post('product-events')
  @UseGuards(AgencyRoleGuard)
  @ApiOperation({ summary: 'Record a tenant-scoped, idempotent product or cost event' })
  async recordProductEvent(
    @Request() req: AuthenticatedRequest,
    @Body() body: RecordProductTelemetryDto,
  ) {
    return this.productAnalytics.record(req.user.workspaceId, body);
  }

  @Get('product-analytics')
  @UseGuards(AgencyRoleGuard)
  @ApiOperation({ summary: 'Get feature adoption, guardrail, cost and experiment summaries' })
  async getProductAnalytics(@Request() req: AuthenticatedRequest, @Query('days') days?: string) {
    return this.productAnalytics.summary(
      req.user.workspaceId,
      days === undefined ? 30 : Number(days),
    );
  }

  @Get('product-analytics/experiments.csv')
  @UseGuards(AgencyRoleGuard)
  @ApiOperation({ summary: 'Export aggregated experiment results for this workspace as CSV' })
  async exportExperimentResults(
    @Request() req: AuthenticatedRequest,
    @Query('days') days: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.productAnalytics.exportExperimentsCsv(
      req.user.workspaceId,
      days === undefined ? 30 : Number(days),
    );
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="experiment-results.csv"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(csv);
  }
}
