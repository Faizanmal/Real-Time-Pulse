import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { SemanticSearchService } from './semantic-search.service';

export interface SearchResult {
  id: string;
  type: 'portal' | 'widget' | 'integration' | 'user' | 'insight' | 'external';
  source: string;
  title: string;
  description?: string;
  snippet?: string;
  url?: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
  highlights?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SearchOptions {
  query: string;
  sources?: string[];
  types?: string[];
  dateRange?: { from?: Date; to?: Date };
  limit?: number;
  offset?: number;
  semantic?: boolean;
  correlate?: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'internal' | 'integration' | 'external';
  connector?: string;
  config?: Record<string, any>;
  isActive: boolean;
}

@Injectable()
export class FederatedSearchService {
  private readonly logger = new Logger(FederatedSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly semanticSearch: SemanticSearchService,
  ) {}

  /**
   * Perform federated search across multiple data sources
   */
  async search(
    workspaceId: string,
    options: SearchOptions,
  ): Promise<{
    results: SearchResult[];
    totalCount: number;
    sources: string[];
    correlations?: any[];
  }> {
    const {
      query,
      sources,
      types,
      limit = 20,
      offset = 0,
      semantic = true,
      correlate = false,
    } = options;

    this.logger.log(`Searching for: "${query}" in workspace ${workspaceId}`);

    // Get active data sources
    const activeSources = await this.getDataSources(workspaceId);
    const sourcesToSearch = sources
      ? activeSources.filter((s) => sources.includes(s.id))
      : activeSources;

    // Perform parallel searches across all sources
    const searchPromises = sourcesToSearch.map((source) =>
      this.searchSource(workspaceId, source, query, options).catch((error) => {
        this.logger.error(`Search failed for source ${source.id}: ${error.message}`);
        return [];
      }),
    );

    const sourceResults = await Promise.all(searchPromises);
    let allResults = sourceResults.flat();

    // Apply semantic search if enabled
    if (semantic && allResults.length > 0) {
      allResults = await this.semanticSearch.rerank(query, allResults);
    }

    // Filter by types if specified
    if (types && types.length > 0) {
      allResults = allResults.filter((r) => types.includes(r.type));
    }

    // Sort by relevance score
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Find correlations if requested
    let correlations: any[] = [];
    if (correlate && allResults.length > 1) {
      correlations = await this.findCorrelations(allResults);
    }

    // Apply pagination
    const paginatedResults = allResults.slice(offset, offset + limit);

    // Log search for analytics
    await this.logSearch(workspaceId, query, allResults.length);

    return {
      results: paginatedResults,
      totalCount: allResults.length,
      sources: sourcesToSearch.map((s) => s.id),
      correlations: correlate ? correlations : undefined,
    };
  }

  /**
   * Search a specific data source
   */
  private async searchSource(
    workspaceId: string,
    source: DataSource,
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    switch (source.type) {
      case 'internal':
        return this.searchInternal(workspaceId, source.id, query, options);
      case 'integration':
        return this.searchIntegration(workspaceId, source, query, options);
      case 'external':
        return this.searchExternal(source, query, options);
      default:
        return [];
    }
  }

  /**
   * Search internal data (portals, widgets, users, etc.)
   */
  private async searchInternal(
    workspaceId: string,
    sourceId: string,
    query: string,
    _options: SearchOptions,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    switch (sourceId) {
      case 'portals': {
        const portals = await this.prisma.portal.findMany({
          where: {
            workspaceId,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          include: {
            _count: { select: { widgets: true } },
          },
          take: 50,
        });

        for (const portal of portals) {
          results.push({
            id: portal.id,
            type: 'portal',
            source: 'portals',
            title: portal.name,
            description: portal.description || undefined,
            relevanceScore: this.calculateRelevance(searchTerms, [
              portal.name,
              portal.description || '',
            ]),
            metadata: {
              widgetCount: portal._count.widgets,
              isPublic: portal.isPublic,
            },
            createdAt: portal.createdAt,
            updatedAt: portal.updatedAt,
          });
        }
        break;
      }

      case 'widgets': {
        const widgets = await this.prisma.widget.findMany({
          where: {
            portal: { workspaceId },
            name: { contains: query, mode: 'insensitive' },
          },
          include: {
            portal: { select: { id: true, name: true } },
          },
          take: 50,
        });

        for (const widget of widgets) {
          results.push({
            id: widget.id,
            type: 'widget',
            source: 'widgets',
            title: widget.name,
            description: `Widget in ${widget.portal.name}`,
            relevanceScore: this.calculateRelevance(searchTerms, [widget.name]),
            metadata: {
              widgetType: widget.type,
              portalId: widget.portal.id,
              portalName: widget.portal.name,
            },
            createdAt: widget.createdAt,
            updatedAt: widget.updatedAt,
          });
        }
        break;
      }

      case 'users': {
        const users = await this.prisma.user.findMany({
          where: {
            workspaceId,
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 20,
        });

        for (const user of users) {
          const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
          results.push({
            id: user.id,
            type: 'user',
            source: 'users',
            title: name,
            description: user.email,
            relevanceScore: this.calculateRelevance(searchTerms, [name, user.email]),
            metadata: {
              role: user.role,
              avatar: user.avatar,
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          });
        }
        break;
      }

      case 'insights': {
        const insights = await this.prisma.aIInsight.findMany({
          where: {
            workspaceId,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 30,
        });

        for (const insight of insights) {
          results.push({
            id: insight.id,
            type: 'insight',
            source: 'insights',
            title: insight.title,
            description: insight.description,
            snippet: insight.description.slice(0, 200),
            relevanceScore: this.calculateRelevance(searchTerms, [
              insight.title,
              insight.description,
            ]),
            metadata: {
              type: insight.type,
              severity: insight.severity,
              status: insight.status,
            },
            createdAt: insight.createdAt,
            updatedAt: insight.updatedAt,
          });
        }
        break;
      }

      case 'integrations': {
        const integrations = await this.prisma.integration.findMany({
          where: {
            workspaceId,
            OR: [{ accountName: { contains: query, mode: 'insensitive' } }],
          },
          take: 20,
        });

        for (const integration of integrations) {
          results.push({
            id: integration.id,
            type: 'integration',
            source: 'integrations',
            title: integration.accountName || integration.provider,
            description: `${integration.provider} integration`,
            relevanceScore: this.calculateRelevance(searchTerms, [
              integration.accountName || '',
              integration.provider,
            ]),
            metadata: {
              provider: integration.provider,
              status: integration.status,
            },
            createdAt: integration.createdAt,
            updatedAt: integration.updatedAt,
          });
        }
        break;
      }
    }

    return results;
  }

  /**
   * Search integration data (e.g., Asana tasks, GitHub issues)
   */
  private async searchIntegration(
    workspaceId: string,
    source: DataSource,
    query: string,
    _options: SearchOptions,
  ): Promise<SearchResult[]> {
    // This would connect to actual integrations
    // For now, return empty results
    this.logger.debug(`Integration search for ${source.connector}: ${query}`);
    return [];
  }

  /**
   * Search external data sources
   */
  private async searchExternal(
    source: DataSource,
    query: string,
    _options: SearchOptions,
  ): Promise<SearchResult[]> {
    // This would connect to external APIs
    // For now, return empty results
    this.logger.debug(`External search for ${source.name}: ${query}`);
    return [];
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(searchTerms: string[], texts: string[]): number {
    let score = 0;
    const combinedText = texts.join(' ').toLowerCase();

    for (const term of searchTerms) {
      // Exact match in title (first text)
      if (texts[0]?.toLowerCase().includes(term)) {
        score += 10;
      }
      // Match in other texts
      if (combinedText.includes(term)) {
        score += 5;
      }
      // Word boundary match
      const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i');
      if (wordBoundaryRegex.test(combinedText)) {
        score += 3;
      }
    }

    // Normalize to 0-1 range
    return Math.min(score / (searchTerms.length * 18), 1);
  }

  /**
   * Find correlations between search results
   */
  private async findCorrelations(results: SearchResult[]): Promise<any[]> {
    const correlations: any[] = [];

    // Group by metadata properties
    const groupedByPortal = new Map<string, SearchResult[]>();
    const groupedByType = new Map<string, SearchResult[]>();

    for (const result of results) {
      // Group by portal
      if (result.metadata?.portalId) {
        const portalId = result.metadata.portalId;
        if (!groupedByPortal.has(portalId)) {
          groupedByPortal.set(portalId, []);
        }
        groupedByPortal.get(portalId).push(result);
      }

      // Group by type
      if (!groupedByType.has(result.type)) {
        groupedByType.set(result.type, []);
      }
      groupedByType.get(result.type).push(result);
    }

    // Find portal-based correlations
    for (const [portalId, items] of groupedByPortal) {
      if (items.length > 1) {
        correlations.push({
          type: 'portal_relationship',
          portalId,
          items: items.map((i) => ({ id: i.id, type: i.type, title: i.title })),
          strength: Math.min(items.length / 5, 1),
        });
      }
    }

    // Find type-based patterns
    for (const [type, items] of groupedByType) {
      if (items.length > 2) {
        correlations.push({
          type: 'type_cluster',
          itemType: type,
          count: items.length,
          items: items.slice(0, 5).map((i) => ({ id: i.id, title: i.title })),
        });
      }
    }

    return correlations;
  }

  /**
   * Get data sources for a workspace
   */
  async getDataSources(workspaceId: string): Promise<DataSource[]> {
    // Internal sources
    const sources: DataSource[] = [
      { id: 'portals', name: 'Portals', type: 'internal', isActive: true },
      { id: 'widgets', name: 'Widgets', type: 'internal', isActive: true },
      { id: 'users', name: 'Users', type: 'internal', isActive: true },
      { id: 'insights', name: 'AI Insights', type: 'internal', isActive: true },
      {
        id: 'integrations',
        name: 'Integrations',
        type: 'internal',
        isActive: true,
      },
    ];

    // Add connected integrations as sources
    const integrations = await this.prisma.integration.findMany({
      where: { workspaceId, status: 'ACTIVE' },
    });

    for (const integration of integrations) {
      sources.push({
        id: `integration_${integration.id}`,
        name: integration.accountName || integration.provider,
        type: 'integration',
        connector: integration.provider,
        config: { integrationId: integration.id },
        isActive: true,
      });
    }

    return sources;
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(workspaceId: string, prefix: string, limit = 10): Promise<string[]> {
    const suggestions: string[] = [];

    // Get portal names
    const portals = await this.prisma.portal.findMany({
      where: {
        workspaceId,
        name: { startsWith: prefix, mode: 'insensitive' },
      },
      select: { name: true },
      take: limit,
    });
    suggestions.push(...portals.map((p) => p.name));

    // Get widget names
    const widgets = await this.prisma.widget.findMany({
      where: {
        portal: { workspaceId },
        name: { startsWith: prefix, mode: 'insensitive' },
      },
      select: { name: true },
      take: limit,
    });
    suggestions.push(...widgets.map((w) => w.name));

    // Return unique suggestions
    return [...new Set(suggestions)].slice(0, limit);
  }

  /**
   * Get recent searches
   */
  async getRecentSearches(workspaceId: string, userId: string, limit = 10): Promise<string[]> {
    const key = `recent_searches:${workspaceId}:${userId}`;
    const json = await this.cache.get(key);
    const searches: string[] = json ? JSON.parse(json) : [];
    return searches.slice(0, limit);
  }

  /**
   * Log search for analytics and recent searches
   */
  private async logSearch(workspaceId: string, query: string, _resultCount: number): Promise<void> {
    // Log to analytics (simplified)
    const statsKey = `search_stats:${workspaceId}`;
    const statsJson = await this.cache.get(statsKey);
    const stats = statsJson ? JSON.parse(statsJson) : { totalSearches: 0, queries: {} };

    stats.totalSearches++;
    stats.queries[query] = (stats.queries[query] || 0) + 1;

    await this.cache.set(statsKey, JSON.stringify(stats), 86400 * 30);
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(workspaceId: string): Promise<{
    totalSearches: number;
    topQueries: Array<{ query: string; count: number }>;
  }> {
    const statsKey = `search_stats:${workspaceId}`;
    const statsJson = await this.cache.get(statsKey);
    const stats = statsJson ? JSON.parse(statsJson) : { totalSearches: 0, queries: {} };

    const topQueries = Object.entries(stats.queries as Record<string, number>)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalSearches: stats.totalSearches,
      topQueries,
    };
  }
}
