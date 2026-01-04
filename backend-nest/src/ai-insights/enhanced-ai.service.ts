/**
 * =============================================================================
 * REAL-TIME PULSE - ENHANCED AI INSIGHTS SERVICE
 * =============================================================================
 *
 * Advanced AI service with:
 * - Streaming responses for real-time UI updates
 * - Multi-provider support (OpenAI + Anthropic fallback)
 * - User feedback loop for recommendation improvement
 * - Context-aware prompt engineering
 * - Response caching and rate limiting
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AIProvider {
  name: string;
  priority: number;
  isAvailable: boolean;
  generateResponse(prompt: string, options: GenerationOptions): Promise<string>;
  generateStreamingResponse(
    prompt: string,
    options: GenerationOptions,
  ): AsyncGenerator<string>;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
  context?: Record<string, unknown>;
}

export interface StreamChunk {
  type: 'text' | 'error' | 'complete';
  content: string;
  provider?: string;
  timestamp: number;
}

export interface FeedbackData {
  insightId: string;
  userId: string;
  rating: 'helpful' | 'not_helpful' | 'neutral';
  comment?: string;
  actionTaken?: string;
}

export interface InsightFeedbackSummary {
  insightId: string;
  totalFeedback: number;
  helpfulCount: number;
  notHelpfulCount: number;
  averageScore: number;
  recentComments: string[];
}

// ============================================================================
// ENHANCED AI SERVICE
// ============================================================================

@Injectable()
export class EnhancedAIService {
  private readonly logger = new Logger(EnhancedAIService.name);
  private readonly providers: AIProvider[] = [];
  private readonly responseCache = new Map<
    string,
    { response: string; timestamp: number }
  >();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeProviders();
  }

  // ============================================================================
  // PROVIDER INITIALIZATION
  // ============================================================================

  private initializeProviders(): void {
    const openAIKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    // OpenAI Provider (Primary)
    if (openAIKey) {
      this.providers.push({
        name: 'openai',
        priority: 1,
        isAvailable: true,
        generateResponse: (prompt, options) =>
          this.openAIGenerate(prompt, options, openAIKey),
        generateStreamingResponse: (prompt, options) =>
          this.openAIStream(prompt, options, openAIKey),
      });
      this.logger.log('OpenAI provider initialized');
    }

    // Anthropic Provider (Fallback)
    if (anthropicKey) {
      this.providers.push({
        name: 'anthropic',
        priority: 2,
        isAvailable: true,
        generateResponse: (prompt, options) =>
          this.anthropicGenerate(prompt, options, anthropicKey),
        generateStreamingResponse: (prompt, options) =>
          this.anthropicStream(prompt, options, anthropicKey),
      });
      this.logger.log('Anthropic provider initialized');
    }

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);

    if (this.providers.length === 0) {
      this.logger.warn(
        'No AI providers configured. AI features will be limited.',
      );
    }
  }

  // ============================================================================
  // MULTI-PROVIDER GENERATION
  // ============================================================================

  /**
   * Generate response with automatic failover between providers
   */
  async generate(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    // Check cache first
    const cacheKey = this.getCacheKey(prompt, options);
    const cached = this.responseCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.logger.debug('Returning cached AI response');
      return cached.response;
    }

    // Try each provider in priority order
    for (const provider of this.providers.filter((p) => p.isAvailable)) {
      try {
        this.logger.debug(`Attempting generation with ${provider.name}`);
        const response = await provider.generateResponse(prompt, options);

        // Cache successful response
        this.responseCache.set(cacheKey, {
          response,
          timestamp: Date.now(),
        });

        // Emit success event
        this.eventEmitter.emit('ai.generation.success', {
          provider: provider.name,
          promptLength: prompt.length,
          responseLength: response.length,
        });

        return response;
      } catch (error) {
        this.logger.warn(
          `${provider.name} generation failed, trying next provider`,
          error instanceof Error ? error.message : 'Unknown error',
        );

        // Mark provider as temporarily unavailable
        this.handleProviderError(provider, error);
      }
    }

    // All providers failed
    this.eventEmitter.emit('ai.generation.failed', {
      prompt: prompt.substring(0, 100),
    });
    return this.getFallbackResponse(prompt);
  }

  /**
   * Stream response with automatic failover
   */
  async *stream(
    prompt: string,
    options: GenerationOptions = {},
  ): AsyncGenerator<StreamChunk> {
    for (const provider of this.providers.filter((p) => p.isAvailable)) {
      try {
        this.logger.debug(`Starting streaming with ${provider.name}`);

        yield {
          type: 'text',
          content: '',
          provider: provider.name,
          timestamp: Date.now(),
        };

        for await (const chunk of provider.generateStreamingResponse(
          prompt,
          options,
        )) {
          yield {
            type: 'text',
            content: chunk,
            provider: provider.name,
            timestamp: Date.now(),
          };
        }

        yield {
          type: 'complete',
          content: '',
          provider: provider.name,
          timestamp: Date.now(),
        };

        return;
      } catch (error) {
        this.logger.warn(
          `${provider.name} streaming failed, trying next provider`,
        );
        this.handleProviderError(provider, error);

        yield {
          type: 'error',
          content: `${provider.name} failed, switching providers...`,
          provider: provider.name,
          timestamp: Date.now(),
        };
      }
    }

    yield {
      type: 'error',
      content: 'All AI providers are currently unavailable',
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // OPENAI IMPLEMENTATION
  // ============================================================================

  private async openAIGenerate(
    prompt: string,
    options: GenerationOptions,
    apiKey: string,
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages: [
          ...(options.systemPrompt
            ? [{ role: 'system', content: options.systemPrompt }]
            : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async *openAIStream(
    prompt: string,
    options: GenerationOptions,
    apiKey: string,
  ): AsyncGenerator<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages: [
          ...(options.systemPrompt
            ? [{ role: 'system', content: options.systemPrompt }]
            : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  }

  // ============================================================================
  // ANTHROPIC IMPLEMENTATION
  // ============================================================================

  private async anthropicGenerate(
    prompt: string,
    options: GenerationOptions,
    apiKey: string,
  ): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-haiku-20240307',
        max_tokens: options.maxTokens || 1000,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  private async *anthropicStream(
    prompt: string,
    options: GenerationOptions,
    apiKey: string,
  ): AsyncGenerator<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-haiku-20240307',
        max_tokens: options.maxTokens || 1000,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'content_block_delta') {
              yield parsed.delta?.text || '';
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  }

  // ============================================================================
  // USER FEEDBACK LOOP
  // ============================================================================

  /**
   * Record user feedback on AI insights
   */
  async recordFeedback(feedback: FeedbackData): Promise<void> {
    await this.prisma.aIFeedback.create({
      data: {
        insightId: feedback.insightId,
        userId: feedback.userId,
        rating: feedback.rating,
        comment: feedback.comment,
        actionTaken: feedback.actionTaken,
        createdAt: new Date(),
      },
    });

    // Emit event for analytics
    this.eventEmitter.emit('ai.feedback.recorded', feedback);

    // Update insight quality score
    await this.updateInsightQualityScore(feedback.insightId);

    this.logger.log(
      `Feedback recorded for insight ${feedback.insightId}: ${feedback.rating}`,
    );
  }

  /**
   * Get feedback summary for an insight
   */
  async getFeedbackSummary(insightId: string): Promise<InsightFeedbackSummary> {
    const feedbacks = await this.prisma.aIFeedback.findMany({
      where: { insightId },
      orderBy: { createdAt: 'desc' },
    });

    const helpful = feedbacks.filter((f) => f.rating === 'helpful').length;
    const notHelpful = feedbacks.filter(
      (f) => f.rating === 'not_helpful',
    ).length;

    const score =
      feedbacks.length > 0
        ? (helpful * 1 + notHelpful * -1) / feedbacks.length
        : 0;

    return {
      insightId,
      totalFeedback: feedbacks.length,
      helpfulCount: helpful,
      notHelpfulCount: notHelpful,
      averageScore: Math.round(score * 100) / 100,
      recentComments: feedbacks
        .filter((f) => f.comment)
        .slice(0, 5)
        .map((f) => f.comment!),
    };
  }

  /**
   * Update insight quality score based on feedback
   */
  private async updateInsightQualityScore(insightId: string): Promise<void> {
    const summary = await this.getFeedbackSummary(insightId);

    // Calculate quality score (0-1 scale)
    const qualityScore =
      summary.totalFeedback > 0
        ? summary.helpfulCount / summary.totalFeedback
        : 0.5; // Default neutral score

    await this.prisma.aIInsight.update({
      where: { id: insightId },
      data: {
        qualityScore,
        feedbackCount: summary.totalFeedback,
      },
    });

    // If insight has poor quality, mark for review
    if (qualityScore < 0.3 && summary.totalFeedback >= 5) {
      this.eventEmitter.emit('ai.insight.low_quality', {
        insightId,
        qualityScore,
        feedbackCount: summary.totalFeedback,
      });
    }
  }

  /**
   * Get insights that performed well to improve prompts
   */
  async getHighQualityInsights(limit = 10): Promise<any[]> {
    return this.prisma.aIInsight.findMany({
      where: {
        qualityScore: { gte: 0.8 },
        feedbackCount: { gte: 3 },
      },
      orderBy: [{ qualityScore: 'desc' }, { feedbackCount: 'desc' }],
      take: limit,
    });
  }

  /**
   * Get insights that need improvement
   */
  async getLowQualityInsights(limit = 10): Promise<any[]> {
    return this.prisma.aIInsight.findMany({
      where: {
        qualityScore: { lte: 0.3 },
        feedbackCount: { gte: 3 },
      },
      orderBy: [{ qualityScore: 'asc' }, { feedbackCount: 'desc' }],
      take: limit,
    });
  }

  // ============================================================================
  // ENHANCED INSIGHT GENERATION
  // ============================================================================

  /**
   * Generate insights with context-aware prompts
   */
  async generateContextualInsights(
    workspaceId: string,
    portalId: string,
  ): Promise<any> {
    // Gather comprehensive context
    const context = await this.gatherEnhancedContext(workspaceId, portalId);

    // Get high-quality insight examples for few-shot learning
    const exemplars = await this.getHighQualityInsights(3);

    // Build enhanced prompt
    const systemPrompt = this.buildEnhancedSystemPrompt(context, exemplars);

    // Generate insights using AI
    const response = await this.generate(
      `Analyze this portal data and generate actionable insights:\n${JSON.stringify(context.portalData, null, 2)}`,
      {
        systemPrompt,
        temperature: 0.6,
        maxTokens: 2000,
      },
    );

    try {
      const insights = JSON.parse(response);
      return insights;
    } catch {
      // If response isn't valid JSON, return as text insight
      return {
        insights: [
          {
            type: 'ANALYSIS',
            title: 'AI Analysis',
            description: response,
            severity: 'INFO',
            confidence: 0.7,
          },
        ],
      };
    }
  }

  private async gatherEnhancedContext(workspaceId: string, portalId: string) {
    const [portal, integrations, recentActivity, historicalInsights] =
      await Promise.all([
        this.prisma.portal.findUnique({
          where: { id: portalId },
          include: {
            widgets: {
              include: { integration: true },
            },
          },
        }),
        this.prisma.integration.findMany({
          where: { workspaceId },
        }),
        this.prisma.auditLog.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.aIInsight.findMany({
          where: { workspaceId, portalId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    return {
      portalData: portal,
      integrations,
      recentActivity,
      historicalInsights,
      timestamp: new Date().toISOString(),
    };
  }

  private buildEnhancedSystemPrompt(context: any, exemplars: any[]): string {
    const exemplarText =
      exemplars.length > 0
        ? `\n\nExamples of high-quality insights:\n${exemplars.map((e) => `- ${e.title}: ${e.description}`).join('\n')}`
        : '';

    return `You are an AI analytics assistant for Real-Time Pulse, a client dashboard platform.
Your role is to analyze portal and widget data to generate actionable insights.

Guidelines:
1. Focus on anomalies, trends, and opportunities for improvement
2. Prioritize insights that are actionable and specific
3. Consider historical context when making recommendations
4. Rate confidence based on data completeness
5. Provide clear, business-friendly descriptions

Context:
- Active integrations: ${context.integrations?.length || 0}
- Recent activity events: ${context.recentActivity?.length || 0}
- Historical insights generated: ${context.historicalInsights?.length || 0}
${exemplarText}

Return a JSON object with an "insights" array containing objects with:
- type: ANOMALY, TREND, PREDICTION, RECOMMENDATION, or SUMMARY
- title: Brief title (max 50 chars)
- description: Detailed description (max 200 chars)
- severity: HIGH, MEDIUM, LOW, or INFO
- confidence: Number between 0 and 1
- recommendations: Object with "actions" array of strings`;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getCacheKey(prompt: string, options: GenerationOptions): string {
    return `ai:${Buffer.from(prompt).toString('base64').substring(0, 50)}:${JSON.stringify(options)}`;
  }

  private handleProviderError(provider: AIProvider, error: unknown): void {
    // Temporarily mark provider as unavailable
    provider.isAvailable = false;

    // Re-enable after 1 minute
    setTimeout(() => {
      provider.isAvailable = true;
      this.logger.log(`${provider.name} provider re-enabled`);
    }, 60000);

    this.eventEmitter.emit('ai.provider.error', {
      provider: provider.name,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  private getFallbackResponse(prompt: string): string {
    // Provide basic response when all providers fail
    const keywords = prompt.toLowerCase();

    if (keywords.includes('anomaly') || keywords.includes('issue')) {
      return 'Unable to perform real-time analysis. Please check your data sources and try again.';
    }

    if (keywords.includes('recommend') || keywords.includes('suggest')) {
      return 'AI recommendations are temporarily unavailable. Consider reviewing your dashboard metrics manually.';
    }

    return 'AI analysis is temporarily unavailable. Please try again later or contact support.';
  }

  /**
   * Get provider health status
   */
  getProviderStatus(): {
    name: string;
    available: boolean;
    priority: number;
  }[] {
    return this.providers.map((p) => ({
      name: p.name,
      available: p.isAvailable,
      priority: p.priority,
    }));
  }

  /**
   * Clear response cache
   */
  clearCache(): void {
    this.responseCache.clear();
    this.logger.log('AI response cache cleared');
  }
}
