import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ProductTelemetryKind } from '@prisma/client';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { PrismaService } from '../prisma/prisma.service';

import { ProductAnalyticsService } from './product-analytics.service';

const event = {
  eventId: '00000000-0000-4000-8000-000000000101',
  featureKey: 'portal_builder',
  kind: ProductTelemetryKind.COST,
  eventName: 'job.runtime',
  value: 2.5,
  unit: 'seconds',
  costCategory: 'JOB_RUNTIME' as const,
  costBasis: 'ESTIMATED' as const,
  costMicros: 1250,
  currency: 'USD',
};

describe('product analytics cost ledger', () => {
  it('records an idempotent event under the authenticated workspace and performs no billing call', async () => {
    const prisma = {
      productTelemetryEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      usageRecord: { create: jest.fn() },
    };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    await expect(service.record('tenant-a', event)).resolves.toEqual({
      accepted: true,
      duplicate: false,
    });
    const call = prisma.productTelemetryEvent.createMany.mock.calls[0][0];
    expect(call.data[0]).toMatchObject({
      workspaceId: 'tenant-a',
      eventId: event.eventId,
      costMicros: 1250n,
    });
    expect(call.skipDuplicates).toBe(true);
    expect(prisma.usageRecord.create).not.toHaveBeenCalled();
    prisma.productTelemetryEvent.createMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.record('tenant-a', event)).resolves.toEqual({
      accepted: false,
      duplicate: true,
    });
  });

  it('accepts measured or estimated amounts for each supported cost category', async () => {
    const categories = ['PROVIDER_CALL', 'JOB_RUNTIME', 'EMAIL', 'STORAGE', 'AI_TOKENS'] as const;
    const prisma = {
      productTelemetryEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    for (const [index, costCategory] of categories.entries()) {
      await service.record('tenant-a', {
        ...event,
        eventId: `00000000-0000-4000-8000-00000000020${index + 1}`,
        costCategory,
      });
    }
    expect(prisma.productTelemetryEvent.createMany).toHaveBeenCalledTimes(5);
    expect(
      prisma.productTelemetryEvent.createMany.mock.calls.map(
        (call) => call[0].data[0].costCategory,
      ),
    ).toEqual(categories);
  });

  it('shows measured usage without inventing a cost when no rate is available', async () => {
    const prisma = {
      productTelemetryEvent: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            {
              featureKey: 'integrations',
              kind: 'COST',
              costCategory: 'PROVIDER_CALL',
              costBasis: null,
              currency: null,
              unit: 'calls',
              _count: { _all: 4 },
              _sum: { value: 12, costMicros: null },
              _max: { createdAt: null },
            },
          ])
          .mockResolvedValueOnce([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { createdAt: null } }),
      },
    };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    const summary = await service.summary('tenant-a');
    expect(summary.features[0]).toMatchObject({
      featureKey: 'integrations',
      usage: [{ category: 'PROVIDER_CALL', unit: 'calls', quantity: 12, events: 4 }],
      costs: [],
    });
  });

  it('rejects inconsistent cost, experiment, negative and invalid-window payloads', async () => {
    const prisma = { productTelemetryEvent: { createMany: jest.fn() } };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    await expect(service.record('tenant-a', { ...event, currency: undefined })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.record('tenant-a', { ...event, value: -1 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.record('tenant-a', {
        ...event,
        kind: ProductTelemetryKind.EXPERIMENT,
        costCategory: undefined,
        costBasis: undefined,
        costMicros: undefined,
        currency: undefined,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.summary('tenant-a', 91)).rejects.toThrow(BadRequestException);
    expect(prisma.productTelemetryEvent.createMany).not.toHaveBeenCalled();
  });

  it('requires active analytics consent for feature and experiment events', async () => {
    const prisma = {
      gDPRConsent: {
        findFirst: jest.fn().mockResolvedValue({ consented: false, expiresAt: null }),
      },
      productTelemetryEvent: { createMany: jest.fn() },
    };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    await expect(
      service.record('tenant-a', {
        eventId: '00000000-0000-4000-8000-000000000105',
        featureKey: 'portal_builder',
        kind: ProductTelemetryKind.FEATURE_ADOPTION,
        eventName: 'opened',
      }),
    ).resolves.toEqual({ accepted: false, duplicate: false, reason: 'consent_required' });
    expect(prisma.productTelemetryEvent.createMany).not.toHaveBeenCalled();
  });

  it('scopes dashboard and experiment queries to the requesting tenant', async () => {
    const prisma = {
      productTelemetryEvent: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { createdAt: null } }),
      },
    };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    const result = await service.summary('tenant-a', 7);
    expect(result.features).toEqual([]);
    expect(result.experiments).toEqual([]);
    for (const call of prisma.productTelemetryEvent.groupBy.mock.calls) {
      expect(call[0].where).toMatchObject({ workspaceId: 'tenant-a' });
    }
    expect(prisma.productTelemetryEvent.aggregate.mock.calls[0][0].where.workspaceId).toBe(
      'tenant-a',
    );
  });

  it('aggregates experiment samples and exports only workspace-scoped summary rows', async () => {
    const prisma = {
      productTelemetryEvent: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            {
              featureKey: 'decision_inbox',
              kind: 'FEATURE_ADOPTION',
              costCategory: null,
              costBasis: null,
              currency: null,
              _count: { _all: 3 },
              _sum: { value: 3, costMicros: null },
              _max: { createdAt: new Date('2026-11-20T12:00:00.000Z') },
            },
          ])
          .mockResolvedValueOnce([
            {
              experimentKey: 'approval-copy',
              variantKey: 'short',
              eventName: 'approved',
              _count: { _all: 2 },
              _sum: { value: 1.5 },
              _avg: { value: 0.75 },
            },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              experimentKey: 'approval-copy',
              variantKey: 'short',
              eventName: 'approved',
              _count: { _all: 2 },
              _sum: { value: 1.5 },
              _avg: { value: 0.75 },
            },
          ])
          .mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { createdAt: new Date('2026-11-20T12:00:00.000Z') } }),
      },
    };
    const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
    const result = await service.summary('tenant-a');
    expect(result.features[0]).toMatchObject({ featureKey: 'decision_inbox', adoptionEvents: 3 });
    expect(result.experiments[0]).toMatchObject({
      experimentKey: 'approval-copy',
      variantKey: 'short',
      samples: 2,
      mean: 0.75,
    });
    const csv = await service.exportExperimentsCsv('tenant-a');
    expect(csv).toContain('"approval-copy","short","approved","2"');
    expect(csv).not.toContain('tenant-b');
  });

  it('denies client members from agency analytics routes', () => {
    const guard = new AgencyRoleGuard();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'MEMBER' } }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
