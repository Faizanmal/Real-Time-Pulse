import { createHash } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MetricAggregation, MetricQualityStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const DEFINITIONS = [
  {
    key: 'github.issue_open',
    name: 'Open issues',
    transformKey: 'github.issue_open',
    sourceFields: ['state'],
    unit: 'issues',
    aggregation: MetricAggregation.SUM,
    definition:
      'Count of current provider issue records whose source state is open, as of the snapshot.',
  },
  {
    key: 'github.issue_comments',
    name: 'Issue comments',
    transformKey: 'github.issue_comments',
    sourceFields: ['comments'],
    unit: 'comments',
    aggregation: MetricAggregation.SUM,
    definition: 'Sum of current provider issue comment counts, as of the snapshot.',
  },
] as const;

/** Allowlisted, versioned transformations. No dynamic code or implicit coercion. */
export const METRIC_TRANSFORMS = {
  'github.issue_open@1': (payload: Record<string, unknown>) =>
    payload.state === 'open' ? 1 : payload.state === 'closed' ? 0 : null,
  'github.issue_comments@1': (payload: Record<string, unknown>) =>
    typeof payload.comments === 'number' &&
    Number.isFinite(payload.comments) &&
    payload.comments >= 0
      ? payload.comments
      : null,
} as const;

function zonedOffset(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return (
    Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) -
    at.getTime()
  );
}

function resolveLocalMidnight(year: number, month: number, day: number, timeZone: string) {
  const localAsUtc = Date.UTC(year, month - 1, day);
  let instant = localAsUtc;
  for (let i = 0; i < 3; i += 1) instant = localAsUtc - zonedOffset(new Date(instant), timeZone);
  return new Date(instant);
}

export function zonedDayBounds(date: Date, timeZone: string) {
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('Invalid metric date');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const start = resolveLocalMidnight(values.year, values.month, values.day, timeZone);
  const next = new Date(Date.UTC(values.year, values.month - 1, values.day + 1));
  const end = resolveLocalMidnight(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  return { start, end };
}

export function convertMetricUnit(value: number, from: string, to: string) {
  if (!Number.isFinite(value)) throw new BadRequestException('Metric value must be finite');
  const factor = from === to ? 1 : UNIT_CONVERSIONS[from]?.[to];
  if (factor === undefined)
    throw new BadRequestException(`Incompatible metric units: ${from} and ${to}`);
  return Number((value * factor).toFixed(6));
}

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  seconds: { milliseconds: 1000, minutes: 1 / 60, hours: 1 / 3600 },
  milliseconds: { seconds: 1 / 1000 },
  minutes: { seconds: 60 },
  hours: { seconds: 3600 },
};

export function aggregateMetricSamples(
  samples: Array<{
    value: number | null;
    unit: string;
    periodStart: Date;
    periodEnd: Date;
  }>,
  aggregation: MetricAggregation = MetricAggregation.SUM,
) {
  if (!samples.length) return null;
  const first = samples[0];
  if (
    samples.some(
      (sample) =>
        sample.unit !== first.unit ||
        sample.periodStart.getTime() !== first.periodStart.getTime() ||
        sample.periodEnd.getTime() !== first.periodEnd.getTime(),
    )
  ) {
    throw new BadRequestException(
      'Metric aggregation requires one unit and one identical time period',
    );
  }
  const values = samples.flatMap((sample) =>
    sample.value !== null && Number.isFinite(sample.value) ? [sample.value] : [],
  );
  if (!values.length) return null;
  const result =
    aggregation === MetricAggregation.COUNT
      ? values.length
      : aggregation === MetricAggregation.AVG
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : aggregation === MetricAggregation.MIN
          ? Math.min(...values)
          : aggregation === MetricAggregation.MAX
            ? Math.max(...values)
            : aggregation === MetricAggregation.LAST
              ? values.at(-1)
              : values.reduce((sum, value) => sum + value, 0);
  return Number(result.toFixed(6));
}

export function metricFeedHealth(lastSyncedAt: Date | null, now = new Date()) {
  return !lastSyncedAt || now.getTime() - lastSyncedAt.getTime() > 24 * 60 * 60 * 1000
    ? 'STALE'
    : 'CONNECTED';
}

@Injectable()
export class MetricProvenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(workspaceId: string) {
    await this.ensureCatalog(workspaceId);
    return this.prisma.metricDefinition.findMany({
      where: { workspaceId, active: true },
      orderBy: [{ provider: 'asc' }, { name: 'asc' }],
    });
  }

  async listMappings(workspaceId: string) {
    const rows = await this.prisma.metricMapping.findMany({
      where: { workspaceId },
      include: {
        portal: { select: { id: true, name: true } },
        integration: {
          select: {
            id: true,
            provider: true,
            lastSyncedAt: true,
            connectionState: true,
          },
        },
        metricDefinition: true,
        snapshots: {
          orderBy: { periodEnd: 'desc' },
          take: 1,
          include: {
            sources: {
              include: {
                sourceObservation: {
                  select: { id: true, externalId: true, sourceUpdatedAt: true },
                },
              },
            },
          },
        },
        milestones: { orderBy: { targetDate: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      ...row,
      feedHealth:
        metricFeedHealth(row.integration.lastSyncedAt) === 'STALE'
          ? 'STALE'
          : row.integration.connectionState,
      latestSnapshot: row.snapshots[0] ?? null,
      snapshots: undefined,
    }));
  }

  async createMapping(
    workspaceId: string,
    input: {
      portalId: string;
      integrationId: string;
      metricDefinitionId: string;
      displayName: string;
      clientVisible?: boolean;
      allowSourceDrilldown?: boolean;
      targetValue?: number;
      targetUnit?: string;
    },
  ) {
    const [portal, integration, definition] = await Promise.all([
      this.prisma.portal.findFirst({
        where: { id: input.portalId, workspaceId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.integration.findFirst({
        where: { id: input.integrationId, workspaceId },
        select: { id: true, provider: true },
      }),
      this.prisma.metricDefinition.findFirst({
        where: { id: input.metricDefinitionId, workspaceId, active: true },
      }),
    ]);
    if (!portal || !integration || !definition)
      throw new NotFoundException(
        'Portal, integration, or metric is unavailable in this workspace',
      );
    if (integration.provider !== definition.provider)
      throw new BadRequestException(
        'Metric source provider does not match the selected integration',
      );
    if (
      typeof input.displayName !== 'string' ||
      !input.displayName.trim() ||
      input.displayName.length > 120
    )
      throw new BadRequestException(
        'Metric display name is required and must be at most 120 characters',
      );
    if (
      input.targetValue !== undefined &&
      (!Number.isFinite(input.targetValue) || input.targetUnit !== definition.unit)
    )
      throw new BadRequestException('Target must be finite and use the metric unit');
    const mapping = await this.prisma.metricMapping.upsert({
      where: {
        portalId_metricDefinitionId: {
          portalId: portal.id,
          metricDefinitionId: definition.id,
        },
      },
      create: {
        workspaceId,
        portalId: portal.id,
        integrationId: integration.id,
        metricDefinitionId: definition.id,
        displayName: input.displayName.trim(),
        clientVisible: input.clientVisible ?? false,
        allowSourceDrilldown: input.allowSourceDrilldown ?? false,
        targetValue: input.targetValue,
        targetUnit: input.targetUnit,
      },
      update: {
        integrationId: integration.id,
        displayName: input.displayName.trim(),
        clientVisible: input.clientVisible ?? false,
        allowSourceDrilldown: input.allowSourceDrilldown ?? false,
        targetValue: input.targetValue,
        targetUnit: input.targetUnit,
      },
    });
    // This is a local replay over already stored normalized sync rows; it performs no provider request.
    await this.recordGitHubSync(workspaceId, integration.id);
    await this.refreshSnapshots(workspaceId, integration.id, mapping.id);
    return mapping;
  }

  async recordGitHubSync(workspaceId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, workspaceId, provider: 'GITHUB' },
      select: { id: true },
    });
    if (!integration) return;
    const definitions = await this.ensureCatalog(workspaceId);
    const records = await this.prisma.syncRecord.findMany({
      where: { integrationId },
      orderBy: { externalId: 'asc' },
    });
    for (const record of records) {
      const payload = record.payload as Record<string, unknown>;
      const safePayload: Record<string, string | number | null> = {
        state: typeof payload.state === 'string' ? payload.state : null,
        comments:
          typeof payload.comments === 'number' && Number.isFinite(payload.comments)
            ? payload.comments
            : null,
      };
      const sourceSchemaHash =
        typeof payload._sourceSchemaHash === 'string'
          ? payload._sourceSchemaHash
          : createHash('sha256').update(Object.keys(safePayload).sort().join(',')).digest('hex');
      const sourceVersionHash = createHash('sha256')
        .update(
          JSON.stringify({
            id: record.externalId,
            payload: safePayload,
            updated: record.sourceUpdatedAt?.toISOString() ?? null,
            sourceSchemaHash,
          }),
        )
        .digest('hex');
      const observation = await this.prisma.metricSourceObservation.upsert({
        where: {
          integrationId_externalId_sourceVersionHash: {
            integrationId,
            externalId: record.externalId,
            sourceVersionHash,
          },
        },
        create: {
          workspaceId,
          integrationId,
          externalId: record.externalId,
          sourceVersionHash,
          sourceSchemaHash,
          sourceUpdatedAt: record.sourceUpdatedAt,
          sourcePayload: safePayload,
        },
        update: {},
      });
      for (const definition of definitions) {
        const transform =
          METRIC_TRANSFORMS[
            `${definition.transformKey}@${definition.transformVersion}` as keyof typeof METRIC_TRANSFORMS
          ];
        const value = transform?.(safePayload) ?? null;
        const fieldMalformed =
          (definition.transformKey === 'github.issue_open' &&
            payload.state !== 'open' &&
            payload.state !== 'closed') ||
          (definition.transformKey === 'github.issue_comments' &&
            (typeof payload.comments !== 'number' ||
              !Number.isFinite(payload.comments) ||
              payload.comments < 0));
        const quality =
          value !== null
            ? MetricQualityStatus.VALID
            : fieldMalformed
              ? MetricQualityStatus.SCHEMA_CHANGED
              : MetricQualityStatus.MISSING;
        await this.prisma.metricNormalizedObservation.upsert({
          where: {
            sourceObservationId_metricDefinitionId_transformVersion: {
              sourceObservationId: observation.id,
              metricDefinitionId: definition.id,
              transformVersion: definition.transformVersion,
            },
          },
          create: {
            workspaceId,
            sourceObservationId: observation.id,
            metricDefinitionId: definition.id,
            value,
            unit: definition.unit,
            quality,
            missingReason:
              value === null
                ? 'Required value missing or unsupported by the fixed provider schema'
                : null,
            transformVersion: definition.transformVersion,
          },
          update: {},
        });
      }
    }
    await this.refreshSnapshots(workspaceId, integrationId);
  }

  async publicMetrics(portalId: string) {
    const mappings = await this.prisma.metricMapping.findMany({
      where: { portalId, clientVisible: true, portal: { deletedAt: null } },
      include: {
        metricDefinition: true,
        integration: {
          select: { provider: true, lastSyncedAt: true, connectionState: true },
        },
        snapshots: {
          orderBy: { periodEnd: 'desc' },
          take: 1,
          include: {
            sources: {
              include: {
                sourceObservation: {
                  select: { id: true, externalId: true, sourceUpdatedAt: true },
                },
              },
            },
          },
        },
      },
    });
    return mappings.map(
      ({
        metricDefinition: definition,
        integration,
        snapshots,
        allowSourceDrilldown,
        ...mapping
      }) => {
        const snapshot = snapshots[0] ?? null;
        const feedHealth = metricFeedHealth(integration.lastSyncedAt);
        return {
          id: mapping.id,
          name: mapping.displayName,
          value: snapshot?.value?.toString() ?? null,
          unit: definition.unit,
          source: `${integration.provider}:${definition.entity}`,
          timeRange: snapshot
            ? {
                start: snapshot.periodStart,
                end: snapshot.periodEnd,
                timeZone: snapshot.timeZone,
              }
            : null,
          lastUpdatedAt: snapshot?.calculatedAt ?? null,
          sourceFreshnessAt: integration.lastSyncedAt,
          health: feedHealth === 'STALE' ? feedHealth : integration.connectionState,
          quality: snapshot?.quality ?? 'MISSING',
          confidence: snapshot?.confidence?.toString() ?? null,
          calculation: `${definition.aggregation} ${definition.key} (${definition.transformKey}@${definition.transformVersion})`,
          limitations: snapshot?.limitations ?? ['No valid source observations are available'],
          sources: allowSourceDrilldown
            ? (snapshot?.sources.map((source) => ({
                externalId: source.sourceObservation.externalId,
                updatedAt: source.sourceObservation.sourceUpdatedAt,
              })) ?? [])
            : undefined,
        };
      },
    );
  }

  async reprocess(workspaceId: string, userId: string, mappingId: string, reason: string) {
    const mapping = await this.prisma.metricMapping.findFirst({
      where: { id: mappingId, workspaceId },
      include: { metricDefinition: true },
    });
    if (!mapping) throw new NotFoundException('Metric mapping not found');
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 500)
      throw new BadRequestException(
        'A repair reason is required for the audit trail and must be at most 500 characters',
      );
    const run = await this.prisma.metricReprocessRun.create({
      data: {
        workspaceId,
        mappingId,
        requestedBy: userId,
        reason: reason.trim(),
        transformVersion: mapping.metricDefinition.transformVersion,
      },
    });
    try {
      await this.recordGitHubSync(workspaceId, mapping.integrationId);
      await this.refreshSnapshots(workspaceId, mapping.integrationId, mapping.id);
      const snapshot = await this.prisma.metricSnapshot.findFirst({
        where: { mappingId },
        orderBy: { periodEnd: 'desc' },
        select: { id: true },
      });
      return await this.prisma.metricReprocessRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          snapshotId: snapshot?.id,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.metricReprocessRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorCode: 'reprocess_failed',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async createMilestone(
    workspaceId: string,
    mappingId: string,
    input: {
      name: string;
      description?: string;
      targetValue: number;
      targetDate: string;
    },
  ) {
    const mapping = await this.prisma.metricMapping.findFirst({
      where: { id: mappingId, workspaceId },
      include: { metricDefinition: true },
    });
    if (!mapping) throw new NotFoundException('Metric mapping not found');
    const targetDate = new Date(input.targetDate);
    if (
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.length > 120 ||
      !Number.isFinite(input.targetValue) ||
      Number.isNaN(targetDate.getTime())
    )
      throw new BadRequestException(
        'Milestone name, finite target, and valid target date are required',
      );
    return this.prisma.metricMilestone.create({
      data: {
        workspaceId,
        mappingId,
        name: input.name.trim(),
        description: input.description?.trim(),
        targetValue: input.targetValue,
        targetDate,
      },
    });
  }

  private async ensureCatalog(workspaceId: string) {
    return Promise.all(
      DEFINITIONS.map((item) =>
        this.prisma.metricDefinition.upsert({
          where: {
            workspaceId_namespace_key_version: {
              workspaceId,
              namespace: 'github',
              key: item.key,
              version: 1,
            },
          },
          create: {
            workspaceId,
            namespace: 'github',
            key: item.key,
            name: item.name,
            source: 'GitHub Issues API',
            provider: 'GITHUB',
            entity: 'issue',
            grain: 'one provider issue',
            valueType: 'NUMBER',
            unit: item.unit,
            aggregation: item.aggregation,
            timeZone: 'UTC',
            samplePeriod: 'daily snapshot',
            definition: item.definition,
            owner: 'Workspace administrator',
            sensitivity: 'INTERNAL',
            transformKey: item.transformKey,
            transformVersion: '1',
            sourceFields: [...item.sourceFields],
          },
          update: {},
        }),
      ),
    );
  }

  private async refreshSnapshots(workspaceId: string, integrationId: string, mappingId?: string) {
    const mappings = await this.prisma.metricMapping.findMany({
      where: {
        workspaceId,
        integrationId,
        ...(mappingId ? { id: mappingId } : {}),
      },
      include: { metricDefinition: true },
    });
    for (const mapping of mappings) {
      const { start: periodStart, end: periodEnd } = zonedDayBounds(
        new Date(),
        mapping.metricDefinition.timeZone,
      );
      // The period labels the daily point-in-time snapshot. Its issue-state inputs are the latest immutable versions, including issues that did not change today.
      const observations = await this.prisma.metricNormalizedObservation.findMany({
        where: {
          workspaceId,
          metricDefinitionId: mapping.metricDefinitionId,
          sourceObservation: { integrationId },
        },
        include: { sourceObservation: true },
        orderBy: { sourceObservation: { observedAt: 'asc' } },
      });
      const latestBySource = new Map<string, (typeof observations)[number]>();
      for (const observation of observations)
        latestBySource.set(observation.sourceObservation.externalId, observation);
      const currentObservations = [...latestBySource.values()];
      const values = currentObservations.filter(
        (item) => item.quality === 'VALID' && item.value !== null,
      );
      const expected = currentObservations.length;
      const schemaChangedCount = currentObservations.filter(
        (item) => item.quality === 'SCHEMA_CHANGED',
      ).length;
      const hasMissing = values.length < expected;
      const value = aggregateMetricSamples(
        values.map((item) => ({
          value: item.value === null ? null : Number(item.value),
          unit: item.unit,
          periodStart,
          periodEnd,
        })),
        mapping.metricDefinition.aggregation,
      );
      const quality =
        schemaChangedCount > 0
          ? 'SCHEMA_CHANGED'
          : value === null
            ? 'MISSING'
            : hasMissing
              ? 'PARTIAL'
              : 'VALID';
      const limitations =
        schemaChangedCount > 0
          ? [
              `${schemaChangedCount} source observation(s) did not match the registered transform contract`,
            ]
          : hasMissing
            ? [
                'Some observations lacked required values; missing values were excluded, not treated as zero',
              ]
            : value === null
              ? ['No valid observations; value is unavailable, not zero']
              : [];
      await this.prisma.$transaction(async (tx) => {
        const snapshotRow = await tx.metricSnapshot.upsert({
          where: {
            mappingId_periodStart_periodEnd_calculationVersion: {
              mappingId: mapping.id,
              periodStart,
              periodEnd,
              calculationVersion: 'metric-snapshot-v1',
            },
          },
          create: {
            workspaceId,
            mappingId: mapping.id,
            periodStart,
            periodEnd,
            value,
            unit: mapping.metricDefinition.unit,
            aggregation: mapping.metricDefinition.aggregation,
            timeZone: mapping.metricDefinition.timeZone,
            quality,
            confidence: value === null ? null : hasMissing || schemaChangedCount > 0 ? 0.75 : 1,
            sampleCount: values.length,
            sourceLatestAt: values.reduce<Date | null>((latest, item) => {
              const timestamp =
                item.sourceObservation.sourceUpdatedAt ?? item.sourceObservation.observedAt;
              return !latest || timestamp > latest ? timestamp : latest;
            }, null),
            calculationVersion: 'metric-snapshot-v1',
            transformVersion: mapping.metricDefinition.transformVersion,
            limitations,
          },
          update: {
            value,
            quality,
            confidence: value === null ? null : hasMissing || schemaChangedCount > 0 ? 0.75 : 1,
            sampleCount: values.length,
            sourceLatestAt: values.reduce<Date | null>((latest, item) => {
              const timestamp =
                item.sourceObservation.sourceUpdatedAt ?? item.sourceObservation.observedAt;
              return !latest || timestamp > latest ? timestamp : latest;
            }, null),
            limitations,
            calculatedAt: new Date(),
          },
        });
        await tx.metricSnapshotSource.deleteMany({
          where: { snapshotId: snapshotRow.id },
        });
        if (values.length)
          await tx.metricSnapshotSource.createMany({
            data: values.map((item) => ({
              snapshotId: snapshotRow.id,
              sourceObservationId: item.sourceObservationId,
            })),
            skipDuplicates: true,
          });
        return snapshotRow;
      });
    }
  }
}
