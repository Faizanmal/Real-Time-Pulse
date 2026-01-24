import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationStatus } from '@prisma/client';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: {
    queryType?: string;
    dataContext?: any;
    suggestions?: string[];
    charts?: ChartSuggestion[];
  };
}

export interface ChartSuggestion {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'radar' | '3d-scatter' | '3d-bar' | 'globe';
  title: string;
  dataQuery: string;
  config: Record<string, any>;
}

export interface NLQueryResult {
  success: boolean;
  interpretation: string;
  sqlQuery?: string;
  data?: any;
  chartSuggestions?: ChartSuggestion[];
  followUpQuestions?: string[];
  errorMessage?: string;
}

export interface ConversationContext {
  workspaceId: string;
  userId: string;
  portalId?: string;
  recentMessages: ConversationMessage[];
  availableDataSources: string[];
  activeFilters?: Record<string, any>;
}

@Injectable()
export class ConversationalAIService {
  private readonly logger = new Logger(ConversationalAIService.name);
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private readonly preferredModel: 'openai' | 'anthropic';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }

    this.preferredModel = anthropicKey ? 'anthropic' : 'openai';
  }

  /**
   * Process a natural language query and return insights
   */
  async processQuery(query: string, context: ConversationContext): Promise<NLQueryResult> {
    try {
      // Analyze query intent
      const intent = await this.analyzeQueryIntent(query, context);

      // Build data context from available sources
      const dataContext = await this.buildDataContext(context);

      // Generate response based on intent
      const response = await this.generateResponse(query, intent, dataContext, context);

      // Log conversation for future reference
      await this.logConversation(query, response, context);

      return response;
    } catch (error) {
      this.logger.error(`Error processing query: ${error.message}`, error.stack);
      return {
        success: false,
        interpretation: 'I encountered an error processing your request.',
        errorMessage: error.message,
      };
    }
  }

  /**
   * Analyze the intent behind a natural language query
   */
  private async analyzeQueryIntent(
    query: string,
    context: ConversationContext,
  ): Promise<{
    type: 'data_query' | 'comparison' | 'trend' | 'forecast' | 'explanation' | 'action' | 'general';
    entities: string[];
    timeRange?: { start: Date; end: Date };
    metrics?: string[];
    dimensions?: string[];
  }> {
    const systemPrompt = `You are a data analytics assistant. Analyze the user's query and extract:
1. Query type: data_query (fetching data), comparison (comparing metrics), trend (analyzing trends), forecast (predicting future), explanation (explaining data), action (performing action), general (general questions)
2. Entities mentioned (products, customers, regions, etc.)
3. Time range if mentioned
4. Metrics mentioned (revenue, sales, count, etc.)
5. Dimensions for grouping (by month, by category, etc.)

Available data sources: ${context.availableDataSources.join(', ')}

Respond in JSON format only.`;

    const response = await this.callLLM(systemPrompt, query);

    try {
      return JSON.parse(response);
    } catch {
      return {
        type: 'general',
        entities: [],
      };
    }
  }

  /**
   * Build data context from workspace integrations and portals
   */
  private async buildDataContext(context: ConversationContext): Promise<{
    schema: Record<string, any>;
    recentData: Record<string, any>;
    summaries: Record<string, string>;
  }> {
    // Get workspace integrations
    const integrations = await this.prisma.integration.findMany({
      where: {
        workspaceId: context.workspaceId,
        status: IntegrationStatus.ACTIVE,
      },
      select: {
        id: true,
        accountName: true,
        provider: true,
        lastSyncedAt: true,
      },
    });

    // Get portal if specified
    let portalData: any = null;
    if (context.portalId) {
      portalData = await this.prisma.portal.findUnique({
        where: { id: context.portalId },
        include: {
          widgets: {
            include: {
              integration: true,
            },
          },
        },
      });
    }

    // Build schema from integrations
    const schema: Record<string, any> = {};
    for (const integration of integrations) {
      schema[integration.provider] = {
        id: integration.id,
        name: integration.accountName,
        lastSync: integration.lastSyncedAt,
        // Add known schema for common providers
        fields: this.getProviderSchema(integration.provider),
      };
    }

    return {
      schema,
      recentData: {},
      summaries: {
        integrationCount: `${integrations.length} active integrations`,
        widgetCount: portalData
          ? `${portalData.widgets.length} widgets configured`
          : 'No portal selected',
      },
    };
  }

  /**
   * Get known schema fields for common providers
   */
  private getProviderSchema(provider: string): string[] {
    const schemas: Record<string, string[]> = {
      GOOGLE_ANALYTICS: ['pageViews', 'sessions', 'users', 'bounceRate', 'avgSessionDuration'],
      HUBSPOT: ['contacts', 'deals', 'companies', 'emails', 'revenue'],
      SALESFORCE: ['leads', 'opportunities', 'accounts', 'contacts', 'revenue'],
      SHOPIFY: ['orders', 'products', 'customers', 'revenue', 'inventory'],
      STRIPE: ['payments', 'subscriptions', 'customers', 'revenue', 'mrr'],
      JIRA: ['issues', 'sprints', 'epics', 'velocity', 'burndown'],
      GITHUB: ['commits', 'pullRequests', 'issues', 'releases', 'contributors'],
      SLACK: ['messages', 'channels', 'reactions', 'users', 'threads'],
    };

    return schemas[provider] || ['data'];
  }

  /**
   * Generate response based on query intent and data context
   */
  private async generateResponse(
    query: string,
    intent: any,
    dataContext: any,
    context: ConversationContext,
  ): Promise<NLQueryResult> {
    const recentContext = context.recentMessages
      .slice(-5)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are an intelligent data analytics assistant for a business intelligence platform.
You help users understand their data, create visualizations, and gain insights.

Available data sources and schema:
${JSON.stringify(dataContext.schema, null, 2)}

Recent conversation:
${recentContext}

User's query type: ${intent.type}
Detected entities: ${intent.entities.join(', ') || 'none'}
Detected metrics: ${intent.metrics?.join(', ') || 'none'}

Based on the query, provide:
1. A clear interpretation of what the user is asking
2. Suggested SQL query if applicable (use standard SQL syntax)
3. Chart recommendations with configuration
4. 3 follow-up questions the user might want to ask

Respond in this JSON format:
{
  "interpretation": "string explaining what you understood",
  "sqlQuery": "SQL query if applicable, null otherwise",
  "chartSuggestions": [
    {
      "type": "bar|line|pie|scatter|area|3d-scatter|3d-bar|globe",
      "title": "Chart title",
      "dataQuery": "Description of data to fetch",
      "config": { "xAxis": "field", "yAxis": "field" }
    }
  ],
  "response": "Natural language response to the user",
  "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"]
}`;

    const response = await this.callLLM(systemPrompt, query);

    try {
      const parsed = JSON.parse(response);
      return {
        success: true,
        interpretation: parsed.interpretation,
        sqlQuery: parsed.sqlQuery,
        chartSuggestions: parsed.chartSuggestions,
        followUpQuestions: parsed.followUpQuestions,
        data: {
          response: parsed.response,
        },
      };
    } catch {
      return {
        success: true,
        interpretation: response,
        data: { response },
      };
    }
  }

  /**
   * Call the preferred LLM (OpenAI or Anthropic)
   */
  private async callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    if (this.preferredModel === 'anthropic' && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock ? textBlock.text : '';
    }

    if (this.openai) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      });

      return response.choices[0]?.message?.content || '';
    }

    throw new Error('No LLM provider configured');
  }

  /**
   * Log conversation for future reference and learning
   */
  private async logConversation(
    query: string,
    response: NLQueryResult,
    context: ConversationContext,
  ): Promise<void> {
    try {
      await this.prisma.aIConversation.create({
        data: {
          workspaceId: context.workspaceId,
          userId: context.userId,
          portalId: context.portalId,
          query,
          response: JSON.stringify(response),
          success: response.success,
          queryType: response.interpretation.substring(0, 100),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to log conversation', error);
    }
  }

  /**
   * Get proactive insights based on data patterns
   */
  async getProactiveInsights(
    workspaceId: string,
    _userId: string,
  ): Promise<{
    insights: Array<{
      type: 'anomaly' | 'trend' | 'opportunity' | 'warning';
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      actionable: boolean;
      suggestedAction?: string;
    }>;
  }> {
    // Get recent insights from database
    const recentInsights = await this.prisma.aIInsight.findMany({
      where: {
        workspaceId,
        status: 'NEW',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { severity: 'desc' },
      take: 10,
    });

    // Transform to proactive insight format
    const insights = recentInsights.map((insight) => ({
      type: this.mapInsightType(insight.type),
      title: insight.title,
      description: insight.description,
      severity: this.mapSeverity(insight.severity),
      actionable: true,
      suggestedAction: (insight.recommendations as any)?.actions?.[0] || undefined,
    }));

    // Add generated insights if we have AI capabilities
    if (this.openai || this.anthropic) {
      const generatedInsights = await this.generateProactiveInsights(workspaceId);
      insights.push(...generatedInsights);
    }

    return { insights: insights.slice(0, 5) };
  }

  private mapInsightType(type: string): 'anomaly' | 'trend' | 'opportunity' | 'warning' {
    const mapping: Record<string, 'anomaly' | 'trend' | 'opportunity' | 'warning'> = {
      ANOMALY: 'anomaly',
      TREND: 'trend',
      PATTERN: 'trend',
      CORRELATION: 'opportunity',
      PREDICTION: 'opportunity',
    };
    return mapping[type] || 'trend';
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' {
    const mapping: Record<string, 'low' | 'medium' | 'high'> = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'high',
    };
    return mapping[severity] || 'medium';
  }

  private async generateProactiveInsights(workspaceId: string): Promise<
    Array<{
      type: 'anomaly' | 'trend' | 'opportunity' | 'warning';
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      actionable: boolean;
      suggestedAction: string;
    }>
  > {
    // Get workspace data summary
    const integrations = await this.prisma.integration.findMany({
      where: { workspaceId, status: IntegrationStatus.ACTIVE },
      take: 10,
    });

    if (integrations.length === 0) {
      return [];
    }

    const prompt = `Based on a business analytics workspace with these integrations: ${integrations.map((i) => i.provider).join(', ')}, 
suggest 2 proactive insights that would be valuable. Return JSON array with objects containing: type (anomaly/trend/opportunity/warning), title, description, severity (low/medium/high), actionable (boolean), suggestedAction (string, can be empty if none).`;

    try {
      const response = await this.callLLM(
        'You are a business analytics expert. Provide realistic proactive insights.',
        prompt,
      );
      const parsed = JSON.parse(response) as Array<{
        type: 'anomaly' | 'trend' | 'opportunity' | 'warning';
        title: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        actionable: boolean;
        suggestedAction: string;
      }>;
      return parsed;
    } catch {
      return [];
    }
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(
    workspaceId: string,
    userId: string,
    limit = 20,
  ): Promise<ConversationMessage[]> {
    const conversations = await this.prisma.aIConversation.findMany({
      where: {
        workspaceId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const messages: ConversationMessage[] = [];
    for (const conv of conversations.reverse()) {
      messages.push({
        role: 'user',
        content: conv.query,
        timestamp: conv.createdAt,
      });

      try {
        const response = JSON.parse(conv.response as string);
        messages.push({
          role: 'assistant',
          content: response.data?.response || response.interpretation,
          timestamp: conv.createdAt,
          metadata: {
            queryType: conv.queryType || undefined,
            suggestions: response.followUpQuestions,
            charts: response.chartSuggestions,
          },
        });
      } catch {
        messages.push({
          role: 'assistant',
          content: conv.response as string,
          timestamp: conv.createdAt,
        });
      }
    }

    return messages;
  }

  /**
   * Generate a data story from metrics
   */
  async generateDataStory(
    workspaceId: string,
    metrics: Array<{ name: string; value: number; previousValue?: number }>,
  ): Promise<{
    story: string;
    highlights: string[];
    concerns: string[];
    recommendations: string[];
  }> {
    const metricsDescription = metrics
      .map((m) => {
        const change = m.previousValue
          ? ` (${(((m.value - m.previousValue) / m.previousValue) * 100).toFixed(1)}% change)`
          : '';
        return `${m.name}: ${m.value}${change}`;
      })
      .join('\n');

    const prompt = `Create a data story from these metrics:\n${metricsDescription}

Return JSON with: story (narrative paragraph), highlights (array of positive points), concerns (array of issues), recommendations (array of action items).`;

    try {
      const response = await this.callLLM(
        'You are a business analyst creating executive summaries.',
        prompt,
      );
      return JSON.parse(response);
    } catch {
      return {
        story: 'Unable to generate data story at this time.',
        highlights: [],
        concerns: [],
        recommendations: [],
      };
    }
  }

  /**
   * Answer a question about specific data
   */
  async askAboutData(question: string, data: any, _context: ConversationContext): Promise<string> {
    const dataPreview = JSON.stringify(data).substring(0, 2000);

    const prompt = `The user is asking about this data:
${dataPreview}

Question: ${question}

Provide a clear, concise answer based on the data.`;

    return this.callLLM('You are a data analyst helping users understand their data.', prompt);
  }
}
