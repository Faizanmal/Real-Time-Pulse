import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthStatus } from '@prisma/client';

@Injectable()
export class DataHealthService {
  private readonly logger = new Logger(DataHealthService.name);

  constructor(private prisma: PrismaService) {}

  async createHealthMonitor(data: {
    workspaceId: string;
    integrationId: string;
    freshnessThreshold?: number;
    alertThreshold?: number;
  }) {
    return this.prisma.dataSourceHealth.create({
      data: {
        workspaceId: data.workspaceId,
        integrationId: data.integrationId,
        freshnessThreshold: data.freshnessThreshold || 60,
        alertThreshold: data.alertThreshold || 3,
      },
      include: {
        integration: true,
      },
    });
  }

  async getHealthStatus(workspaceId: string) {
    return this.prisma.dataSourceHealth.findMany({
      where: { workspaceId },
      include: {
        integration: true,
        healthChecks: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { lastCheckAt: 'desc' },
    });
  }

  async getHealthById(healthId: string) {
    return this.prisma.dataSourceHealth.findUnique({
      where: { id: healthId },
      include: {
        integration: true,
        healthChecks: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async recordHealthCheck(
    dataSourceHealthId: string,
    checkData: {
      status: HealthStatus;
      responseTime?: number;
      errorMessage?: string;
      dataFreshness?: number;
      recordsChecked?: number;
      metadata?: any;
    },
  ) {
    const healthCheck = await this.prisma.dataSourceHealthCheck.create({
      data: {
        dataSourceHealthId,
        ...checkData,
      },
    });

    // Update the health monitor
    const updateData: any = {
      lastCheckAt: new Date(),
      status: checkData.status,
      responseTime: checkData.responseTime,
      dataFreshness: checkData.dataFreshness,
    };

    if (checkData.status === HealthStatus.HEALTHY) {
      updateData.lastSuccessAt = new Date();
      updateData.consecutiveErrors = 0;
      updateData.lastError = null;
    } else {
      updateData.lastErrorAt = new Date();
      updateData.consecutiveErrors = { increment: 1 };
      updateData.errorCount = { increment: 1 };
      if (checkData.errorMessage) {
        updateData.lastError = checkData.errorMessage;
      }
    }

    if (checkData.status === HealthStatus.RATE_LIMITED) {
      updateData.rateLimit = true;
      // Set rate limit reset time (usually 1 hour for most APIs)
      updateData.rateLimitResetAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    await this.prisma.dataSourceHealth.update({
      where: { id: dataSourceHealthId },
      data: updateData,
    });

    return healthCheck;
  }

  async updateSchemaChange(healthId: string, newSchema: any) {
    return this.prisma.dataSourceHealth.update({
      where: { id: healthId },
      data: {
        lastKnownSchema: newSchema,
        schemaChangedAt: new Date(),
        schemaChangeDetected: true,
        status: HealthStatus.SCHEMA_CHANGED,
      },
    });
  }

  async acknowledgeSchemaChange(healthId: string) {
    return this.prisma.dataSourceHealth.update({
      where: { id: healthId },
      data: {
        schemaChangeDetected: false,
        status: HealthStatus.HEALTHY,
      },
    });
  }

  async getHealthMetrics(workspaceId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const checks = await this.prisma.dataSourceHealthCheck.findMany({
      where: {
        dataSourceHealth: {
          workspaceId,
        },
        timestamp: {
          gte: startDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate metrics
    const totalChecks = checks.length;
    const healthyChecks = checks.filter((c) => c.status === HealthStatus.HEALTHY).length;
    const avgResponseTime =
      checks.reduce((sum, c) => sum + (c.responseTime || 0), 0) / totalChecks || 0;

    const uptimePercentage = (healthyChecks / totalChecks) * 100 || 0;

    return {
      totalChecks,
      healthyChecks,
      uptimePercentage: parseFloat(uptimePercentage.toFixed(2)),
      avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
      period: `${days} days`,
    };
  }

  async updateAlertSettings(
    healthId: string,
    settings: {
      alertsEnabled?: boolean;
      alertThreshold?: number;
      freshnessThreshold?: number;
    },
  ) {
    return this.prisma.dataSourceHealth.update({
      where: { id: healthId },
      data: settings,
    });
  }

  async getDegradedSources(workspaceId: string) {
    return this.prisma.dataSourceHealth.findMany({
      where: {
        workspaceId,
        status: {
          in: [
            HealthStatus.DEGRADED,
            HealthStatus.DOWN,
            HealthStatus.RATE_LIMITED,
            HealthStatus.SCHEMA_CHANGED,
          ],
        },
      },
      include: {
        integration: true,
      },
    });
  }
}
