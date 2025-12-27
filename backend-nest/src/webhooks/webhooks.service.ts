import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Create a new webhook
   */
  async create(workspaceId: string, userId: string, dto: CreateWebhookDto) {
    const secret = this.generateSecret();

    return this.prisma.webhook.create({
      data: {
        ...dto,
        secret,
        workspaceId,
        createdById: userId,
      },
      include: {
        workspace: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get all webhooks for workspace
   */
  async findAll(workspaceId: string) {
    return this.prisma.webhook.findMany({
      where: { workspaceId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { deliveries: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get webhook by ID
   */
  async findOne(id: string, workspaceId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, workspaceId },
      include: {
        workspace: true,
        createdBy: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  /**
   * Update webhook
   */
  async update(id: string, workspaceId: string, dto: UpdateWebhookDto) {
    await this.findOne(id, workspaceId);

    return this.prisma.webhook.update({
      where: { id },
      data: dto,
      include: {
        workspace: true,
        createdBy: true,
      },
    });
  }

  /**
   * Delete webhook
   */
  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.prisma.webhook.delete({ where: { id } });
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Trigger webhook with event
   */
  async triggerWebhook(
    workspaceId: string,
    event: string,
    payload: any,
  ): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    await Promise.all(
      webhooks.map((webhook) => this.deliverWebhook(webhook, event, payload)),
    );
  }

  /**
   * Deliver webhook
   */
  private async deliverWebhook(webhook: any, event: string, payload: any) {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        status: 'PENDING',
      },
    });

    try {
      const timestamp = Date.now();
      const signature = this.generateSignature(
        webhook.secret,
        timestamp,
        payload,
      );

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Event': event,
        ...(webhook.headers || {}),
      };

      const startTime = Date.now();
      const response = await firstValueFrom(
        this.httpService.post(webhook.url, payload, {
          headers,
          timeout: webhook.timeoutSeconds * 1000,
        }),
      );
      const responseTime = Date.now() - startTime;

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SUCCESS',
          responseCode: response.status,
          responseBody: JSON.stringify(response.data).substring(0, 1000),
          responseTime,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          successCount: { increment: 1 },
        },
      });
    } catch (_error: any) {
      const errorMessage = _error.message || 'Unknown error';

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          error: errorMessage.substring(0, 500),
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          failureCount: { increment: 1 },
        },
      });

      // Schedule retry if within max retries
      if (delivery.attempts < webhook.maxRetries) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'RETRYING',
            nextAttemptAt: new Date(Date.now() + webhook.retryDelay * 1000),
          },
        });
      }
    }
  }

  /**
   * Test webhook
   */
  async testWebhook(id: string, workspaceId: string) {
    const webhook = await this.findOne(id, workspaceId);

    await this.deliverWebhook(webhook, 'test.event', {
      test: true,
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    });

    return { message: 'Test webhook triggered successfully' };
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    const secret = this.generateSecret();

    return this.prisma.webhook.update({
      where: { id },
      data: { secret },
      include: {
        workspace: true,
        createdBy: true,
      },
    });
  }

  /**
   * Generate webhook secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(
    secret: string,
    timestamp: number,
    payload: any,
  ): string {
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    secret: string,
    signature: string,
    timestamp: number,
    payload: any,
  ): boolean {
    const expectedSignature = this.generateSignature(
      secret,
      timestamp,
      payload,
    );
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
