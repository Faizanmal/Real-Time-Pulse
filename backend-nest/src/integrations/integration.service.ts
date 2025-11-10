import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { AsanaService } from './services/asana.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { HarvestService } from './services/harvest.service';
import type { IntegrationProvider } from '@prisma/client';

export interface IntegrationConfig {
  workspaceId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  settings?: Record<string, any>;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly asanaService: AsanaService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
    private readonly harvestService: HarvestService,
  ) {}

  /**
   * Create a new integration
   */
  async createIntegration(config: IntegrationConfig) {
    const integration = await this.prisma.integration.create({
      data: {
        workspaceId: config.workspaceId,
        provider: config.provider,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        expiresAt: config.expiresAt,
        settings: config.settings || {},
        status: 'ACTIVE',
      },
    });

    this.logger.log(
      `Integration created: ${integration.id} (${config.provider})`,
    );

    // Trigger initial sync
    await this.triggerSync(integration.id, 'full');

    return integration;
  }

  /**
   * Get all integrations for a workspace
   */
  async getIntegrations(workspaceId: string) {
    return this.prisma.integration.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
        settings: true,
      },
    });
  }

  /**
   * Get a single integration
   */
  async getIntegration(integrationId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return integration;
  }

  /**
   * Update integration settings
   */
  async updateIntegration(
    integrationId: string,
    settings: Record<string, any>,
  ) {
    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { settings },
    });
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(integrationId: string) {
    await this.prisma.integration.delete({
      where: { id: integrationId },
    });

    this.logger.log(`Integration deleted: ${integrationId}`);
  }

  /**
   * Trigger data sync for an integration
   */
  async triggerSync(
    integrationId: string,
    syncType: 'full' | 'incremental' = 'incremental',
  ) {
    const integration = await this.getIntegration(integrationId);

    await this.jobsService.queueDataSync({
      workspaceId: integration.workspaceId,
      integrationId: integration.id,
      syncType,
    });

    this.logger.log(`Sync triggered for integration: ${integrationId}`);
    return { message: 'Sync queued successfully' };
  }

  /**
   * Fetch data from an integration
   */
  async fetchData(integrationId: string, dataType: string, params?: any) {
    const integration = await this.getIntegration(integrationId);

    switch (integration.provider) {
      case 'ASANA':
        return this.asanaService.fetchData(integration, dataType, params);

      case 'GOOGLE_ANALYTICS':
      case 'GOOGLE_ANALYTICS_4':
        return this.googleAnalyticsService.fetchData(
          integration,
          dataType,
          params,
        );

      case 'HARVEST':
        return this.harvestService.fetchData(integration, dataType, params);

      default:
        throw new Error(`Unsupported provider: ${integration.provider}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(integrationId: string) {
    const integration = await this.getIntegration(integrationId);

    if (!integration.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Implement OAuth refresh flow based on provider
    // This is provider-specific and would require actual OAuth implementation
    this.logger.log(
      `Token refresh requested for integration: ${integrationId}`,
    );

    return { message: 'Token refresh not yet implemented' };
  }

  /**
   * Test integration connection
   */
  async testConnection(integrationId: string) {
    const integration = await this.getIntegration(integrationId);

    try {
      let result: boolean;

      switch (integration.provider) {
        case 'ASANA':
          result = await this.asanaService.testConnection(integration);
          break;

        case 'GOOGLE_ANALYTICS':
        case 'GOOGLE_ANALYTICS_4':
          result =
            await this.googleAnalyticsService.testConnection(integration);
          break;

        case 'HARVEST':
          result = await this.harvestService.testConnection(integration);
          break;

        default:
          throw new Error(`Unsupported provider: ${integration.provider}`);
      }

      return { connected: result };
    } catch (error) {
      this.logger.error(
        `Connection test failed for integration: ${integrationId}`,
        error,
      );
      return { connected: false, error: error.message };
    }
  }
}
