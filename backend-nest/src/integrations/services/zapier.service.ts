/**
 * Zapier Integration Service
 * Enables custom webhooks and Zapier-style automation triggers
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { LoggingService } from '../../common/logger/logging.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface WebhookTrigger {
  id: string;
  workspaceId: string;
  name: string;
  events: string[];
  url: string;
  secret?: string;
  isActive: boolean;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number; // seconds
  timeoutSeconds?: number;
}

interface TriggerEvent {
  type: string;
  workspaceId: string;
  data: any;
  timestamp: Date;
}

@Injectable()
export class ZapierIntegrationService {
  private readonly supportedEvents = [
    'dashboard.created',
    'dashboard.updated',
    'dashboard.deleted',
    'widget.created',
    'widget.updated',
    'widget.data_changed',
    'alert.triggered',
    'alert.resolved',
    'report.generated',
    'user.joined_workspace',
    'user.left_workspace',
    'metric.threshold_exceeded',
    'metric.anomaly_detected',
    'integration.connected',
    'integration.disconnected',
    'comment.created',
    'annotation.created',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Create a new webhook trigger
   */
  async createWebhook(
    workspaceId: string,
    data: {
      name: string;
      events: string;
      url: string;
      filters?: Record<string, any>;
      headers?: Record<string, string>;
    },
  ): Promise<WebhookTrigger> {
    if (!this.supportedEvents.includes(data.events)) {
      throw new BadRequestException(
        `Unsupported events: ${data.events}. Supported: ${this.supportedEvents.join(', ')}`,
      );
    }

    // Validate URL
    try {
      new URL(data.url);
    } catch {
      throw new BadRequestException('Invalid target URL');
    }

    const webhook = await (this.prisma as any).webhook.create({
      data: {
        id: uuidv4(),
        workspaceId,
        name: data.name,
        events: [data.events],
        url: data.url,
        secret: this.generateSecret(),
        headers: data.headers || {},
        isActive: true,
        maxRetries: 3,
        retryDelay: 60, // seconds
        timeoutSeconds: 30,
      } as any,
    });

    this.logger.log(
      `Webhook created: ${webhook.id} for event ${data.events}`,
      'ZapierIntegrationService',
    );
    return webhook as unknown as WebhookTrigger;
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    data: Partial<{
      name: string;
      url: string;
      headers: Record<string, string>;
      isActive: boolean;
      maxRetries?: number;
      retryDelay?: number;
      timeoutSeconds?: number;
    }>,
  ): Promise<WebhookTrigger> {
    const webhook = await this.prisma.webhook.update({
      where: { id: webhookId },
      data,
    });
    return webhook as unknown as WebhookTrigger;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    this.logger.log(`Webhook deleted: ${webhookId}`, 'ZapierIntegrationService');
  }

  /**
   * Get webhooks for workspace
   */
  async getWebhooks(workspaceId: string): Promise<WebhookTrigger[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks as unknown as WebhookTrigger[];
  }

  /**
   * Get supported events
   */
  getSupportedEvents(): { events: string; description: string }[] {
    return [
      { events: 'dashboard.created', description: 'Triggered when a new dashboard is created' },
      { events: 'dashboard.updated', description: 'Triggered when a dashboard is modified' },
      { events: 'dashboard.deleted', description: 'Triggered when a dashboard is deleted' },
      { events: 'widget.created', description: 'Triggered when a new widget is added' },
      { events: 'widget.updated', description: 'Triggered when a widget is configured' },
      {
        events: 'widget.data_changed',
        description: 'Triggered when widget data changes significantly',
      },
      { events: 'alert.triggered', description: 'Triggered when an alert condition is met' },
      { events: 'alert.resolved', description: 'Triggered when an alert condition is resolved' },
      { events: 'report.generated', description: 'Triggered when a scheduled report is generated' },
      { events: 'user.joined_workspace', description: 'Triggered when a user joins a workspace' },
      { events: 'user.left_workspace', description: 'Triggered when a user leaves a workspace' },
      {
        events: 'metric.threshold_exceeded',
        description: 'Triggered when a metric exceeds its threshold',
      },
      { events: 'metric.anomaly_detected', description: 'Triggered when an anomaly is detected' },
      {
        events: 'integration.connected',
        description: 'Triggered when an integration is connected',
      },
      {
        events: 'integration.disconnected',
        description: 'Triggered when an integration is disconnected',
      },
      { events: 'comment.created', description: 'Triggered when a comment is added' },
      { events: 'annotation.created', description: 'Triggered when an annotation is created' },
    ];
  }

  /**
   * Trigger webhooks for an event
   */
  async triggerEvent(events: TriggerEvent): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId: events.workspaceId,
        events: { has: events.type },
        isActive: true,
      },
    });

    for (const webhook of webhooks) {
      // Check filters (schema no longer stores filters by default)
      if (!this.matchesFilters(events.data, (webhook as any).filters || {})) {
        continue;
      }

      // Queue webhook delivery
      await this.deliverWebhook(webhook as unknown as WebhookTrigger, events);
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhook(webhook: WebhookTrigger, events: TriggerEvent): Promise<void> {
    const payload = {
      id: uuidv4(),
      events: events.type,
      timestamp: events.timestamp.toISOString(),
      workspaceId: events.workspaceId,
      data: events.data,
    };

    const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Id': webhook.id,
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': events.timestamp.toISOString(),
      'User-Agent': 'RealTimePulse-Webhook/1.0',
      ...webhook.headers,
    };

    const maxRetries = webhook.maxRetries ?? 3;
    const retryDelay = webhook.retryDelay ?? 60; // seconds
    const timeoutSeconds = webhook.timeoutSeconds ?? 30;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(webhook.url, payload, {
            headers,
            timeout: timeoutSeconds * 1000,
          }),
        );

        // Log successful delivery using schema fields
        await this.logDelivery(webhook.id, {
          event: events.type,
          payload,
          attempts: attempt + 1,
          status: 'SUCCESS',
          responseCode: response.status,
        });

        this.logger.debug(
          `Webhook delivered: ${webhook.id} -> ${webhook.url}`,
          'ZapierIntegrationService',
        );
        return;
      } catch (error: any) {
        lastError = error;
        attempt++;

        if (attempt <= maxRetries) {
          const delay = retryDelay * 1000 * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // Log failed delivery
    await this.logDelivery(webhook.id, {
      event: events.type,
      payload,
      attempts: attempt,
      status: 'FAILED',
      error: lastError?.message || 'Unknown error',
    });

    this.logger.error(
      `Webhook delivery failed after ${attempt} attempts: ${webhook.id}`,
      'ZapierIntegrationService',
    );
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(
    webhookId: string,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new BadRequestException('Webhook not found');

    const testPayload = {
      id: uuidv4(),
      events: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Real-Time Pulse',
      workspaceId: webhook.workspaceId,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(webhook.url, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Test': 'true',
          },
          timeout: 10000,
        }),
      );

      return { success: true, statusCode: response.status };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status,
      };
    }
  }

  /**
   * Get webhook delivery logs
   */
  async getDeliveryLogs(webhookId: string, limit = 50): Promise<any[]> {
    const logs = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return logs;
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string): Promise<string> {
    const newSecret = this.generateSecret();
    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { secret: newSecret },
    });
    return newSecret;
  }

  /**
   * Check if data matches filters
   */
  private matchesFilters(data: any, filters: Record<string, any>): boolean {
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    for (const [key, value] of Object.entries(filters)) {
      const dataValue = this.getNestedValue(data, key);

      if (typeof value === 'object' && value !== null) {
        // Handle operators
        if (value.$eq !== undefined && dataValue !== value.$eq) return false;
        if (value.$ne !== undefined && dataValue === value.$ne) return false;
        if (value.$gt !== undefined && dataValue <= value.$gt) return false;
        if (value.$gte !== undefined && dataValue < value.$gte) return false;
        if (value.$lt !== undefined && dataValue >= value.$lt) return false;
        if (value.$lte !== undefined && dataValue > value.$lte) return false;
        if (value.$in !== undefined && !value.$in.includes(dataValue)) return false;
        if (value.$nin !== undefined && value.$nin.includes(dataValue)) return false;
        if (value.$contains !== undefined && !String(dataValue).includes(value.$contains))
          return false;
      } else if (dataValue !== value) {
        return false;
      }
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private async logDelivery(
    webhookId: string,
    log: {
      event?: string;
      payload?: any;
      attempts?: number;
      status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING';
      responseCode?: number;
      responseBody?: string;
      responseTime?: number;
      error?: string;
    },
  ): Promise<void> {
    await this.prisma.webhookDelivery.create({
      data: {
        id: uuidv4(),
        webhookId,
        event: log.event ?? 'unknown',
        payload: log.payload ?? {},
        attempts: log.attempts ?? 0,
        status: (log.status as any) ?? 'PENDING',
        responseCode: log.responseCode ?? null,
        responseBody: log.responseBody ?? null,
        responseTime: log.responseTime ?? null,
        error: log.error ?? null,
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
