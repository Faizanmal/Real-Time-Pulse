import { AlertDeliveryStatus, AlertOccurrenceStatus, AlertSeverity } from '@prisma/client';

import { AlertsService } from './alerts.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

const makeAlert = (overrides: Record<string, unknown> = {}) => ({
  id: 'alert-fixture-a',
  workspaceId: 'workspace-fixture-a',
  name: 'Fictional sync failure',
  description: 'Fictional provider sync failures',
  condition: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 },
  severity: AlertSeverity.HIGH,
  channels: [],
  emailRecipients: [],
  webhookUrl: null,
  slackWebhook: null,
  isActive: true,
  deletedAt: null,
  isFiring: false,
  suppressionWindowSeconds: 900,
  triggerCount: 0,
  lastTriggeredAt: null,
  lastEvaluatedAt: null,
  ...overrides,
});

function harness(alert = makeAlert(), email = jest.fn().mockResolvedValue(true)) {
  const occurrences: any[] = [];
  const deliveries: any[] = [];
  let nextId = 0;
  const update = (target: any, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'triggerCount' && (value as any)?.increment) target[key] += (value as any).increment;
      else if (key === 'attemptCount' && (value as any)?.increment) target[key] += (value as any).increment;
      else target[key] = value;
    }
    return target;
  };
  const prisma: any = {
    alert: {
      create: jest.fn(async ({ data }: any) => ({ id: 'created-alert', ...data })),
      findMany: jest.fn(async ({ where }: any) => where.workspaceId === alert.workspaceId && alert.isActive ? [alert] : []),
      findFirst: jest.fn(async ({ where }: any) => where.id === alert.id && where.workspaceId === alert.workspaceId ? alert : null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id !== alert.id || where.workspaceId !== alert.workspaceId) return { count: 0 };
        update(alert, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: any) => update(alert, data)),
      deleteMany: jest.fn(async ({ where }: any) => where.id === alert.id && where.workspaceId === alert.workspaceId ? { count: 1 } : { count: 0 }),
    },
    portal: { findFirst: jest.fn().mockResolvedValue({ id: 'portal-fixture-a' }) },
    widget: { findFirst: jest.fn().mockResolvedValue({ id: 'widget-fixture-a' }) },
    alertHistory: {
      findFirst: jest.fn(async ({ where }: any) => occurrences.find((event) => event.alertId === where.alertId && event.eventId === where.eventId) ?? null),
      findMany: jest.fn(async () => occurrences),
      update: jest.fn(async ({ where, data }: any) => Object.assign(occurrences.find((event) => event.id === where.id), data)),
    },
    alertDelivery: {
      createMany: jest.fn(async ({ data }: any) => {
        for (const row of data) deliveries.push({ id: `delivery-${++nextId}`, ...row, status: AlertDeliveryStatus.PENDING, attemptCount: 0, history: { ...occurrences.find((event) => event.id === row.historyId), alert } });
        return { count: data.length };
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const selected = where.historyId
          ? deliveries.filter((delivery) => delivery.historyId === where.historyId && delivery.status === where.status)
          : deliveries.filter((delivery) => [AlertDeliveryStatus.PENDING, AlertDeliveryStatus.FAILED].includes(delivery.status) && delivery.attemptCount < 5 && (!delivery.nextAttemptAt || delivery.nextAttemptAt <= new Date()));
        return selected.map((delivery) => where.historyId ? { id: delivery.id } : ({ id: delivery.id, history: { alert: { workspaceId: alert.workspaceId } } }));
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const delivery = deliveries.find((row) => row.id === where.id && row.history.alert.workspaceId === alert.workspaceId && (!where.history?.alert?.id || where.history.alert.id === alert.id));
        return delivery ?? null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const delivery = deliveries.find((row) => row.id === where.id && row.status === where.status);
        if (!delivery) return { count: 0 };
        update(delivery, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }: any) => update(deliveries.find((row) => row.id === where.id), data)),
    },
    $transaction: jest.fn(async (operation: any) => operation({
      alert: {
        findFirst: prismaAlertFind(alert),
        update: jest.fn(async ({ data }: any) => update(alert, data)),
      },
      alertHistory: {
        findFirst: jest.fn(async ({ where }: any) => occurrences.find((event) => event.alertId === where.alertId && event.eventId === where.eventId) ?? null),
        create: jest.fn(async ({ data }: any) => {
          const occurrence = { id: `history-${++nextId}`, triggeredAt: new Date(), ...data };
          occurrences.push(occurrence);
          return occurrence;
        }),
      },
      alertDelivery: { createMany: prisma.alertDelivery.createMany },
    })),
  };
  const emailService: any = { sendEmail: email };
  const httpService: any = { post: jest.fn() };
  const service = new AlertsService(prisma, emailService, httpService);
  return { service, prisma, alert, occurrences, deliveries, email };
}

function prismaAlertFind(alert: any) {
  return jest.fn(async ({ where }: any) => where.id === alert.id && where.workspaceId === alert.workspaceId ? alert : null);
}

const signal = (eventId: string, value: number, overrides: Record<string, unknown> = {}) => ({
  eventId,
  metric: 'provider.sync_failures',
  value,
  source: 'Fictional GitHub integration fixture-a',
  observedAt: new Date('2026-11-27T10:00:00.000Z'),
  freshnessAt: new Date('2026-11-27T09:00:00.000Z'),
  reason: value ? 'Provider sync failed (rate_limited)' : 'Provider sync recovered',
  nextAction: value ? 'Review provider access and retry the connector.' : 'No action required.',
  ...overrides,
});

describe('AlertsService escalation and delivery idempotency', () => {
  it('suppresses flapping non-critical events but records recovery and preserves freshness', async () => {
    const { service, occurrences, alert, deliveries } = harness();
    await service.evaluateWorkspaceMetric(alert.workspaceId, signal('sync-a:failed', 1));
    await service.evaluateWorkspaceMetric(alert.workspaceId, signal('sync-a:recovered', 0));
    const suppressed = await service.evaluateWorkspaceMetric(alert.workspaceId, signal('sync-b:failed', 1));

    expect(occurrences.map((event) => event.status)).toEqual([
      AlertOccurrenceStatus.TRIGGERED,
      AlertOccurrenceStatus.RESOLVED,
      AlertOccurrenceStatus.SUPPRESSED,
    ]);
    expect(suppressed[0]).toMatchObject({ status: AlertOccurrenceStatus.SUPPRESSED });
    expect(occurrences[0]).toMatchObject({
      source: 'Fictional GitHub integration fixture-a',
      freshnessAt: new Date('2026-11-27T09:00:00.000Z'),
      reason: 'Provider sync failed (rate_limited)',
      nextAction: 'Review provider access and retry the connector.',
    });
    expect(deliveries).toHaveLength(0);
  });

  it('does not duplicate the same event and lets critical alerts bypass suppression', async () => {
    const alert = makeAlert({ severity: AlertSeverity.CRITICAL, lastTriggeredAt: new Date('2026-11-27T09:59:59.000Z') });
    const { service, occurrences } = harness(alert);
    await service.evaluateWorkspaceMetric(alert.workspaceId, signal('same-job:failed', 1));
    const duplicate = await service.evaluateWorkspaceMetric(alert.workspaceId, signal('same-job:failed', 1));
    await service.evaluateWorkspaceMetric(alert.workspaceId, signal('next-job:failed', 1));

    expect(duplicate[0]).toMatchObject({ duplicate: true });
    expect(occurrences).toHaveLength(2);
    expect(occurrences.every((event) => event.status === AlertOccurrenceStatus.TRIGGERED)).toBe(true);
    expect(alert.triggerCount).toBe(2);
  });

  it('records a failed channel delivery and automatically retries it with observable attempt status', async () => {
    const alert = makeAlert({ channels: ['email'], emailRecipients: ['ops@fictional.invalid'] });
    const email = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { service, deliveries } = harness(alert, email);
    await service.evaluateWorkspaceMetric(alert.workspaceId, signal('sync-a:failed', 1));
    const delivery = deliveries[0];
    expect(delivery).toMatchObject({ status: AlertDeliveryStatus.FAILED, attemptCount: 1, lastErrorCode: 'channel_delivery_failed' });
    expect(await service.retryDueDeliveries()).toBe(0);
    jest.useFakeTimers();
    jest.setSystemTime(new Date(delivery.nextAttemptAt.getTime() + 1000));
    expect(await service.retryDueDeliveries()).toBe(1);
    jest.useRealTimers();
    expect(delivery).toMatchObject({ status: AlertDeliveryStatus.SENT, attemptCount: 2 });
    expect(email).toHaveBeenCalledTimes(2);
  });

  it('denies another workspace alert and delivery IDs', async () => {
    const { service } = harness();
    await expect(service.findOne('alert-fixture-a', 'workspace-other')).rejects.toThrow('Alert not found');
    await expect(service.retryDelivery('alert-fixture-a', 'delivery-from-other-tenant', 'workspace-other')).rejects.toThrow('Alert delivery not found');
  });

  it('rejects portal and widget IDs outside the authenticated workspace', async () => {
    const { service, prisma } = harness();
    prisma.portal.findFirst.mockResolvedValue(null);
    await expect(service.create('workspace-fixture-a', 'user-a', {
      name: 'Fictional scoped rule',
      condition: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 },
      channels: [],
      portalId: 'portal-from-other-tenant',
    } as any)).rejects.toThrow('Portal not found');
    expect(prisma.alert.create).not.toHaveBeenCalled();

    prisma.portal.findFirst.mockResolvedValue({ id: 'portal-fixture-a' });
    prisma.widget.findFirst.mockResolvedValue(null);
    await expect(service.create('workspace-fixture-a', 'user-a', {
      name: 'Fictional scoped rule',
      condition: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 },
      channels: [],
      widgetId: 'widget-from-other-tenant',
    } as any)).rejects.toThrow('Widget not found');
  });

  it('never persists a forged workspace or creator from alert input', async () => {
    const { service, prisma } = harness();
    await service.create('workspace-fixture-a', 'owner-fixture-a', {
      name: 'Fictional scoped rule',
      condition: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 },
      channels: [],
      workspaceId: 'workspace-other',
      createdById: 'owner-other',
    } as any);
    expect(prisma.alert.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      workspace: { connect: { id: 'workspace-fixture-a' } },
      createdBy: { connect: { id: 'owner-fixture-a' } },
    }) });
    expect(prisma.alert.create.mock.calls[0][0].data).not.toHaveProperty('workspaceId');
    expect(prisma.alert.create.mock.calls[0][0].data).not.toHaveProperty('createdById');
  });

  it('archives deleted rules so delivery and escalation history are retained', async () => {
    const { service, prisma, alert } = harness();
    await service.remove(alert.id, alert.workspaceId);
    expect(alert.isActive).toBe(false);
    expect(alert.deletedAt).toBeInstanceOf(Date);
    expect(prisma.alert.deleteMany).not.toHaveBeenCalled();
  });

  it('does not expose configured webhook secrets from alert reads', async () => {
    const alert = makeAlert({ webhookUrl: 'https://hooks.fictional.invalid/secret', slackWebhook: 'https://hooks.fictional.invalid/slack-secret' });
    const { service } = harness(alert);
    const result = await service.findOne(alert.id, alert.workspaceId);
    expect(result).not.toHaveProperty('webhookUrl');
    expect(result).not.toHaveProperty('slackWebhook');
  });
});
