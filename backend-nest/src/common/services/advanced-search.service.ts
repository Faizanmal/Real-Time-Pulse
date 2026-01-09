import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

export interface SearchResult {
  type: 'portal' | 'widget' | 'integration' | 'alert' | 'report' | 'user';
  id: string;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  relevanceScore: number;
  highlightedText?: string;
}

export interface SearchFilters {
  types?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  tags?: string[];
  status?: string[];
  createdBy?: string;
  integrationProvider?: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  query?: string;
  filters: SearchFilters;
  createdAt: string;
  userId: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    types: { type: string; count: number }[];
    integrations: { provider: string; count: number }[];
    tags: { tag: string; count: number }[];
  };
  suggestions: string[];
}

@Injectable()
export class AdvancedSearchService {
  private readonly logger = new Logger(AdvancedSearchService.name);
  private readonly SAVED_FILTERS_PREFIX = 'search:filters:';
  private readonly RECENT_SEARCHES_PREFIX = 'search:recent:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Global search across all entities
   */
  async globalSearch(
    workspaceId: string,
    query: string,
    filters?: SearchFilters,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<SearchResponse> {
    const results: SearchResult[] = [];
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const searchTypes = filters?.types || [
      'portal',
      'widget',
      'integration',
      'alert',
      'report',
    ];

    // Search portals
    if (searchTypes.includes('portal')) {
      const portals = await this.searchPortals(workspaceId, query, filters);
      results.push(...portals);
    }

    // Search widgets
    if (searchTypes.includes('widget')) {
      const widgets = await this.searchWidgets(workspaceId, query, filters);
      results.push(...widgets);
    }

    // Search integrations
    if (searchTypes.includes('integration')) {
      const integrations = await this.searchIntegrations(
        workspaceId,
        query,
        filters,
      );
      results.push(...integrations);
    }

    // Search alerts
    if (searchTypes.includes('alert')) {
      const alerts = await this.searchAlerts(workspaceId, query, filters);
      results.push(...alerts);
    }

    // Search scheduled reports
    if (searchTypes.includes('report')) {
      const reports = await this.searchReports(workspaceId, query, filters);
      results.push(...reports);
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Calculate facets
    const facets = this.calculateFacets(results);

    // Generate suggestions
    const suggestions = await this.generateSuggestions(workspaceId, query);

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: results.length,
      facets,
      suggestions,
    };
  }

  /**
   * Search portals
   */
  private async searchPortals(
    workspaceId: string,
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const portals = await this.prisma.portal.findMany({
      where: {
        workspaceId,
        OR: query
          ? [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
        ...(filters?.dateRange?.start && {
          createdAt: {
            gte: new Date(filters.dateRange.start),
            ...(filters.dateRange.end && {
              lte: new Date(filters.dateRange.end),
            }),
          },
        }),
        ...(filters?.createdBy && { createdById: filters.createdBy }),
      },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        _count: {
          select: { widgets: true },
        },
      },
      take: 50,
    });

    return portals.map((portal) => ({
      type: 'portal' as const,
      id: portal.id,
      title: portal.name,
      description: portal.description || undefined,
      metadata: {
        slug: portal.slug,
        isPublic: portal.isPublic,
        widgetCount: portal._count.widgets,
        createdBy: portal.createdBy,
        createdAt: portal.createdAt,
      },
      relevanceScore: this.calculateRelevance(
        query,
        portal.name,
        portal.description,
      ),
      highlightedText: this.highlightText(portal.name, query),
    }));
  }

  /**
   * Search widgets
   */
  private async searchWidgets(
    workspaceId: string,
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const widgets = await this.prisma.widget.findMany({
      where: {
        portal: { workspaceId },
        OR: query
          ? [{ name: { contains: query, mode: 'insensitive' } }]
          : undefined,
        ...(filters?.integrationProvider && {
          integration: { provider: filters.integrationProvider as any },
        }),
      },
      include: {
        portal: {
          select: { name: true, slug: true },
        },
        integration: {
          select: { provider: true },
        },
      },
      take: 50,
    });

    return widgets.map((widget) => ({
      type: 'widget' as const,
      id: widget.id,
      title: widget.name,
      description: `Widget in ${widget.portal.name}`,
      metadata: {
        type: widget.type,
        portalName: widget.portal.name,
        portalSlug: widget.portal.slug,
        integrationProvider: widget.integration?.provider,
      },
      relevanceScore: this.calculateRelevance(query, widget.name),
      highlightedText: this.highlightText(widget.name, query),
    }));
  }

  /**
   * Search integrations
   */
  private async searchIntegrations(
    workspaceId: string,
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const integrations = await this.prisma.integration.findMany({
      where: {
        workspaceId,
        OR: query
          ? [{ accountName: { contains: query, mode: 'insensitive' } }]
          : undefined,
        ...(filters?.status && { status: { in: filters.status as any[] } }),
      },
      take: 50,
    });

    return integrations.map((integration) => ({
      type: 'integration' as const,
      id: integration.id,
      title: `${integration.provider} Integration`,
      description: integration.accountName || undefined,
      metadata: {
        provider: integration.provider,
        status: integration.status,
        lastSyncedAt: integration.lastSyncedAt,
      },
      relevanceScore: this.calculateRelevance(
        query,
        integration.provider,
        integration.accountName,
      ),
      highlightedText: this.highlightText(integration.provider, query),
    }));
  }

  /**
   * Search alerts
   */
  private async searchAlerts(
    workspaceId: string,
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const alerts = await this.prisma.alert.findMany({
      where: {
        workspaceId,
        OR: query
          ? [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
        ...(filters?.status && { isActive: filters.status.includes('active') }),
      },
      take: 50,
    });

    return alerts.map((alert) => ({
      type: 'alert' as const,
      id: alert.id,
      title: alert.name,
      description: alert.description || undefined,
      metadata: {
        isActive: alert.isActive,
        lastTriggeredAt: alert.lastTriggeredAt,
        triggerCount: alert.triggerCount,
      },
      relevanceScore: this.calculateRelevance(
        query,
        alert.name,
        alert.description,
      ),
      highlightedText: this.highlightText(alert.name, query),
    }));
  }

  /**
   * Search scheduled reports
   */
  private async searchReports(
    workspaceId: string,
    query: string,
    _filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const reports = await this.prisma.scheduledReport.findMany({
      where: {
        workspaceId,
        OR: query
          ? [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        portal: {
          select: { name: true },
        },
      },
      take: 50,
    });

    return reports.map((report) => ({
      type: 'report' as const,
      id: report.id,
      title: report.name,
      description: report.description || `Report for ${report.portal.name}`,
      metadata: {
        format: report.format,
        isActive: report.isActive,
        schedule: report.schedule,
        portalName: report.portal.name,
      },
      relevanceScore: this.calculateRelevance(
        query,
        report.name,
        report.description,
      ),
      highlightedText: this.highlightText(report.name, query),
    }));
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(
    query: string,
    ...fields: (string | null | undefined)[]
  ): number {
    if (!query) return 0.5;

    const queryLower = query.toLowerCase();
    let score = 0;

    for (const field of fields) {
      if (!field) continue;
      const fieldLower = field.toLowerCase();

      // Exact match
      if (fieldLower === queryLower) {
        score += 1;
      }
      // Starts with
      else if (fieldLower.startsWith(queryLower)) {
        score += 0.8;
      }
      // Contains
      else if (fieldLower.includes(queryLower)) {
        score += 0.5;
      }
      // Word match
      else if (
        fieldLower.split(/\s+/).some((word) => word.startsWith(queryLower))
      ) {
        score += 0.3;
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Highlight matching text
   */
  private highlightText(text: string, query: string): string {
    if (!query || !text) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Calculate facets from results
   */
  private calculateFacets(results: SearchResult[]): SearchResponse['facets'] {
    const typeCounts = new Map<string, number>();
    const integrationCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();

    for (const result of results) {
      // Count by type
      typeCounts.set(result.type, (typeCounts.get(result.type) || 0) + 1);

      // Count by integration provider
      const provider = result.metadata.integrationProvider as string;
      if (provider) {
        integrationCounts.set(
          provider,
          (integrationCounts.get(provider) || 0) + 1,
        );
      }

      // Count tags if present
      const tags = result.metadata.tags as string[];
      if (tags) {
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    return {
      types: Array.from(typeCounts.entries()).map(([type, count]) => ({
        type,
        count,
      })),
      integrations: Array.from(integrationCounts.entries()).map(
        ([provider, count]) => ({
          provider,
          count,
        }),
      ),
      tags: Array.from(tagCounts.entries()).map(([tag, count]) => ({
        tag,
        count,
      })),
    };
  }

  /**
   * Generate search suggestions based on query
   */
  private async generateSuggestions(
    workspaceId: string,
    query: string,
  ): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const suggestions: string[] = [];

    // Get similar portal names
    const portals = await this.prisma.portal.findMany({
      where: {
        workspaceId,
        name: { startsWith: query, mode: 'insensitive' },
      },
      select: { name: true },
      take: 5,
    });
    suggestions.push(...portals.map((p) => p.name));

    // Get similar widget names
    const widgets = await this.prisma.widget.findMany({
      where: {
        portal: { workspaceId },
        name: { startsWith: query, mode: 'insensitive' },
      },
      select: { name: true },
      take: 5,
    });
    suggestions.push(...widgets.map((w) => w.name));

    return [...new Set(suggestions)].slice(0, 10);
  }

  /**
   * Save search filter preset
   */
  async saveFilter(
    userId: string,
    name: string,
    query?: string,
    filters?: SearchFilters,
  ): Promise<SavedFilter> {
    const savedFilter: SavedFilter = {
      id: `filter_${Date.now()}`,
      name,
      query,
      filters: filters || {},
      createdAt: new Date().toISOString(),
      userId,
    };

    const existing = await this.getSavedFilters(userId);
    existing.push(savedFilter);

    await this.cacheService.set(
      `${this.SAVED_FILTERS_PREFIX}${userId}`,
      JSON.stringify(existing),
      365 * 24 * 60 * 60,
    );

    return savedFilter;
  }

  /**
   * Get saved filters for user
   */
  async getSavedFilters(userId: string): Promise<SavedFilter[]> {
    const cached = await this.cacheService.get(
      `${this.SAVED_FILTERS_PREFIX}${userId}`,
    );
    return cached ? JSON.parse(cached) : [];
  }

  /**
   * Delete saved filter
   */
  async deleteSavedFilter(userId: string, filterId: string): Promise<void> {
    const filters = await this.getSavedFilters(userId);
    const updated = filters.filter((f) => f.id !== filterId);

    await this.cacheService.set(
      `${this.SAVED_FILTERS_PREFIX}${userId}`,
      JSON.stringify(updated),
      365 * 24 * 60 * 60,
    );
  }

  /**
   * Record recent search
   */
  async recordRecentSearch(userId: string, query: string): Promise<void> {
    const key = `${this.RECENT_SEARCHES_PREFIX}${userId}`;
    const cached = await this.cacheService.get(key);
    const recent: string[] = cached ? JSON.parse(cached) : [];

    // Remove if exists and add to front
    const filtered = recent.filter((q) => q !== query);
    filtered.unshift(query);

    // Keep only last 10
    const trimmed = filtered.slice(0, 10);

    await this.cacheService.set(
      key,
      JSON.stringify(trimmed),
      30 * 24 * 60 * 60,
    );
  }

  /**
   * Get recent searches
   */
  async getRecentSearches(userId: string): Promise<string[]> {
    const cached = await this.cacheService.get(
      `${this.RECENT_SEARCHES_PREFIX}${userId}`,
    );
    return cached ? JSON.parse(cached) : [];
  }

  /**
   * Clear recent searches
   */
  async clearRecentSearches(userId: string): Promise<void> {
    await this.cacheService.del(`${this.RECENT_SEARCHES_PREFIX}${userId}`);
  }
}
