import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { PrismaService } from '../prisma/prisma.service';

import {
  MetricProvenanceService,
  aggregateMetricSamples,
  convertMetricUnit,
  METRIC_TRANSFORMS,
  metricFeedHealth,
  zonedDayBounds,
} from './metric-provenance.service';

describe('metric provenance contracts', () => {
  it('uses real local-day bounds across a daylight-saving transition', () => {
    const { start, end } = zonedDayBounds(new Date('2025-03-09T17:00:00.000Z'), 'America/New_York');
    expect(start.toISOString()).toBe('2025-03-09T05:00:00.000Z');
    expect(end.toISOString()).toBe('2025-03-10T04:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('keeps missing values null and flags unknown provider state as schema drift', () => {
    expect(METRIC_TRANSFORMS['github.issue_open@1']({ state: 'open' })).toBe(1);
    expect(METRIC_TRANSFORMS['github.issue_open@1']({ state: 'closed' })).toBe(0);
    expect(METRIC_TRANSFORMS['github.issue_open@1']({ state: null })).toBeNull();
    expect(METRIC_TRANSFORMS['github.issue_comments@1']({ comments: '12' })).toBeNull();
  });

  it('rounds to the persisted precision and rejects incompatible units', () => {
    expect(convertMetricUnit(1.12345678, 'issues', 'issues')).toBe(1.123457);
    expect(convertMetricUnit(2, 'seconds', 'milliseconds')).toBe(2000);
    expect(() => convertMetricUnit(1, 'issues', 'comments')).toThrow(BadRequestException);
    expect(() => convertMetricUnit(Number.NaN, 'issues', 'issues')).toThrow(BadRequestException);
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-02T00:00:00Z');
    expect(
      aggregateMetricSamples([
        { value: 1, unit: 'issues', periodStart: start, periodEnd: end },
        { value: 2, unit: 'issues', periodStart: start, periodEnd: end },
      ]),
    ).toBe(3);
    expect(
      aggregateMetricSamples(
        [
          { value: 1, unit: 'seconds', periodStart: start, periodEnd: end },
          { value: 2, unit: 'seconds', periodStart: start, periodEnd: end },
        ],
        'AVG',
      ),
    ).toBe(1.5);
    expect(() =>
      aggregateMetricSamples([
        { value: 1, unit: 'issues', periodStart: start, periodEnd: end },
        {
          value: 2,
          unit: 'issues',
          periodStart: start,
          periodEnd: new Date('2025-01-03T00:00:00Z'),
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it('marks absent and old feeds stale at the operational threshold', () => {
    const now = new Date('2025-01-02T00:00:00.000Z');
    expect(metricFeedHealth(null, now)).toBe('STALE');
    expect(metricFeedHealth(new Date('2024-12-31T23:59:59.999Z'), now)).toBe('STALE');
    expect(metricFeedHealth(new Date('2025-01-01T00:00:00.000Z'), now)).toBe('CONNECTED');
    expect(metricFeedHealth(new Date('2025-01-01T12:00:00.000Z'), now)).toBe('CONNECTED');
  });

  it('upserts duplicate source deliveries and versioned normalized values idempotently', async () => {
    const integration = { id: 'integration-a' };
    const definition = (key: string, transformKey: string, unit: string) => ({
      id: `def-${key}`,
      transformKey,
      transformVersion: '1',
      unit,
    });
    const definitions = [
      definition('open', 'github.issue_open', 'issues'),
      definition('comments', 'github.issue_comments', 'comments'),
    ];
    const prisma = {
      integration: { findFirst: jest.fn().mockResolvedValue(integration) },
      metricDefinition: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce(definitions[0])
          .mockResolvedValueOnce(definitions[1]),
      },
      syncRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            externalId: '42',
            payload: { state: 'open', comments: 3 },
            sourceUpdatedAt: new Date('2025-01-01T00:00:00Z'),
          },
          {
            externalId: '42',
            payload: { state: 'open', comments: 3 },
            sourceUpdatedAt: new Date('2025-01-01T00:00:00Z'),
          },
        ]),
      },
      metricSourceObservation: {
        upsert: jest.fn().mockResolvedValue({ id: 'source-1' }),
      },
      metricNormalizedObservation: { upsert: jest.fn().mockResolvedValue({}) },
      metricMapping: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MetricProvenanceService(prisma as unknown as PrismaService);
    await service.recordGitHubSync('workspace-a', 'integration-a');
    expect(prisma.metricSourceObservation.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.metricSourceObservation.upsert.mock.calls[0][0].where).toEqual(
      prisma.metricSourceObservation.upsert.mock.calls[1][0].where,
    );
    expect(prisma.metricSourceObservation.upsert.mock.calls[0][0].create.sourcePayload).toEqual({
      state: 'open',
      comments: 3,
    });
    expect(prisma.metricNormalizedObservation.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.metricNormalizedObservation.upsert.mock.calls[0][0].create.value).toBe(1);
  });

  it('refuses a portal ID from another workspace before mapping a shared provider account', async () => {
    const prisma = {
      portal: { findFirst: jest.fn().mockResolvedValue(null) },
      integration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'integration-a', provider: 'GITHUB' }),
      },
      metricDefinition: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'definition-a',
          provider: 'GITHUB',
          unit: 'issues',
        }),
      },
    };
    const service = new MetricProvenanceService(prisma as unknown as PrismaService);
    await expect(
      service.createMapping('workspace-a', {
        portalId: 'portal-from-workspace-b',
        integrationId: 'integration-a',
        metricDefinitionId: 'definition-a',
        displayName: 'Open issues',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.portal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'portal-from-workspace-b',
          workspaceId: 'workspace-a',
          deletedAt: null,
        },
      }),
    );
  });

  it('marks unsupported fixed-provider values as schema changes, not numeric zeroes', async () => {
    const definitions = [
      {
        id: 'open',
        key: 'github.issue_open',
        transformKey: 'github.issue_open',
        transformVersion: '1',
        unit: 'issues',
      },
      {
        id: 'comments',
        key: 'github.issue_comments',
        transformKey: 'github.issue_comments',
        transformVersion: '1',
        unit: 'comments',
      },
    ];
    const normalizedCreates: any[] = [];
    const prisma = {
      integration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'integration-a' }),
      },
      metricDefinition: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce(definitions[0])
          .mockResolvedValueOnce(definitions[1]),
      },
      syncRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            externalId: 'bad-state',
            payload: { state: 'reopened', comments: 4 },
            sourceUpdatedAt: null,
          },
        ]),
      },
      metricSourceObservation: {
        upsert: jest.fn().mockResolvedValue({ id: 'source-bad' }),
      },
      metricNormalizedObservation: {
        upsert: jest.fn(async ({ create }: any) => {
          normalizedCreates.push(create);
          return create;
        }),
      },
      metricMapping: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await new MetricProvenanceService(prisma as unknown as PrismaService).recordGitHubSync(
      'workspace-a',
      'integration-a',
    );
    expect(normalizedCreates.map((item) => item.quality)).toEqual(['SCHEMA_CHANGED', 'VALID']);
    expect(normalizedCreates[0].value).toBeNull();
  });

  it('records a reasoned reprocess run and scopes it to the authenticated workspace', async () => {
    const mapping = {
      id: 'mapping-a',
      integrationId: 'integration-a',
      metricDefinition: { transformVersion: '1' },
    };
    const run = { id: 'repair-a' };
    const prisma = {
      metricMapping: {
        findFirst: jest.fn().mockResolvedValue(mapping),
        findMany: jest.fn().mockResolvedValue([]),
      },
      metricReprocessRun: {
        create: jest.fn().mockResolvedValue(run),
        update: jest.fn().mockResolvedValue({ ...run, status: 'COMPLETED' }),
      },
      metricSnapshot: {
        findFirst: jest.fn().mockResolvedValue({ id: 'snapshot-a' }),
      },
    };
    const service = new MetricProvenanceService(prisma as unknown as PrismaService);
    jest.spyOn(service, 'recordGitHubSync').mockResolvedValue(undefined);
    await expect(
      service.reprocess(
        'workspace-a',
        'agency-user-a',
        'mapping-a',
        'Correct source adapter mapping',
      ),
    ).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(prisma.metricMapping.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mapping-a', workspaceId: 'workspace-a' },
      }),
    );
    expect(prisma.metricReprocessRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-a',
          requestedBy: 'agency-user-a',
          reason: 'Correct source adapter mapping',
        }),
      }),
    );
  });

  it('only returns client-visible metrics and hides source references without drilldown permission', async () => {
    const prisma = {
      metricMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'map-client-a',
            displayName: 'Open issues',
            allowSourceDrilldown: false,
            metricDefinition: {
              name: 'Open issues',
              unit: 'issues',
              entity: 'issue',
              key: 'github.issue_open',
              aggregation: 'SUM',
              transformKey: 'github.issue_open',
              transformVersion: '1',
            },
            integration: {
              provider: 'GITHUB',
              lastSyncedAt: new Date(),
              connectionState: 'CONNECTED',
            },
            snapshots: [
              {
                value: 2,
                unit: 'issues',
                periodStart: new Date('2025-01-01T00:00Z'),
                periodEnd: new Date('2025-01-02T00:00Z'),
                timeZone: 'UTC',
                calculatedAt: new Date(),
                quality: 'VALID',
                confidence: 1,
                limitations: [],
                sources: [
                  {
                    sourceObservation: {
                      externalId: '42',
                      sourceUpdatedAt: new Date(),
                    },
                  },
                ],
              },
            ],
          },
        ]),
      },
    };
    const result = await new MetricProvenanceService(
      prisma as unknown as PrismaService,
    ).publicMetrics('portal-client-a');
    expect(prisma.metricMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          portalId: 'portal-client-a',
          clientVisible: true,
          portal: { deletedAt: null },
        },
      }),
    );
    expect(result[0].sources).toBeUndefined();
    expect(result[0].value).toBe('2');
  });

  it('denies client-member access to agency metric mapping controls', () => {
    const guard = new AgencyRoleGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'MEMBER' } }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow();
  });
});
