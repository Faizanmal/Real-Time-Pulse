/**
 * =============================================================================
 * REAL-TIME PULSE - ADVANCED AI SERVICE
 * =============================================================================
 *
 * Multi-model AI service supporting OpenAI, Anthropic, and local models
 * with intelligent routing, caching, and fallback strategies.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Types
interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AICompletionOptions {
  model?: string;
  provider?: 'openai' | 'anthropic' | 'auto';
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  cache?: boolean;
  timeout?: number;
  retries?: number;
}

interface AICompletion {
  content: string;
  provider: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached: boolean;
  latencyMs: number;
}

interface AIEmbedding {
  vector: number[];
  model: string;
  usage: { totalTokens: number };
}

interface InsightResult {
  type: string;
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  suggestedActions?: string[];
  data?: Record<string, unknown>;
}

interface ForecastResult {
  metric: string;
  periods: Array<{
    date: string;
    predicted: number;
    lower: number;
    upper: number;
  }>;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  seasonality?: string;
}

interface AnomalyResult {
  id: string;
  timestamp: Date;
  metric: string;
  expected: number;
  actual: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private cache: Map<string, { result: AICompletion; expiry: number }> =
    new Map();
  private readonly cacheTTL = 3600000; // 1 hour

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    // Initialize OpenAI
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.log('OpenAI client initialized');
    }

    // Initialize Anthropic
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('Anthropic client initialized');
    }

    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), 300000);
  }

  // ============================================================================
  // CORE COMPLETION API
  // ============================================================================

  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AICompletion> {
    const {
      model,
      provider = 'auto',
      maxTokens = 2048,
      temperature = 0.7,
      topP = 1,
      cache = true,
      timeout = 30000,
      retries = 2,
    } = options;

    // Check cache
    const cacheKey = this.getCacheKey(messages, options);
    if (cache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Determine provider
    const selectedProvider = this.selectProvider(provider, model);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        let result: AICompletion;

        if (selectedProvider === 'anthropic' && this.anthropic) {
          result = await this.completeWithAnthropic(messages, {
            model: model || 'claude-3-sonnet-20240229',
            maxTokens,
            temperature,
            timeout,
          });
        } else if (this.openai) {
          result = await this.completeWithOpenAI(messages, {
            model: model || 'gpt-4-turbo-preview',
            maxTokens,
            temperature,
            topP,
            timeout,
          });
        } else {
          throw new Error('No AI provider available');
        }

        result.latencyMs = Date.now() - startTime;

        // Cache result
        if (cache) {
          this.setCache(cacheKey, result);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `AI completion attempt ${attempt + 1} failed: ${lastError.message}`,
        );

        // Try fallback provider
        if (attempt === 0 && provider === 'auto') {
          continue;
        }

        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw lastError || new Error('AI completion failed');
  }

  private async completeWithOpenAI(
    messages: AIMessage[],
    options: {
      model: string;
      maxTokens: number;
      temperature: number;
      topP: number;
      timeout: number;
    },
  ): Promise<AICompletion> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const response = await this.openai.chat.completions.create({
      model: options.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      provider: 'openai',
      model: options.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      cached: false,
      latencyMs: 0,
    };
  }

  private async completeWithAnthropic(
    messages: AIMessage[],
    options: {
      model: string;
      maxTokens: number;
      temperature: number;
      timeout: number;
    },
  ): Promise<AICompletion> {
    if (!this.anthropic) throw new Error('Anthropic not initialized');

    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const response = await this.anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemMessage?.content,
      messages: chatMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';

    return {
      content: textContent,
      provider: 'anthropic',
      model: options.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      cached: false,
      latencyMs: 0,
    };
  }

  // ============================================================================
  // EMBEDDINGS
  // ============================================================================

  async embed(text: string | string[]): Promise<AIEmbedding[]> {
    if (!this.openai) throw new Error('OpenAI not initialized for embeddings');

    const input = Array.isArray(text) ? text : [text];

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input,
    });

    return response.data.map((d) => ({
      vector: d.embedding,
      model: 'text-embedding-3-small',
      usage: { totalTokens: response.usage.total_tokens / input.length },
    }));
  }

  // ============================================================================
  // BUSINESS INTELLIGENCE FEATURES
  // ============================================================================

  /**
   * Generate insights from data
   */
  async generateInsights(
    data: Record<string, unknown>,
    context?: string,
  ): Promise<InsightResult[]> {
    const prompt = `Analyze the following data and provide actionable business insights.
    
Context: ${context || 'Business dashboard data'}

Data:
${JSON.stringify(data, null, 2)}

Provide 3-5 insights in the following JSON format:
[
  {
    "type": "trend|anomaly|opportunity|risk|performance",
    "title": "Brief title",
    "description": "Detailed explanation",
    "confidence": 0.0-1.0,
    "actionable": true/false,
    "suggestedActions": ["action1", "action2"]
  }
]

Return ONLY the JSON array, no additional text.`;

    const response = await this.complete([
      {
        role: 'system',
        content:
          'You are an expert business analyst. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      return JSON.parse(response.content);
    } catch {
      this.logger.error('Failed to parse AI insights response');
      return [];
    }
  }

  /**
   * Generate forecasts
   */
  async generateForecast(
    historicalData: Array<{ date: string; value: number }>,
    metric: string,
    periods: number = 7,
  ): Promise<ForecastResult> {
    const prompt = `Based on the following historical data for "${metric}", predict the next ${periods} periods.

Historical Data:
${historicalData.map((d) => `${d.date}: ${d.value}`).join('\n')}

Provide a forecast in the following JSON format:
{
  "metric": "${metric}",
  "periods": [
    { "date": "YYYY-MM-DD", "predicted": number, "lower": number, "upper": number }
  ],
  "confidence": 0.0-1.0,
  "trend": "up|down|stable",
  "seasonality": "daily|weekly|monthly|none"
}

Return ONLY the JSON object, no additional text.`;

    const response = await this.complete([
      {
        role: 'system',
        content:
          'You are an expert data scientist specializing in time series forecasting. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      return JSON.parse(response.content);
    } catch {
      this.logger.error('Failed to parse AI forecast response');
      return {
        metric,
        periods: [],
        confidence: 0,
        trend: 'stable',
      };
    }
  }

  /**
   * Detect anomalies
   */
  async detectAnomalies(
    data: Array<{ timestamp: string; metric: string; value: number }>,
  ): Promise<AnomalyResult[]> {
    const prompt = `Analyze the following time series data and detect any anomalies.

Data:
${data.map((d) => `${d.timestamp} | ${d.metric}: ${d.value}`).join('\n')}

Identify anomalies and return them in the following JSON format:
[
  {
    "id": "unique_id",
    "timestamp": "ISO timestamp",
    "metric": "metric name",
    "expected": expected_value,
    "actual": actual_value,
    "deviation": percentage_deviation,
    "severity": "low|medium|high|critical",
    "description": "explanation"
  }
]

Return ONLY the JSON array, no additional text. Return empty array if no anomalies.`;

    const response = await this.complete([
      {
        role: 'system',
        content:
          'You are an expert in anomaly detection and statistical analysis. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      const anomalies = JSON.parse(response.content);
      return anomalies.map((a: AnomalyResult) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    } catch {
      this.logger.error('Failed to parse AI anomaly response');
      return [];
    }
  }

  /**
   * Natural language query to data
   */
  async queryData(
    naturalLanguageQuery: string,
    schema: Record<string, string[]>,
  ): Promise<{ query: string; explanation: string }> {
    const prompt = `Convert the following natural language question into a database query.

Question: "${naturalLanguageQuery}"

Available tables and columns:
${Object.entries(schema)
  .map(([table, columns]) => `${table}: ${columns.join(', ')}`)
  .join('\n')}

Respond in JSON format:
{
  "query": "SELECT ...",
  "explanation": "What this query does"
}

Return ONLY the JSON object.`;

    const response = await this.complete([
      {
        role: 'system',
        content:
          'You are an expert SQL developer. Generate safe, efficient queries. Always respond with valid JSON.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      return JSON.parse(response.content);
    } catch {
      return { query: '', explanation: 'Failed to generate query' };
    }
  }

  /**
   * Generate report summary
   */
  async generateReportSummary(
    data: Record<string, unknown>,
    reportType: string,
  ): Promise<string> {
    const response = await this.complete([
      {
        role: 'system',
        content:
          'You are an expert business analyst. Write clear, concise executive summaries.',
      },
      {
        role: 'user',
        content: `Generate an executive summary for this ${reportType} report:\n\n${JSON.stringify(data, null, 2)}`,
      },
    ]);

    return response.content;
  }

  /**
   * Chat with data context
   */
  async chat(
    message: string,
    conversationHistory: AIMessage[] = [],
    dataContext?: Record<string, unknown>,
  ): Promise<string> {
    const systemPrompt = `You are an intelligent assistant for Real-Time Pulse, an enterprise dashboard platform.
Help users understand their data, answer questions, and provide actionable insights.
Be concise but thorough. Use data when available to support your answers.

${dataContext ? `Current data context:\n${JSON.stringify(dataContext, null, 2)}` : ''}`;

    const response = await this.complete([
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ]);

    return response.content;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private selectProvider(
    preferred: 'openai' | 'anthropic' | 'auto',
    model?: string,
  ): 'openai' | 'anthropic' {
    if (preferred !== 'auto') return preferred;

    // Check model name for hints
    if (model) {
      if (model.includes('claude')) return 'anthropic';
      if (model.includes('gpt')) return 'openai';
    }

    // Default to available provider
    if (this.anthropic) return 'anthropic';
    if (this.openai) return 'openai';

    return 'openai';
  }

  private getCacheKey(
    messages: AIMessage[],
    options: AICompletionOptions,
  ): string {
    return JSON.stringify({ messages, options });
  }

  private getFromCache(key: string): AICompletion | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, result: AICompletion): void {
    this.cache.set(key, {
      result,
      expiry: Date.now() + this.cacheTTL,
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (value.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Health check
  async healthCheck(): Promise<{ openai: boolean; anthropic: boolean }> {
    return {
      openai: !!this.openai,
      anthropic: !!this.anthropic,
    };
  }
}

export default AIService;
