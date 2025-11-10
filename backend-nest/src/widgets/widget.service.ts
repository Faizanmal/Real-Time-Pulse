import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import {
  CreateWidgetDto,
  UpdateWidgetDto,
  WidgetResponseDto,
} from './dto/widget.dto';

@Injectable()
export class WidgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Create a new widget
   */
  async create(
    workspaceId: string,
    dto: CreateWidgetDto,
  ): Promise<WidgetResponseDto> {
    // Verify portal exists and belongs to workspace
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const portal = await (this.prisma as any).portal.findUnique({
      where: { id: dto.portalId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    // Verify integration if provided
    if (dto.integrationId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const integration = await (this.prisma as any).integration.findUnique({
        where: { id: dto.integrationId },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!integration || integration.workspaceId !== workspaceId) {
        throw new BadRequestException('Invalid integration');
      }
    }

    // Create widget
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const widget = await (this.prisma as any).widget.create({
      data: {
        name: dto.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        type: dto.type as any, // TODO: Update enum to match DTO
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const portal = await (this.prisma as any).portal.findUnique({
      where: { id: portalId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return widgets.map((widget) => this.formatWidgetResponse(widget));
  }

  /**
   * Get widget by ID
   */
  async findOne(
    widgetId: string,
    workspaceId: string,
  ): Promise<WidgetResponseDto> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingWidget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
      include: { portal: true },
    });

    if (!existingWidget) {
      throw new NotFoundException('Widget not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (existingWidget.portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this widget');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      this.cache.invalidatePortal(widget.portalId),
    ]);

    return this.formatWidgetResponse(widget);
  }

  /**
   * Delete widget
   */
  async remove(widgetId: string, workspaceId: string): Promise<void> {
    // Verify widget exists and belongs to workspace
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
      include: { portal: true },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (widget.portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this widget');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).widget.delete({
      where: { id: widgetId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.invalidateWidget(widgetId),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      this.cache.invalidatePortal(widget.portalId),
    ]);
  }

  /**
   * Refresh widget data from integration
   */
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
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

    // TODO: Implement actual integration data fetching
    // For now, return mock data
    const mockData = {
      value: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      source: widget.integration.provider,
    };

    // Cache the data
    await this.cache.cacheWidgetData(
      widgetId,
      mockData,
      widget.refreshInterval,
    );

    // Update last refreshed time
    await (this.prisma as any).widget.update({
      where: { id: widgetId },
      data: { lastRefreshedAt: new Date() },
    });

    const base = this.formatWidgetResponse(widget);

    return {
      ...base,
      data: mockData,
      lastRefreshedAt: new Date(),
    };
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

  /**
   * Format widget response
   */
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
}
