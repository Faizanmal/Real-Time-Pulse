import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { IntegrationService } from '../integrations/integration.service';
import {
  CreateWidgetDto,
  UpdateWidgetDto,
  WidgetResponseDto,
} from './dto/widget.dto';

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(forwardRef(() => IntegrationService))
    private readonly integrationService: IntegrationService,
  ) {}

  /**
   * Create a new widget
   */
  async create(
    workspaceId: string,
    dto: CreateWidgetDto,
  ): Promise<WidgetResponseDto> {
    // Verify portal exists and belongs to workspace

    const portal = await (this.prisma as any).portal.findUnique({
      where: { id: dto.portalId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    // Verify integration if provided
    if (dto.integrationId) {
      const integration = await (this.prisma as any).integration.findUnique({
        where: { id: dto.integrationId },
      });

      if (!integration || integration.workspaceId !== workspaceId) {
        throw new BadRequestException('Invalid integration');
      }
    }

    // Create widget

    const widget = await (this.prisma as any).widget.create({
      data: {
        name: dto.name,
        type: dto.type,
        config: dto.config || {},
        gridWidth: dto.gridWidth || 4,
        gridHeight: dto.gridHeight || 3,
        gridX: dto.gridX || 0,
        gridY: dto.gridY || 0,
        refreshInterval: dto.refreshInterval || 300,
        portalId: dto.portalId,
        integrationId: dto.integrationId,
      },
      include: {
        integration: {
          select: {
            id: true,
            provider: true,
            accountName: true,
          },
        },
      },
    });

    // Invalidate portal cache
    await this.cache.invalidatePortal(dto.portalId);

    return this.formatWidgetResponse(widget);
  }

  /**
   * Get all widgets for a portal
   */
  async findAllByPortal(
    portalId: string,
    workspaceId: string,
  ): Promise<WidgetResponseDto[]> {
    // Verify portal exists and belongs to workspace

    const portal = await (this.prisma as any).portal.findUnique({
      where: { id: portalId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    const widgets = await (this.prisma as any).widget.findMany({
      where: { portalId },
      include: {
        integration: {
          select: {
            id: true,
            provider: true,
            accountName: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return widgets.map((widget) => this.formatWidgetResponse(widget));
  }

  /**
   * Get widget by ID
   */
  async findOne(
    widgetId: string,
    workspaceId: string,
  ): Promise<WidgetResponseDto> {
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
      include: {
        portal: true,
        integration: {
          select: {
            id: true,
            provider: true,
            accountName: true,
          },
        },
      },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    if (widget.portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this widget');
    }

    return this.formatWidgetResponse(widget);
  }

  /**
   * Update widget
   */
  async update(
    widgetId: string,
    workspaceId: string,
    dto: UpdateWidgetDto,
  ): Promise<WidgetResponseDto> {
    // Verify widget exists and belongs to workspace

    const existingWidget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
      include: { portal: true },
    });

    if (!existingWidget) {
      throw new NotFoundException('Widget not found');
    }

    if (existingWidget.portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this widget');
    }

    const widget = await (this.prisma as any).widget.update({
      where: { id: widgetId },
      data: {
        name: dto.name,
        config: dto.config,
        gridWidth: dto.gridWidth,
        gridHeight: dto.gridHeight,
        gridX: dto.gridX,
        gridY: dto.gridY,
        refreshInterval: dto.refreshInterval,
      },
      include: {
        integration: {
          select: {
            id: true,
            provider: true,
            accountName: true,
          },
        },
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.invalidateWidget(widgetId),

      this.cache.invalidatePortal(widget.portalId),
    ]);

    return this.formatWidgetResponse(widget);
  }

  /**
   * Delete widget
   */
  async remove(widgetId: string, workspaceId: string): Promise<void> {
    // Verify widget exists and belongs to workspace

    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
      include: { portal: true },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    if (widget.portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this widget');
    }

    await (this.prisma as any).widget.delete({
      where: { id: widgetId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.invalidateWidget(widgetId),

      this.cache.invalidatePortal(widget.portalId),
    ]);
  }

  /**
   * Refresh widget data from integration
   */

  async refreshData(widgetId: string, workspaceId: string): Promise<any> {
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
      include: {
        portal: true,
        integration: true,
      },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    if (widget.portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this widget');
    }

    if (!widget.integration) {
      throw new BadRequestException('Widget has no integration configured');
    }

    // Fetch real data from the integration
    let data: any;
    try {
      const dataType = this.getDataTypeForWidget(widget.type, widget.config);
      const params = this.getParamsForWidget(widget.config);

      data = await this.integrationService.fetchData(
        widget.integration.id,
        dataType,
        params,
      );

      // Transform data based on widget type
      data = this.transformDataForWidget(widget.type, data, widget.config);
    } catch (error) {
      this.logger.error(
        `Failed to fetch integration data for widget ${widgetId}: ${error.message}`,
      );
      // Return cached data if available, or fallback data
      const cachedData = await this.cache.getWidgetData(widgetId);
      if (cachedData) {
        return {
          ...this.formatWidgetResponse(widget),
          data: cachedData,
          lastRefreshedAt: widget.lastRefreshedAt,
          error: 'Using cached data - integration temporarily unavailable',
        };
      }

      // Return fallback data structure
      data = this.getFallbackData(widget.type);
    }

    // Cache the data
    await this.cache.cacheWidgetData(widgetId, data, widget.refreshInterval);

    // Update last refreshed time
    await (this.prisma as any).widget.update({
      where: { id: widgetId },
      data: { lastRefreshedAt: new Date() },
    });

    const base = this.formatWidgetResponse(widget);

    return {
      ...base,
      data,
      lastRefreshedAt: new Date(),
    };
  }

  /**
   * Get data type for widget based on widget type
   */
  private getDataTypeForWidget(widgetType: string, config: any): string {
    const dataTypeMap: Record<string, string> = {
      ASANA_TASKS: 'tasks',
      ASANA_PROJECTS: 'projects',
      GITHUB_ISSUES: 'issues',
      GITHUB_COMMITS: 'commits',
      GITHUB_PRS: 'pull_requests',
      JIRA_ISSUES: 'issues',
      JIRA_SPRINTS: 'sprints',
      TRELLO_CARDS: 'cards',
      TRELLO_LISTS: 'lists',
      GA_PAGEVIEWS: 'pageviews',
      GA_SESSIONS: 'sessions',
      GA_USERS: 'users',
      HARVEST_HOURS: 'time_entries',
      HARVEST_PROJECTS: 'projects',
      HUBSPOT_CONTACTS: 'contacts',
      HUBSPOT_DEALS: 'deals',
      SLACK_MESSAGES: 'messages',
    };

    return dataTypeMap[widgetType] || config?.dataType || 'default';
  }

  /**
   * Get params for widget from config
   */
  private getParamsForWidget(config: any): Record<string, any> {
    return {
      limit: config?.limit || 50,
      startDate: config?.startDate,
      endDate: config?.endDate,
      projectId: config?.projectId,
      ...(config?.params || {}),
    };
  }

  /**
   * Transform raw integration data for widget display
   */
  private transformDataForWidget(
    widgetType: string,
    rawData: any,
    config: any,
  ): any {
    if (!rawData) return this.getFallbackData(widgetType);

    // If raw data is an array, process it
    if (Array.isArray(rawData)) {
      const limit = config?.limit || 50;
      const items = rawData.slice(0, limit);

      return {
        items,
        count: items.length,
        total: rawData.length,
        summary: this.generateSummary(widgetType, items),
        timestamp: new Date().toISOString(),
      };
    }

    // If raw data is an object with data property
    if (rawData.data && Array.isArray(rawData.data)) {
      return {
        items: rawData.data,
        count: rawData.data.length,
        total: rawData.total || rawData.data.length,
        metadata: rawData.metadata,
        timestamp: new Date().toISOString(),
      };
    }

    // Return as-is with timestamp
    return {
      ...rawData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate summary statistics for widget data
   */
  private generateSummary(
    widgetType: string,
    items: any[],
  ): Record<string, any> {
    const summary: Record<string, any> = {
      total: items.length,
    };

    if (widgetType.includes('TASKS') || widgetType.includes('ISSUES')) {
      summary.completed = items.filter(
        (i) => i.completed || i.status === 'done' || i.status === 'closed',
      ).length;
      summary.pending = summary.total - summary.completed;
      summary.completionRate =
        summary.total > 0
          ? Math.round((summary.completed / summary.total) * 100)
          : 0;
    }

    if (widgetType.includes('HOURS') || widgetType.includes('TIME')) {
      summary.totalHours = items.reduce((acc, i) => acc + (i.hours || 0), 0);
      summary.billableHours = items
        .filter((i) => i.billable)
        .reduce((acc, i) => acc + (i.hours || 0), 0);
    }

    return summary;
  }

  /**
   * Get fallback data when integration fails
   */
  private getFallbackData(widgetType: string): any {
    return {
      items: [],
      count: 0,
      total: 0,
      summary: { total: 0 },
      timestamp: new Date().toISOString(),
      error: 'Data temporarily unavailable',
    };
  }

  /**
   * Format widget response
   */

  private formatWidgetResponse(widget: any): WidgetResponseDto {
    return {
      id: widget.id,
      name: widget.name,
      type: widget.type,
      config: widget.config,
      gridWidth: widget.gridWidth,
      gridHeight: widget.gridHeight,
      gridX: widget.gridX,
      gridY: widget.gridY,
      refreshInterval: widget.refreshInterval,
      lastRefreshedAt: widget.lastRefreshedAt,
      portalId: widget.portalId,
      integrationId: widget.integrationId,
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt,
      integration: widget.integration,
    };
  }
}
