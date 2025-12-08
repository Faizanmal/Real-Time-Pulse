import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface BulkOperationResult<T = unknown> {
  success: boolean;
  id: string;
  data?: T;
  error?: string;
}

export interface BulkOperationSummary<T = unknown> {
  totalRequested: number;
  successful: number;
  failed: number;
  results: BulkOperationResult<T>[];
}

@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Bulk update widgets
   */
  async bulkUpdateWidgets(
    workspaceId: string,
    updates: { widgetId: string; data: Record<string, unknown> }[],
  ): Promise<BulkOperationSummary> {
    const results: BulkOperationResult[] = [];

    for (const update of updates) {
      try {
        // Verify widget belongs to workspace
        const widget = await this.prisma.widget.findFirst({
          where: {
            id: update.widgetId,
            portal: { workspaceId },
          },
        });

        if (!widget) {
          results.push({
            success: false,
            id: update.widgetId,
            error: 'Widget not found or access denied',
          });
          continue;
        }

        // Update widget
        const updated = await this.prisma.widget.update({
          where: { id: update.widgetId },
          data: update.data as any,
        });

        results.push({
          success: true,
          id: update.widgetId,
          data: updated,
        });

        // Invalidate cache
        await this.cacheService.invalidateWidget(update.widgetId);
      } catch (error) {
        results.push({
          success: false,
          id: update.widgetId,
          error: (error as Error).message,
        });
      }
    }

    const summary: BulkOperationSummary = {
      totalRequested: updates.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };

    this.logger.log(
      `Bulk widget update: ${summary.successful}/${summary.totalRequested} successful`,
    );
    return summary;
  }

  /**
   * Bulk delete widgets
   */
  async bulkDeleteWidgets(
    workspaceId: string,
    widgetIds: string[],
  ): Promise<BulkOperationSummary> {
    const results: BulkOperationResult[] = [];

    for (const widgetId of widgetIds) {
      try {
        const widget = await this.prisma.widget.findFirst({
          where: {
            id: widgetId,
            portal: { workspaceId },
          },
        });

        if (!widget) {
          results.push({
            success: false,
            id: widgetId,
            error: 'Widget not found or access denied',
          });
          continue;
        }

        await this.prisma.widget.delete({ where: { id: widgetId } });
        await this.cacheService.invalidateWidget(widgetId);

        results.push({
          success: true,
          id: widgetId,
        });
      } catch (error) {
        results.push({
          success: false,
          id: widgetId,
          error: (error as Error).message,
        });
      }
    }

    return {
      totalRequested: widgetIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Clone portal with all widgets
   */
  async clonePortal(
    portalId: string,
    workspaceId: string,
    userId: string,
    options?: {
      newName?: string;
      includeWidgets?: boolean;
      includeShareLinks?: boolean;
    },
  ): Promise<{ portalId: string; widgetsCloned: number }> {
    // Get source portal
    const sourcePortal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: true,
      },
    });

    if (!sourcePortal) {
      throw new NotFoundException('Portal not found');
    }

    // Create new portal
    const newPortal = await this.prisma.portal.create({
      data: {
        workspaceId,
        name: options?.newName || `${sourcePortal.name} (Copy)`,
        slug: `${sourcePortal.slug}-copy-${Date.now()}`,
        description: sourcePortal.description,
        isPublic: sourcePortal.isPublic,
        layout: sourcePortal.layout as Prisma.InputJsonValue,
        cacheRefreshInterval: sourcePortal.cacheRefreshInterval,
        createdById: userId,
      },
    });

    let widgetsCloned = 0;

    // Clone widgets if requested
    if (options?.includeWidgets !== false && sourcePortal.widgets.length > 0) {
      for (const widget of sourcePortal.widgets) {
        await this.prisma.widget.create({
          data: {
            portalId: newPortal.id,
            name: widget.name,
            type: widget.type,
            config: widget.config as Prisma.InputJsonValue,
            gridX: widget.gridX,
            gridY: widget.gridY,
            gridWidth: widget.gridWidth,
            gridHeight: widget.gridHeight,
            refreshInterval: widget.refreshInterval,
            integrationId: widget.integrationId,
            order: widget.order,
          },
        });
        widgetsCloned++;
      }
    }

    this.logger.log(
      `Portal ${portalId} cloned to ${newPortal.id} with ${widgetsCloned} widgets`,
    );

    return {
      portalId: newPortal.id,
      widgetsCloned,
    };
  }

  /**
   * Bulk clone portals
   */
  async bulkClonePortals(
    workspaceId: string,
    userId: string,
    portalIds: string[],
  ): Promise<
    BulkOperationSummary<{ portalId: string; widgetsCloned: number }>
  > {
    const results: BulkOperationResult<{
      portalId: string;
      widgetsCloned: number;
    }>[] = [];

    for (const portalId of portalIds) {
      try {
        const result = await this.clonePortal(portalId, workspaceId, userId);
        results.push({
          success: true,
          id: portalId,
          data: result,
        });
      } catch (error) {
        results.push({
          success: false,
          id: portalId,
          error: (error as Error).message,
        });
      }
    }

    return {
      totalRequested: portalIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Bulk create alerts
   */
  async bulkCreateAlerts(
    workspaceId: string,
    userId: string,
    alerts: {
      name: string;
      description?: string;
      portalId?: string;
      widgetId?: string;
      condition: Record<string, unknown>;
      channels: string[];
      emailRecipients?: string[];
    }[],
  ): Promise<BulkOperationSummary> {
    const results: BulkOperationResult[] = [];

    for (const alertData of alerts) {
      try {
        // Verify portal if specified
        if (alertData.portalId) {
          const portal = await this.prisma.portal.findFirst({
            where: { id: alertData.portalId, workspaceId },
          });
          if (!portal) {
            results.push({
              success: false,
              id: alertData.name,
              error: 'Portal not found',
            });
            continue;
          }
        }

        const alert = await this.prisma.alert.create({
          data: {
            workspaceId,
            name: alertData.name,
            description: alertData.description,
            portalId: alertData.portalId,
            widgetId: alertData.widgetId,
            condition: alertData.condition as Prisma.InputJsonValue,
            channels: alertData.channels,
            emailRecipients: alertData.emailRecipients || [],
            createdById: userId,
            isActive: true,
          },
        });

        results.push({
          success: true,
          id: alert.id,
          data: alert,
        });
      } catch (error) {
        results.push({
          success: false,
          id: alertData.name,
          error: (error as Error).message,
        });
      }
    }

    return {
      totalRequested: alerts.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Bulk export portals
   */
  async bulkExportPortalConfigs(
    workspaceId: string,
    portalIds: string[],
  ): Promise<{
    portals: {
      id: string;
      name: string;
      config: Record<string, unknown>;
      widgets: Record<string, unknown>[];
    }[];
  }> {
    const portals: any[] = [];

    for (const portalId of portalIds) {
      const portal = await this.prisma.portal.findFirst({
        where: { id: portalId, workspaceId },
        include: {
          widgets: {
            include: {
              integration: {
                select: { provider: true },
              },
            },
          },
        },
      });

      if (portal) {
        portals.push({
          id: portal.id,
          name: portal.name,
          config: {
            slug: portal.slug,
            description: portal.description,
            isPublic: portal.isPublic,
            layout: portal.layout,
            cacheRefreshInterval: portal.cacheRefreshInterval,
          },
          widgets: portal.widgets.map((w) => ({
            name: w.name,
            type: w.type,
            config: w.config,
            gridX: w.gridX,
            gridY: w.gridY,
            gridWidth: w.gridWidth,
            gridHeight: w.gridHeight,
            refreshInterval: w.refreshInterval,
            integrationProvider: w.integration?.provider,
          })),
        });
      }
    }

    return { portals };
  }

  /**
   * Bulk import portal configs
   */
  async bulkImportPortalConfigs(
    workspaceId: string,
    userId: string,
    configs: {
      name: string;
      config: Record<string, unknown>;
      widgets: Record<string, unknown>[];
    }[],
  ): Promise<BulkOperationSummary<{ portalId: string }>> {
    const results: BulkOperationResult<{ portalId: string }>[] = [];

    for (const config of configs) {
      try {
        const portal = await this.prisma.portal.create({
          data: {
            workspaceId,
            name: config.name,
            slug: `${config.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            description: (config.config.description as string) || null,
            isPublic: (config.config.isPublic as boolean) ?? true,
            layout: config.config.layout || [],
            cacheRefreshInterval:
              (config.config.cacheRefreshInterval as number) || 30,
            createdById: userId,
          },
        });

        // Create widgets
        for (const widget of config.widgets) {
          await this.prisma.widget.create({
            data: {
              portalId: portal.id,
              name: widget.name as string,
              type: widget.type as any,
              config: (widget.config as any) || {},
              gridX: (widget.gridX as number) || 0,
              gridY: (widget.gridY as number) || 0,
              gridWidth: (widget.gridWidth as number) || 4,
              gridHeight: (widget.gridHeight as number) || 4,
              refreshInterval: (widget.refreshInterval as number) || 300,
            },
          });
        }

        results.push({
          success: true,
          id: config.name,
          data: { portalId: portal.id },
        });
      } catch (error) {
        results.push({
          success: false,
          id: config.name,
          error: (error as Error).message,
        });
      }
    }

    return {
      totalRequested: configs.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Bulk update alert status
   */
  async bulkUpdateAlertStatus(
    workspaceId: string,
    alertIds: string[],
    isActive: boolean,
  ): Promise<BulkOperationSummary> {
    const results: BulkOperationResult[] = [];

    for (const alertId of alertIds) {
      try {
        const alert = await this.prisma.alert.findFirst({
          where: { id: alertId, workspaceId },
        });

        if (!alert) {
          results.push({
            success: false,
            id: alertId,
            error: 'Alert not found',
          });
          continue;
        }

        await this.prisma.alert.update({
          where: { id: alertId },
          data: { isActive },
        });

        results.push({
          success: true,
          id: alertId,
        });
      } catch (error) {
        results.push({
          success: false,
          id: alertId,
          error: (error as Error).message,
        });
      }
    }

    return {
      totalRequested: alertIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}
