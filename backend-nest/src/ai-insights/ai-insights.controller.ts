import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AIInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('AI Insights')
@Controller('ai-insights')
@UseGuards(JwtAuthGuard)
export class AIInsightsController {
  constructor(private readonly aiInsightsService: AIInsightsService) {}

  /**
   * Get all insights for a workspace
   */
  @Get()
  @ApiOperation({ summary: 'Get workspace insights' })
  async getWorkspaceInsights(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.aiInsightsService.getWorkspaceInsights(user.workspaceId, status, type);
  }

  /**
   * Get insights for a specific portal
   */
  @Get('portal/:portalId')
  @ApiOperation({ summary: 'Get portal-specific insights' })
  async getPortalInsights(@Param('portalId') portalId: string, @CurrentUser() user: RequestUser) {
    return this.aiInsightsService.getPortalInsights(portalId, user.workspaceId);
  }

  /**
   * Generate new insights for a portal
   */
  @Post('portal/:portalId/generate')
  @ApiOperation({ summary: 'Generate AI insights for portal' })
  async generateInsights(@Param('portalId') portalId: string, @CurrentUser() user: RequestUser) {
    return this.aiInsightsService.generateInsights(portalId, user.workspaceId);
  }

  /**
   * Generate predictive insights for a portal
   */
  @Post('portal/:portalId/predict')
  @ApiOperation({ summary: 'Generate predictive insights for portal' })
  async generatePredictiveInsights(
    @Param('portalId') portalId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.aiInsightsService.generatePredictiveInsights(portalId, user.workspaceId);
  }

  /**
   * Natural language query
   */
  @Post('query')
  @ApiOperation({ summary: 'Ask AI about your workspace data' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language question' },
        portalId: { type: 'string', description: 'Optional portal context' },
      },
      required: ['query'],
    },
  })
  async processQuery(
    @Body() body: { query: string; portalId?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.aiInsightsService.processNaturalLanguageQuery(user.workspaceId, body);
  }

  /**
   * Dismiss an insight
   */
  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss an insight' })
  async dismissInsight(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.aiInsightsService.dismissInsight(id, user.id);
  }

  /**
   * Mark insight as actioned
   */
  @Patch(':id/action')
  @ApiOperation({ summary: 'Mark insight as actioned' })
  async actionInsight(@Param('id') id: string) {
    return this.aiInsightsService.actionInsight(id);
  }
}
