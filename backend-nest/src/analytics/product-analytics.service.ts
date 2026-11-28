import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsentType, ProductTelemetryKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { RecordProductTelemetryDto } from './product-analytics.dto';

const COST_KINDS = new Set<ProductTelemetryKind>([ProductTelemetryKind.COST]);
const FEATURE_COUNT_KINDS = new Set<ProductTelemetryKind>([
  ProductTelemetryKind.FEATURE_ADOPTION,
  ProductTelemetryKind.FEATURE_SUCCESS,
  ProductTelemetryKind.FEATURE_GUARDRAIL,
]);

@Injectable()
export class ProductAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(workspaceId: string, input: RecordProductTelemetryDto) {
    this.validateRecord(input);
    if (!COST_KINDS.has(input.kind)) {
      const consent = await this.prisma.gDPRConsent.findFirst({
        where: { workspaceId, consentType: ConsentType.ANALYTICS },
        orderBy: { createdAt: 'desc' },
        select: { consented: true, expiresAt: true },
      });
      if (!consent?.consented || (consent.expiresAt && consent.expiresAt <= new Date())) {
        return { accepted: false, duplicate: false, reason: 'consent_required' as const };
      }
    }
    const result = await this.prisma.productTelemetryEvent.createMany({
      data: [
        {
          workspaceId,
          eventId: input.eventId,
          featureKey: input.featureKey,
          kind: input.kind,
          eventName: input.eventName,
          value:
            input.value ??
            (input.kind === ProductTelemetryKind.FEATURE_ADOPTION ||
            input.kind === ProductTelemetryKind.FEATURE_SUCCESS ||
            input.kind === ProductTelemetryKind.FEATURE_GUARDRAIL
              ? 1
              : undefined),
          unit: input.unit,
          costCategory: input.costCategory,
          costBasis: input.costBasis,
          costMicros: input.costMicros === undefined ? undefined : BigInt(input.costMicros),
          currency: input.currency,
          experimentKey: input.experimentKey,
          variantKey: input.variantKey,
        },
      ],
      skipDuplicates: true,
    });

    return { accepted: result.count === 1, duplicate: result.count === 0 };
  }

  async summary(workspaceId: string, days = 30) {
    const periodDays = this.normalizeDays(days);
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const where = { workspaceId, createdAt: { gte: since } };
    const [featureGroups, experimentGroups, last] = await Promise.all([
      this.prisma.productTelemetryEvent.groupBy({
        by: ['featureKey', 'kind', 'costCategory', 'costBasis', 'currency', 'unit'],
        where,
        _count: { _all: true },
        _sum: { value: true, costMicros: true },
        _max: { createdAt: true },
      }),
      this.prisma.productTelemetryEvent.groupBy({
        by: ['experimentKey', 'variantKey', 'eventName'],
        where: { ...where, kind: ProductTelemetryKind.EXPERIMENT },
        _count: { _all: true },
        _sum: { value: true },
        _avg: { value: true },
      }),
      this.prisma.productTelemetryEvent.aggregate({ where, _max: { createdAt: true } }),
    ]);

    const features = new Map<
      string,
      {
        featureKey: string;
        adoptionEvents: number;
        successEvents: number;
        guardrailEvents: number;
        costs: Map<
          string,
          { category: string; currency: string; basis: 'OBSERVED' | 'ESTIMATED'; micros: bigint }
        >;
        usage: Map<string, { category: string; unit: string; quantity: number; events: number }>;
        latestEventAt: Date | null;
      }
    >();

    for (const group of featureGroups) {
      const item = features.get(group.featureKey) ?? {
        featureKey: group.featureKey,
        adoptionEvents: 0,
        successEvents: 0,
        guardrailEvents: 0,
        costs: new Map(),
        usage: new Map(),
        latestEventAt: null,
      };
      if (group.kind === ProductTelemetryKind.FEATURE_ADOPTION)
        item.adoptionEvents += group._count._all;
      if (group.kind === ProductTelemetryKind.FEATURE_SUCCESS)
        item.successEvents += group._count._all;
      if (group.kind === ProductTelemetryKind.FEATURE_GUARDRAIL)
        item.guardrailEvents += group._count._all;
      if (group.kind === ProductTelemetryKind.COST && group.costCategory && group.unit) {
        const usageKey = `${group.costCategory}:${group.unit}`;
        const usage: { category: string; unit: string; quantity: number; events: number } =
          item.usage.get(usageKey) ?? {
            category: String(group.costCategory),
            unit: String(group.unit),
            quantity: 0,
            events: 0,
          };
        usage.quantity += Number(group._sum.value ?? 0);
        usage.events += Number(group._count._all);
        item.usage.set(usageKey, usage);
      }
      if (
        group.kind === ProductTelemetryKind.COST &&
        group.costCategory &&
        group.costBasis &&
        group.currency
      ) {
        const key = `${group.costCategory}:${group.costBasis}:${group.currency}`;
        const cost: {
          category: string;
          currency: string;
          basis: 'OBSERVED' | 'ESTIMATED';
          micros: bigint;
        } = item.costs.get(key) ?? {
          category: String(group.costCategory),
          basis: group.costBasis,
          currency: String(group.currency),
          micros: 0n,
        };
        cost.micros += group._sum.costMicros === null ? 0n : BigInt(group._sum.costMicros);
        item.costs.set(key, cost);
      }
      if (
        group._max.createdAt &&
        (!item.latestEventAt || group._max.createdAt > item.latestEventAt)
      ) {
        item.latestEventAt = group._max.createdAt;
      }
      features.set(group.featureKey, item);
    }

    const experimentResults = experimentGroups
      .filter((group) => group.experimentKey && group.variantKey)
      .map((group) => ({
        experimentKey: group.experimentKey,
        variantKey: group.variantKey,
        metric: group.eventName,
        samples: group._count._all,
        total: group._sum.value ?? 0,
        mean: group._avg.value ?? 0,
      }))
      .sort(
        (a, b) =>
          a.experimentKey.localeCompare(b.experimentKey) ||
          a.variantKey.localeCompare(b.variantKey) ||
          a.metric.localeCompare(b.metric),
      );

    return {
      periodDays,
      since: since.toISOString(),
      generatedAt: new Date().toISOString(),
      lastEventAt: last._max.createdAt?.toISOString() ?? null,
      features: [...features.values()]
        .sort((a, b) => a.featureKey.localeCompare(b.featureKey))
        .map((item) => ({
          featureKey: item.featureKey,
          adoptionEvents: item.adoptionEvents,
          successEvents: item.successEvents,
          guardrailEvents: item.guardrailEvents,
          usage: [...item.usage.values()].sort(
            (a, b) => a.category.localeCompare(b.category) || a.unit.localeCompare(b.unit),
          ),
          costs: [...item.costs.values()]
            .sort(
              (a, b) =>
                a.category.localeCompare(b.category) ||
                a.basis.localeCompare(b.basis) ||
                a.currency.localeCompare(b.currency),
            )
            .map((cost) => ({
              category: cost.category,
              basis: cost.basis,
              currency: cost.currency,
              amount: Number(cost.micros) / 1_000_000,
            })),
          latestEventAt: item.latestEventAt?.toISOString() ?? null,
        })),
      experiments: experimentResults,
    };
  }

  async exportExperimentsCsv(workspaceId: string, days = 30): Promise<string> {
    const { periodDays, since, generatedAt, experiments } = await this.summary(workspaceId, days);
    const rows = [
      [
        'period_days',
        'since',
        'generated_at',
        'experiment',
        'variant',
        'metric',
        'samples',
        'total',
        'mean',
      ],
      ...experiments.map((row) => [
        String(periodDays),
        since,
        generatedAt,
        row.experimentKey,
        row.variantKey,
        row.metric,
        String(row.samples),
        String(row.total),
        String(row.mean),
      ]),
    ];
    return rows.map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\r\n');
  }

  private validateRecord(input: RecordProductTelemetryDto): void {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.eventId)
    ) {
      throw new BadRequestException(
        'eventId must be a random UUID and cannot contain identifying data',
      );
    }
    const safeKey = /^[a-z0-9][a-z0-9._-]{0,79}$/;
    if (!safeKey.test(input.featureKey) || !safeKey.test(input.eventName)) {
      throw new BadRequestException(
        'Feature and event names must use the documented lowercase key format',
      );
    }
    const hasExperiment = Boolean(input.experimentKey || input.variantKey);
    if (input.kind === ProductTelemetryKind.EXPERIMENT) {
      if (
        !input.experimentKey ||
        !input.variantKey ||
        input.value === undefined ||
        !input.eventName
      ) {
        throw new BadRequestException(
          'Experiment events require experiment, variant, metric and value',
        );
      }
    } else if (hasExperiment) {
      throw new BadRequestException('Experiment fields are only allowed for experiment events');
    }
    if (COST_KINDS.has(input.kind)) {
      if (!input.costCategory || input.value === undefined || !input.unit) {
        throw new BadRequestException('Cost events require category, measured quantity and unit');
      }
      if (input.value !== undefined && input.value < 0)
        throw new BadRequestException('Cost quantity cannot be negative');
      if (input.costMicros !== undefined && (!input.costBasis || !input.currency)) {
        throw new BadRequestException('Cost amounts require basis and currency');
      }
      if (input.costMicros === undefined && (input.costBasis || input.currency)) {
        throw new BadRequestException('Cost basis and currency require an amount');
      }
      if (
        input.unit &&
        !/^(count|calls|seconds|milliseconds|bytes|kilobytes|megabytes|gigabytes|tokens|emails)$/i.test(
          input.unit,
        )
      ) {
        throw new BadRequestException('Unsupported cost unit');
      }
    } else if (
      input.costCategory ||
      input.costBasis ||
      input.costMicros !== undefined ||
      input.currency
    ) {
      throw new BadRequestException('Cost fields are only allowed for cost events');
    }
    if (FEATURE_COUNT_KINDS.has(input.kind) && input.value !== undefined && input.value < 0) {
      throw new BadRequestException('Feature event value cannot be negative');
    }
  }

  private normalizeDays(days: number): number {
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new BadRequestException('days must be an integer between 1 and 90');
    }
    return days;
  }

  private csvCell(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
