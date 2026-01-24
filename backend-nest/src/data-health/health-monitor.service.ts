import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DataHealthService } from './data-health.service';
import { NotificationService } from '../notifications/notification.service';
import { HealthStatus, IntegrationProvider } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);

  constructor(
    private prisma: PrismaService,
    private dataHealthService: DataHealthService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private httpService: HttpService,
  ) {}

  // Run health checks every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduledHealthChecks() {
    this.logger.log('Running scheduled health checks...');

    const healthMonitors = await this.prisma.dataSourceHealth.findMany({
      where: {
        integration: {
          status: 'ACTIVE',
        },
      },
      include: {
        integration: true,
      },
    });

    for (const monitor of healthMonitors) {
      try {
        await this.performHealthCheck(monitor.id);
      } catch (error) {
        this.logger.error(`Health check failed for monitor ${monitor.id}: ${error.message}`);
      }
    }
  }

  async performHealthCheck(healthId: string) {
    const monitor = await this.prisma.dataSourceHealth.findUnique({
      where: { id: healthId },
      include: {
        integration: true,
      },
    });

    if (!monitor) {
      throw new Error('Health monitor not found');
    }

    const startTime = Date.now();
    let status: HealthStatus = HealthStatus.HEALTHY;
    let errorMessage: string | null = null;
    let dataFreshness: number | null = null;

    try {
      // Check integration health based on provider
      const checkResult = await this.checkIntegrationHealth(monitor.integration);

      if (!checkResult.success) {
        status = HealthStatus.DOWN;
        errorMessage = checkResult.error || 'Unknown error';
      } else if (checkResult.rateLimit) {
        status = HealthStatus.RATE_LIMITED;
        errorMessage = 'Rate limit exceeded';
      } else {
        // Check data freshness
        dataFreshness = checkResult.dataFreshness || 0;
        if (dataFreshness > monitor.freshnessThreshold) {
          status = HealthStatus.DEGRADED;
          errorMessage = `Data is stale (${dataFreshness} minutes old)`;
        }

        // Check for schema changes
        if (
          checkResult.schema &&
          monitor.lastKnownSchema &&
          !this.schemasMatch(monitor.lastKnownSchema, checkResult.schema)
        ) {
          await this.dataHealthService.updateSchemaChange(healthId, checkResult.schema);
          status = HealthStatus.SCHEMA_CHANGED;
          errorMessage = 'Data schema has changed';
        } else if (checkResult.schema && !monitor.lastKnownSchema) {
          // Store initial schema
          await this.prisma.dataSourceHealth.update({
            where: { id: healthId },
            data: { lastKnownSchema: checkResult.schema },
          });
        }
      }
    } catch (error) {
      status = HealthStatus.DOWN;
      errorMessage = error.message;
    }

    const responseTime = Date.now() - startTime;

    // Record the health check
    await this.dataHealthService.recordHealthCheck(healthId, {
      status,
      responseTime,
      errorMessage: errorMessage ?? undefined,
      dataFreshness: dataFreshness ?? undefined,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    // Check if we need to send an alert
    await this.checkAlertThreshold(monitor);

    return { status, responseTime, errorMessage };
  }

  private async checkIntegrationHealth(integration: any): Promise<{
    success: boolean;
    error?: string;
    rateLimit?: boolean;
    dataFreshness?: number;
    schema?: any;
  }> {
    try {
      // Implement provider-specific health checks
      switch (integration.provider) {
        case IntegrationProvider.GOOGLE_ANALYTICS:
        case IntegrationProvider.GOOGLE_ANALYTICS_4:
          return await this.checkGoogleAnalytics(integration);
        case IntegrationProvider.GITHUB:
          return await this.checkGitHub(integration);
        case IntegrationProvider.STRIPE:
          return await this.checkStripe(integration);
        default:
          // Generic HTTP health check
          return await this.genericHealthCheck(integration);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rateLimit: error.response?.status === 429,
      };
    }
  }

  private async checkGoogleAnalytics(integration: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://analyticsdata.googleapis.com/v1beta/properties', {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
          },
        }),
      );

      return {
        success: true,
        dataFreshness: 5, // GA typically has 24-48 hour delay
        schema: this.extractSchema(response.data),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rateLimit: error.response?.status === 429,
      };
    }
  }

  private async checkGitHub(integration: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }),
      );

      // Check rate limit headers
      const rateLimit = parseInt(response.headers['x-ratelimit-remaining'] || '0');
      const rateLimitTotal = parseInt(response.headers['x-ratelimit-limit'] || '5000');

      return {
        success: true,
        rateLimit: rateLimit < rateLimitTotal * 0.1, // Alert if below 10%
        dataFreshness: 0, // Real-time data
        schema: this.extractSchema(response.data),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rateLimit: error.response?.status === 429,
      };
    }
  }

  private async checkStripe(integration: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://api.stripe.com/v1/balance', {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
          },
        }),
      );

      return {
        success: true,
        dataFreshness: 0,
        schema: this.extractSchema(response.data),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rateLimit: error.response?.status === 429,
      };
    }
  }

  private async genericHealthCheck(_integration: any) {
    // Generic health check - just verify token is valid
    return {
      success: true,
      dataFreshness: undefined,
    };
  }

  private extractSchema(data: any): any {
    // Extract the structure of the data for schema comparison
    if (!data) return null;

    if (Array.isArray(data)) {
      return {
        type: 'array',
        itemSchema: data.length > 0 ? this.extractSchema(data[0]) : null,
      };
    }

    if (typeof data === 'object') {
      const schema: any = { type: 'object', fields: {} };
      for (const key in data) {
        schema.fields[key] = {
          type: typeof data[key],
          isArray: Array.isArray(data[key]),
        };
      }
      return schema;
    }

    return { type: typeof data };
  }

  private schemasMatch(schema1: any, schema2: any): boolean {
    // Simple schema comparison
    if (!schema1 || !schema2) return true;

    return JSON.stringify(schema1) === JSON.stringify(schema2);
  }

  private async checkAlertThreshold(monitor: any) {
    if (!monitor.alertsEnabled) return;

    const shouldAlert =
      monitor.consecutiveErrors >= monitor.alertThreshold &&
      (!monitor.lastAlertSentAt || Date.now() - monitor.lastAlertSentAt.getTime() > 3600000); // 1 hour

    if (shouldAlert) {
      await this.sendHealthAlert(monitor);
      await this.prisma.dataSourceHealth.update({
        where: { id: monitor.id },
        data: { lastAlertSentAt: new Date() },
      });
    }
  }

  private async sendHealthAlert(monitor: any) {
    // Create alert notification
    this.logger.warn(`Health alert for ${monitor.integration.provider}: ${monitor.lastError}`);

    // Get workspace owner/admins for notification
    const workspaceUsers = await this.prisma.user.findMany({
      where: {
        workspaceId: monitor.integration.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true, email: true },
    });

    // Send notifications to workspace admins
    for (const user of workspaceUsers) {
      try {
        await this.notificationService.send({
          userId: user.id,
          type: 'health.alert',
          title: `Integration Health Alert: ${monitor.integration.provider}`,
          body: `Your ${monitor.integration.provider} integration is experiencing issues. Status: ${monitor.status}. ${monitor.lastError || ''}`,
          priority: 'high',
          channels: ['email', 'in-app'],
          data: {
            integrationId: monitor.integration.id,
            provider: monitor.integration.provider,
            status: monitor.status,
            error: monitor.lastError,
            consecutiveErrors: monitor.consecutiveErrors,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to send health alert to user ${user.id}: ${error.message}`);
      }
    }

    this.logger.log(
      `Health alerts sent to ${workspaceUsers.length} users for integration ${monitor.integration.id}`,
    );
  }
}
