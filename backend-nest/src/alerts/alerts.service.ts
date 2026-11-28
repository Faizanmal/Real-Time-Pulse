import { HttpService } from '@nestjs/axios';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AlertDeliveryStatus, AlertOccurrenceStatus, AlertSeverity, Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

const MAX_AUTOMATIC_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const SUPPORTED_CHANNELS = new Set(['email', 'slack', 'webhook']);

export interface AlertSignal {
  eventId: string;
  metric: string;
  value: number;
  source: string;
  observedAt?: Date;
  freshnessAt?: Date | null;
  reason: string;
  nextAction: string;
  securityCritical?: boolean;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly httpService: HttpService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateAlertDto) {
    this.validateCondition(dto.condition);
    await this.validateResourceScopes(workspaceId, dto.portalId, dto.widgetId);
    const alert = await this.prisma.alert.create({
      data: {
        name: dto.name,
        description: dto.description,
        portalId: dto.portalId,
        widgetId: dto.widgetId,
        condition: dto.condition as Prisma.InputJsonValue,
        severity: dto.severity,
        channels: dto.channels,
        emailRecipients: dto.emailRecipients ?? [],
        webhookUrl: dto.webhookUrl,
        slackWebhook: dto.slackWebhook,
        slackChannel: dto.slackChannel,
        isActive: dto.isActive,
        suppressionWindowSeconds: dto.suppressionWindowSeconds,
        workspace: { connect: { id: workspaceId } },
        createdBy: { connect: { id: userId } },
      },
    });
    return this.publicAlert(alert);
  }

  async findAll(workspaceId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { history: true } },
        history: {
          orderBy: { triggeredAt: 'desc' },
          take: 5,
          include: { deliveries: { orderBy: { createdAt: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map((alert) => this.publicAlert(alert));
  }

  async findOne(id: string, workspaceId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        history: {
          orderBy: { triggeredAt: 'desc' },
          take: 10,
          include: { deliveries: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return this.publicAlert(alert);
  }

  async update(id: string, workspaceId: string, dto: UpdateAlertDto) {
    if (dto.condition) this.validateCondition(dto.condition);
    await this.findOne(id, workspaceId);
    await this.validateResourceScopes(workspaceId, dto.portalId, dto.widgetId);
    const updateData: Prisma.AlertUpdateManyMutationInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.portalId !== undefined) updateData.portalId = dto.portalId;
    if (dto.widgetId !== undefined) updateData.widgetId = dto.widgetId;
    if (dto.condition !== undefined) updateData.condition = dto.condition as Prisma.InputJsonValue;
    if (dto.severity !== undefined) updateData.severity = dto.severity;
    if (dto.channels !== undefined) updateData.channels = dto.channels;
    if (dto.emailRecipients !== undefined) updateData.emailRecipients = dto.emailRecipients;
    if (dto.webhookUrl !== undefined) updateData.webhookUrl = dto.webhookUrl;
    if (dto.slackWebhook !== undefined) updateData.slackWebhook = dto.slackWebhook;
    if (dto.slackChannel !== undefined) updateData.slackChannel = dto.slackChannel;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.suppressionWindowSeconds !== undefined) updateData.suppressionWindowSeconds = dto.suppressionWindowSeconds;
    const result = await this.prisma.alert.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data: updateData,
    });
    if (!result.count) throw new NotFoundException('Alert not found');
    return this.findOne(id, workspaceId);
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    const deleted = await this.prisma.alert.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data: { isActive: false, deletedAt: new Date() },
    });
    if (!deleted.count) throw new NotFoundException('Alert not found');
  }

  async getHistory(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.alertHistory.findMany({
      where: { alertId: id, alert: { workspaceId } },
      include: { deliveries: { orderBy: { createdAt: 'asc' } } },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
  }

  /** Evaluate all workspace rules for a provider/data-health metric. */
  async evaluateWorkspaceMetric(workspaceId: string, signal: AlertSignal) {
    if (!Number.isFinite(signal.value) || !signal.eventId || !signal.metric) return [];
    const rules = await this.prisma.alert.findMany({ where: { workspaceId, isActive: true, deletedAt: null } });
    const results = [];
    for (const alert of rules) {
      const condition = alert.condition as Record<string, unknown>;
      if (condition.metric !== signal.metric) continue;
      results.push(await this.evaluateRule(alert.id, workspaceId, signal));
    }
    return results;
  }

  private async evaluateRule(alertId: string, workspaceId: string, signal: AlertSignal) {
    const now = signal.observedAt ?? new Date();
    try {
      const occurrence = await this.prisma.$transaction(async (tx: any) => {
        const alert = await tx.alert.findFirst({ where: { id: alertId, workspaceId, deletedAt: null } });
        if (!alert || !alert.isActive) return null;
        const duplicate = await tx.alertHistory.findFirst({ where: { alertId, eventId: signal.eventId } });
        if (duplicate) return { duplicate: true, id: duplicate.id, status: duplicate.status };

        const condition = alert.condition as Record<string, unknown>;
        const triggered = this.evaluateCondition(condition, signal.value);
        const securityCritical = signal.securityCritical === true || alert.severity === AlertSeverity.CRITICAL;
        const withinSuppression = Boolean(
          triggered && !securityCritical && alert.lastTriggeredAt &&
          now.getTime() - new Date(alert.lastTriggeredAt).getTime() <
            Math.max(0, alert.suppressionWindowSeconds) * 1000,
        );
        if (!triggered && !alert.isFiring) {
          await tx.alert.update({ where: { id: alertId }, data: { lastEvaluatedAt: now } });
          return null;
        }

        const status = !triggered
          ? AlertOccurrenceStatus.RESOLVED
          : withinSuppression
            ? AlertOccurrenceStatus.SUPPRESSED
            : AlertOccurrenceStatus.TRIGGERED;
        const history = await tx.alertHistory.create({
          data: {
            alertId,
            eventId: signal.eventId,
            triggeredValue: { metric: signal.metric, value: signal.value },
            condition: alert.condition,
            notificationsSent: {},
            source: signal.source.slice(0, 240),
            freshnessAt: signal.freshnessAt ?? null,
            reason: signal.reason.slice(0, 500),
            nextAction: signal.nextAction.slice(0, 500),
            severity: alert.severity,
            status,
            suppressedCount: withinSuppression ? 1 : 0,
            triggeredAt: now,
          },
        });
        if (status === AlertOccurrenceStatus.TRIGGERED) {
          const channels = (alert.channels as string[])
            .map((channel) => channel.toLowerCase())
            .filter((channel) => SUPPORTED_CHANNELS.has(channel));
          if (channels.length) {
            await tx.alertDelivery.createMany({
              data: channels.map((channel) => ({ historyId: history.id, channel })),
              skipDuplicates: true,
            });
          }
        }
        await tx.alert.update({
          where: { id: alertId },
          data: {
            lastEvaluatedAt: now,
            isFiring: triggered,
            ...(status === AlertOccurrenceStatus.TRIGGERED
              ? { lastTriggeredAt: now, triggerCount: { increment: 1 } }
              : {}),
          },
        });
        return { duplicate: false, id: history.id, status };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if (occurrence?.status === AlertOccurrenceStatus.TRIGGERED && !occurrence.duplicate) {
        await this.dispatchHistory(workspaceId, occurrence.id);
      }
      return occurrence;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') return { duplicate: true };
      throw error;
    }
  }

  private evaluateCondition(condition: Record<string, unknown>, value: number): boolean {
    const threshold = Number(condition.threshold);
    if (!Number.isFinite(threshold)) return false;
    switch (condition.operator) {
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  private validateCondition(condition: Record<string, unknown>) {
    if (
      typeof condition?.metric !== 'string' || !condition.metric.trim() ||
      !['>', '>=', '<', '<=', '==', '!='].includes(String(condition.operator)) ||
      !Number.isFinite(Number(condition.threshold))
    ) throw new BadRequestException('Alert condition requires metric, supported operator and finite threshold');
  }

  private async validateResourceScopes(workspaceId: string, portalId?: string, widgetId?: string) {
    if (portalId) {
      const portal = await this.prisma.portal.findFirst({ where: { id: portalId, workspaceId, deletedAt: null }, select: { id: true } });
      if (!portal) throw new NotFoundException('Portal not found');
    }
    if (widgetId) {
      const widget = await this.prisma.widget.findFirst({ where: { id: widgetId, portal: { workspaceId } }, select: { id: true } });
      if (!widget) throw new NotFoundException('Widget not found');
    }
  }

  private publicAlert<T extends Record<string, any>>(alert: T): Omit<T, 'webhookUrl' | 'slackWebhook'> {
    const { webhookUrl: _webhookUrl, slackWebhook: _slackWebhook, ...safe } = alert;
    return safe;
  }

  private async dispatchHistory(workspaceId: string, historyId: string) {
    const deliveries = await this.prisma.alertDelivery.findMany({
      where: { historyId, history: { alert: { workspaceId, isActive: true, deletedAt: null } }, status: AlertDeliveryStatus.PENDING },
      select: { id: true },
    });
    await Promise.all(deliveries.map(({ id }) => this.dispatchDelivery(id, workspaceId)));
  }

  private async dispatchDelivery(deliveryId: string, workspaceId: string, force = false) {
    const delivery = await this.prisma.alertDelivery.findFirst({
      where: { id: deliveryId, history: { alert: { workspaceId, isActive: true, deletedAt: null } } },
      include: { history: { include: { alert: true } } },
    });
    if (!delivery) throw new NotFoundException('Alert delivery not found');
    if (delivery.status === AlertDeliveryStatus.SENT) return delivery;
    if (delivery.status === AlertDeliveryStatus.SENDING) throw new ConflictException('Alert delivery is already in progress');
    if (delivery.status !== AlertDeliveryStatus.PENDING && delivery.status !== AlertDeliveryStatus.FAILED)
      throw new ConflictException('Alert delivery is not retryable');
    if (!force && delivery.attemptCount >= MAX_AUTOMATIC_ATTEMPTS) return delivery;

    const claimed = await this.prisma.alertDelivery.updateMany({
      where: { id: deliveryId, status: delivery.status },
      data: {
        status: AlertDeliveryStatus.SENDING,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorCode: null,
        nextAttemptAt: null,
      },
    });
    if (!claimed.count) throw new ConflictException('Alert delivery is already in progress');

    try {
      await this.sendChannel(delivery);
    } catch {
      const attempt = delivery.attemptCount + 1;
      const backoff = Math.min(MAX_BACKOFF_MS, 30_000 * (2 ** Math.min(attempt - 1, 7)));
      const failed = await this.prisma.alertDelivery.update({
        where: { id: deliveryId },
        data: {
          status: AlertDeliveryStatus.FAILED,
          lastErrorCode: 'channel_delivery_failed',
          nextAttemptAt: attempt < MAX_AUTOMATIC_ATTEMPTS ? new Date(Date.now() + backoff) : null,
        },
      });
      await this.mirrorLegacyNotificationStatus(delivery, false);
      return failed;
    }
    // A database error after the remote send leaves SENDING. It is deliberately
    // not rewritten as FAILED because the remote side may already have accepted it.
    const sent = await this.prisma.alertDelivery.update({
      where: { id: deliveryId },
      data: { status: AlertDeliveryStatus.SENT, sentAt: new Date(), lastErrorCode: null },
    });
    await this.mirrorLegacyNotificationStatus(delivery, true);
    return sent;
  }

  private async mirrorLegacyNotificationStatus(delivery: any, sent: boolean) {
    const previous = delivery.history.notificationsSent && typeof delivery.history.notificationsSent === 'object'
      ? delivery.history.notificationsSent as Record<string, unknown>
      : {};
    try {
      await this.prisma.alertHistory.update({
        where: { id: delivery.historyId },
        data: { notificationsSent: { ...previous, [delivery.channel]: sent } as Prisma.InputJsonValue },
      });
    } catch (error) {
      this.logger.warn(`Could not update legacy alert delivery summary: ${(error as Error).message}`);
    }
  }

  private async sendChannel(delivery: any) {
    const alert = delivery.history.alert;
    const history = delivery.history;
    const payload = {
      alertId: alert.id,
      eventId: history.eventId,
      name: alert.name,
      description: alert.description,
      severity: history.severity,
      source: history.source,
      freshnessAt: history.freshnessAt,
      reason: history.reason,
      nextAction: history.nextAction,
      metric: (history.triggeredValue as any)?.metric,
      value: (history.triggeredValue as any)?.value,
      triggeredAt: history.triggeredAt,
    };
    if (delivery.channel === 'email') {
      if (!alert.emailRecipients?.length) throw new Error('No email recipients configured');
      const sent = await this.emailService.sendEmail({
        to: alert.emailRecipients,
        subject: `[${history.severity}] ${alert.name}`,
        template: 'alert-notification',
        context: { alertName: alert.name, ...payload, workspaceName: 'Workspace alert' },
      });
      if (!sent) throw new Error('Email channel rejected delivery');
      return;
    }
    const webhookUrl = delivery.channel === 'slack' ? alert.slackWebhook : alert.webhookUrl;
    if (!webhookUrl) throw new Error('Alert channel is not configured');
    await firstValueFrom(this.httpService.post(webhookUrl, payload, {
      headers: { 'Idempotency-Key': `${alert.id}:${history.eventId}:${delivery.channel}` },
      timeout: 10_000,
    }));
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryDueDeliveries() {
    const due = await this.prisma.alertDelivery.findMany({
      where: {
        status: { in: [AlertDeliveryStatus.PENDING, AlertDeliveryStatus.FAILED] },
        attemptCount: { lt: MAX_AUTOMATIC_ATTEMPTS },
        history: { alert: { isActive: true, deletedAt: null } },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, history: { select: { alert: { select: { workspaceId: true } } } } },
    });
    for (const row of due) {
      try { await this.dispatchDelivery(row.id, row.history.alert.workspaceId); }
      catch (error) { this.logger.warn(`Alert delivery ${row.id} was not claimed: ${(error as Error).message}`); }
    }
    return due.length;
  }

  async retryDelivery(id: string, deliveryId: string, workspaceId: string) {
    const delivery = await this.prisma.alertDelivery.findFirst({
      where: { id: deliveryId, history: { alert: { id, workspaceId, isActive: true, deletedAt: null } } },
      select: { id: true, status: true },
    });
    if (!delivery) throw new NotFoundException('Alert delivery not found');
    if (delivery.status === AlertDeliveryStatus.SENT) return delivery;
    return this.dispatchDelivery(deliveryId, workspaceId, true);
  }

  /** Record sync failure/recovery using a stable event ID, so Bull retries are idempotent. */
  async recordSyncSignal(input: {
    workspaceId: string; integrationId: string; provider: string; eventId: string;
    failed: boolean; failureCode?: string; freshnessAt?: Date | null; observedAt?: Date;
  }) {
    return this.evaluateWorkspaceMetric(input.workspaceId, {
      eventId: input.eventId,
      metric: 'provider.sync_failures',
      value: input.failed ? 1 : 0,
      source: `${input.provider} integration ${input.integrationId}`,
      observedAt: input.observedAt,
      freshnessAt: input.freshnessAt,
      reason: input.failed ? `Provider sync failed (${input.failureCode ?? 'unknown'})` : 'Provider sync recovered',
      nextAction: input.failed ? 'Review provider access and sync status, then retry the connector.' : 'No action required; verify the next sync remains healthy.',
    });
  }

  /** Kept as a safe configuration check; it does not send external notifications. */
  async testAlert(id: string, workspaceId: string) {
    const alert = await this.findOne(id, workspaceId);
    return { message: 'Alert configuration is accessible', alertId: alert.id, deliverySent: false };
  }
}
