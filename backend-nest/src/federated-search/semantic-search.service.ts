import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchResult } from './federated-search.service';

interface EmbeddingResult {
  text: string;
  embedding: number[];
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly openAiApiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  /**
   * Rerank search results using semantic similarity
   */
  async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    if (!this.openAiApiKey || results.length === 0) {
      return results;
    }

    try {
      // Get query embedding
      const queryEmbedding = await this.getEmbedding(query);
      if (!queryEmbedding) {
        return results;
      }

      // Get embeddings for result texts
      const resultTexts = results.map((r) => `${r.title} ${r.description || ''}`);
      const resultEmbeddings = await this.getEmbeddings(resultTexts);

      // Calculate semantic similarity scores
      const scoredResults = results.map((result, index) => {
        const embedding = resultEmbeddings[index];
        const semanticScore = embedding
          ? this.cosineSimilarity(queryEmbedding, embedding)
          : 0;

        // Combine with original relevance score (70% semantic, 30% keyword)
        const combinedScore = semanticScore * 0.7 + result.relevanceScore * 0.3;

        return {
          ...result,
          relevanceScore: combinedScore,
        };
      });

      // Sort by combined score
      return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      this.logger.error(`Semantic reranking failed: ${error}`);
      return results;
    }
  }

  /**
   * Get embedding for a single text
   */
  private async getEmbedding(text: string): Promise<number[] | null> {
    const embeddings = await this.getEmbeddings([text]);
    return embeddings[0] || null;
  }

  /**
   * Get embeddings for multiple texts
   */
  private async getEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.openAiApiKey) {
      return texts.map(() => null);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts.map((t) => t.slice(0, 8000)), // Limit text length
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      this.logger.error(`Failed to get embeddings: ${error}`);
      return texts.map(() => null);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Parse natural language query
   */
  async parseNaturalLanguageQuery(query: string): Promise<{
    intent: string;
    entities: Record<string, string>;
    filters: Record<string, any>;
  }> {
    // Simple NLP parsing (in production, use a proper NLP service)
    const result = {
      intent: 'search',
      entities: {} as Record<string, string>,
      filters: {} as Record<string, any>,
    };

    // Detect intents
    if (query.match(/\b(show|find|get|list)\s+all\b/i)) {
      result.intent = 'list_all';
    } else if (query.match(/\b(recent|latest|new)\b/i)) {
      result.intent = 'recent';
      result.filters.sortBy = 'createdAt';
      result.filters.sortOrder = 'desc';
    } else if (query.match(/\b(updated|modified|changed)\b/i)) {
      result.intent = 'updated';
      result.filters.sortBy = 'updatedAt';
      result.filters.sortOrder = 'desc';
    }

    // Extract entity types
    const typePatterns = [
      { pattern: /\bportals?\b/i, type: 'portal' },
      { pattern: /\bwidgets?\b/i, type: 'widget' },
      { pattern: /\busers?\b/i, type: 'user' },
      { pattern: /\binsights?\b/i, type: 'insight' },
      { pattern: /\bintegrations?\b/i, type: 'integration' },
    ];

    for (const { pattern, type } of typePatterns) {
      if (pattern.test(query)) {
        result.entities.type = type;
        result.filters.types = [type];
        break;
      }
    }

    // Extract date filters
    const datePatterns = [
      { pattern: /\btoday\b/i, days: 0 },
      { pattern: /\byesterday\b/i, days: 1 },
      { pattern: /\blast\s+week\b/i, days: 7 },
      { pattern: /\blast\s+month\b/i, days: 30 },
      { pattern: /\blast\s+(\d+)\s+days?\b/i, daysGroup: 1 },
    ];

    for (const { pattern, days, daysGroup } of datePatterns) {
      const match = query.match(pattern);
      if (match) {
        const daysBack = daysGroup ? parseInt(match[daysGroup], 10) : days;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysBack!);
        result.filters.dateRange = { from: fromDate };
        break;
      }
    }

    // Extract user mentions
    const userMatch = query.match(/\bby\s+(\w+)\b/i);
    if (userMatch) {
      result.entities.user = userMatch[1];
    }

    return result;
  }

  /**
   * Generate search query suggestions using AI
   */
  async generateQuerySuggestions(
    context: { recentQueries: string[]; popularQueries: string[] },
  ): Promise<string[]> {
    // Simple suggestion generation (in production, use AI)
    const suggestions: string[] = [];

    // Add variations of recent queries
    for (const query of context.recentQueries.slice(0, 3)) {
      suggestions.push(`${query} this week`);
      suggestions.push(`${query} by me`);
    }

    // Add popular queries
    suggestions.push(...context.popularQueries.slice(0, 5));

    return [...new Set(suggestions)].slice(0, 10);
  }
}
