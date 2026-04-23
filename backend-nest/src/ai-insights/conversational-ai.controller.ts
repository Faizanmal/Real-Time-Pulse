import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { AuthenticatedRequest, RequestUser } from '../common/interfaces/auth.interface';

import {
  ConversationalAIService,
  ConversationContext,
  ConversationMessage,
} from './conversational-ai.service';

interface QueryRequestDto {
  query: string;
  portalId?: string;
  context?: {
    activeFilters?: Record<string, any>;
  };
}

interface AskDataDto {
  question: string;
  data: any;
  portalId?: string;
}

interface DataStoryDto {
  metrics: Array<{ name: string; value: number; previousValue?: number }>;
}

@Controller('ai/conversation')
@UseGuards(JwtAuthGuard)
export class ConversationalAIController {
  constructor(private readonly conversationalAIService: ConversationalAIService) {}

  /**
   * Process a natural language query
   */
  @Post('query')
  async processQuery(@Body() dto: QueryRequestDto, @CurrentUser() user: RequestUser) {
    const context: ConversationContext = {
      workspaceId: user.workspaceId,
      userId: user.id,
      portalId: dto.portalId,
      recentMessages: await this.getRecentMessages(user.workspaceId, user.id),
      availableDataSources: this.getAvailableDataSources(user.workspaceId),
      activeFilters: dto.context?.activeFilters,
    };

    return this.conversationalAIService.processQuery(dto.query, context);
  }

  /**
   * Get proactive insights
   */
  @Get('insights')
  async getProactiveInsights(@CurrentUser() user: RequestUser) {
    return this.conversationalAIService.getProactiveInsights(user.workspaceId, user.id);
  }

  /**
   * Get conversation history
   */
  @Get('history')
  async getConversationHistory(@Query('limit') limit: string, @CurrentUser() user: RequestUser) {
    const limitNum = parseInt(limit, 10) || 20;
    return this.conversationalAIService.getConversationHistory(user.workspaceId, user.id, limitNum);
  }

  /**
   * Ask a question about specific data
   */
  @Post('ask')
  async askAboutData(@Body() dto: AskDataDto, @Req() req: any) {
    const context: ConversationContext = {
      workspaceId: req.user.workspaceId,
      userId: req.user.id,
      portalId: dto.portalId,
      recentMessages: [],
      availableDataSources: [],
    };

    const answer = await this.conversationalAIService.askAboutData(dto.question, dto.data, context);

    return { answer };
  }

  /**
   * Generate a data story
   */
  @Post('story')
  async generateDataStory(@Body() dto: DataStoryDto, @Req() req: Request & AuthenticatedRequest) {
    return this.conversationalAIService.generateDataStory(req.user.workspaceId, dto.metrics);
  }

  /**
   * Get suggested questions based on current context
   */
  @Get('suggestions')
  getSuggestions(
    @Query('portalId') _portalId: string,
    @Req() _req: Request & AuthenticatedRequest,
  ) {
    const suggestions = [
      'Show me the top performing metrics this week',
      'What are the main trends in my data?',
      'Compare this month vs last month',
      'Which areas need attention?',
      'What is driving the change in revenue?',
      'Show anomalies in recent data',
      "Forecast next week's performance",
      'What are the correlations between my metrics?',
    ];

    return { suggestions };
  }

  // Helper methods
  private async getRecentMessages(
    workspaceId: string,
    userId: string,
  ): Promise<ConversationMessage[]> {
    return this.conversationalAIService.getConversationHistory(workspaceId, userId, 10);
  }

  private getAvailableDataSources(_workspaceId: string): string[] {
    // This would typically query the database for active integrations
    return ['GOOGLE_ANALYTICS', 'HUBSPOT', 'SALESFORCE', 'SHOPIFY', 'STRIPE', 'JIRA', 'GITHUB'];
  }
}
