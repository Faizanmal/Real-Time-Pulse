import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { HttpService } from '@nestjs/axios';
import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';
import { firstValueFrom } from 'rxjs';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Create a new alert
   */
  async create(workspaceId: string, userId: string, dto: CreateAlertDto) {
    return this.prisma.alert.create({
      data: {
        ...dto,
        workspaceId,
        createdById: userId,
      },
      include: {
        workspace: true,
        createdBy: true,
      },
    });
  }

  /**
   * Get all alerts for workspace
   */
  async findAll(workspaceId: string) {
    return this.prisma.alert.findMany({
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
          select: { history: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get alert by ID
   */
  async findOne(id: string, workspaceId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id, workspaceId },
      include: {
        workspace: true,
        createdBy: true,
        history: {
          orderBy: { triggeredAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  /**
   * Update alert
   */
  async update(id: string, workspaceId: string, dto: UpdateAlertDto) {
    await this.findOne(id, workspaceId);

    return this.prisma.alert.update({
      where: { id },
      data: dto,
      include: {
        workspace: true,
        createdBy: true,
      },
    });
  }

  /**
   * Delete alert
   */
  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.prisma.alert.delete({ where: { id } });
  }

  /**
   * Get alert history
   */
  async getHistory(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.alertHistory.findMany({
      where: { alertId: id },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Check alert condition and trigger if met
   */
  async checkAndTrigger(alertId: string, currentValue: any) {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { workspace: true },
    });

    if (!alert || !alert.isActive) {
      return;
    }

    const condition = alert.condition as any;
    const shouldTrigger = this.evaluateCondition(condition, currentValue);

    if (shouldTrigger) {
      await this.triggerAlert(alert, currentValue);
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(condition: any, currentValue: any): boolean {
    const { metric, operator, threshold } = condition;

    const value =
      typeof currentValue === 'object' ? currentValue[metric] : currentValue;

    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value == threshold;
      case '!=':
        return value != threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger alert notifications
   */
  private async triggerAlert(alert: any, triggeredValue: any) {
    const channels = alert.channels as string[];
    const notificationResults = {} as any;

    // Send email notifications
    if (channels.includes('email') && alert.emailRecipients?.length > 0) {
      try {
        await Promise.all(
          alert.emailRecipients.map((email: string) =>
            this.emailService.sendEmail({
              to: email,
              subject: `Alert Triggered: ${alert.name}`,
              template: 'alert-notification',
              context: {
                alertName: alert.name,
                description: alert.description,
                condition: alert.condition,
                triggeredValue,
                workspaceName: alert.workspace.name,
              },
            }),
          ),
        );
        notificationResults.email = true;
      } catch {
        notificationResults.email = false;
      }
    }

    // Send Slack notification
    if (channels.includes('slack') && alert.slackWebhook) {
      try {
        await firstValueFrom(
          this.httpService.post(alert.slackWebhook, {
            text: `🚨 Alert Triggered: ${alert.name}`,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `🚨 ${alert.name}`,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Description:*\n${alert.description || 'N/A'}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Value:*\n${JSON.stringify(triggeredValue)}`,
                  },
                ],
              },
            ],
          }),
        );
        notificationResults.slack = true;
      } catch {
        notificationResults.slack = false;
      }
    }

    // Send webhook notification
    if (channels.includes('webhook') && alert.webhookUrl) {
      try {
        await firstValueFrom(
          this.httpService.post(alert.webhookUrl, {
            alertId: alert.id,
            alertName: alert.name,
            description: alert.description,
            condition: alert.condition,
            triggeredValue,
            triggeredAt: new Date().toISOString(),
            workspaceId: alert.workspaceId,
          }),
        );
        notificationResults.webhook = true;
      } catch {
        notificationResults.webhook = false;
      }
    }

    // Record alert history
    await this.prisma.alertHistory.create({
      data: {
        alertId: alert.id,
        triggeredValue,
        condition: alert.condition,
        notificationsSent: notificationResults,
      },
    });

    // Update alert stats
    await this.prisma.alert.update({
      where: { id: alert.id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });
  }

  /**
   * Test alert (manually trigger)
   */
  async testAlert(id: string, workspaceId: string) {
    const alert = await this.findOne(id, workspaceId);

    await this.triggerAlert(alert, { test: true, value: 'Test trigger' });

    return { message: 'Test alert sent successfully' };
  }
}
