import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { UsageMetricType, PeriodType } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get workspace dashboard overview' })
  @ApiResponse({ status: 200, description: 'Returns dashboard overview' })
  async getDashboardOverview(@Request() req: any) {
    return this.analyticsService.getDashboardOverview(req.user.workspaceId);
  }

  @Get('portal/:portalId')
  @ApiOperation({ summary: 'Get portal analytics' })
  @ApiResponse({ status: 200, description: 'Returns portal analytics' })
  async getPortalAnalytics(
    @Request() req: any,
    @Param('portalId') portalId: string,
  ) {
    return this.analyticsService.getPortalAnalytics(
      req.user.workspaceId,
      portalId,
    );
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get usage metrics' })
  @ApiResponse({ status: 200, description: 'Returns usage metrics' })
  async getMetrics(
    @Request() req: any,
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
  async getPerformanceMetrics(@Request() req: any) {
    return this.analyticsService.getPerformanceMetrics(req.user.workspaceId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get activity feed' })
  @ApiResponse({ status: 200, description: 'Returns activity feed' })
  async getActivityFeed(@Request() req: any, @Query('limit') limit?: number) {
    return this.analyticsService.getActivityFeed(
      req.user.workspaceId,
      limit ? parseInt(String(limit), 10) : 50,
    );
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending data' })
  @ApiResponse({ status: 200, description: 'Returns trending data' })
  async getTrendingData(@Request() req: any) {
    return this.analyticsService.getTrendingData(req.user.workspaceId);
  }

  @Post('track')
  @ApiOperation({ summary: 'Track a usage metric' })
  @ApiResponse({ status: 201, description: 'Metric recorded' })
  async trackMetric(
    @Request() req: any,
    @Body()
    body: {
      metricType: UsageMetricType;
      value: number;
      portalId?: string;
      widgetId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    await this.analyticsService.recordMetric(
      req.user.workspaceId,
      body.metricType,
      body.value,
      {
        portalId: body.portalId,
        widgetId: body.widgetId,
        userId: req.user.id,
        metadata: body.metadata,
      },
    );
    return { message: 'Metric recorded' };
  }
}
