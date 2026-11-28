import { PrismaPg } from '@prisma/adapter-pg';
import { ConsentType, PrismaClient, ProductTelemetryKind } from '@prisma/client';
import { Pool } from 'pg';

import { PrismaService } from '../prisma/prisma.service';

import { ProductAnalyticsService } from './product-analytics.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const approvedTestDatabase = Boolean(
  parsedUrl &&
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname) &&
  parsedUrl.pathname.replace(/^\//, '') === 'pulse_test',
);
const suite =
  process.env.RUN_DB_INTEGRATION === 'true' && approvedTestDatabase ? describe : describe.skip;

suite('product analytics database contract', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const service = new ProductAnalyticsService(prisma as unknown as PrismaService);
  const tenantA = '00000000-0000-4000-8000-000000000001';
  const tenantB = '00000000-0000-4000-8000-000000000002';
  const eventIds = [
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000104',
  ];
  const consentPurpose = 'Phase 23 synthetic product analytics fixture';

  beforeAll(async () => {
    await prisma.productTelemetryEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.gDPRConsent.deleteMany({
      where: { purpose: consentPurpose, workspaceId: tenantA },
    });
    await prisma.gDPRConsent.create({
      data: {
        workspaceId: tenantA,
        userId: '00000000-0000-4000-8000-000000000011',
        subjectEmail: 'owner@northstar.invalid',
        consentType: ConsentType.ANALYTICS,
        purpose: consentPurpose,
        consented: true,
        consentedAt: new Date(),
      },
    });
    await prisma.gDPRConsent.deleteMany({
      where: { purpose: consentPurpose, workspaceId: tenantB },
    });
    await prisma.gDPRConsent.create({
      data: {
        workspaceId: tenantB,
        userId: '00000000-0000-4000-8000-000000000021',
        subjectEmail: 'owner@juniper.invalid',
        consentType: ConsentType.ANALYTICS,
        purpose: consentPurpose,
        consented: true,
        consentedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.productTelemetryEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.gDPRConsent.deleteMany({
      where: { purpose: consentPurpose, workspaceId: tenantA },
    });
    await prisma.gDPRConsent.deleteMany({
      where: { purpose: consentPurpose, workspaceId: tenantB },
    });
    await prisma.$disconnect();
    await pool.end();
  });

  it('deduplicates retried deliveries and keeps dashboard/export results tenant scoped', async () => {
    const cost = {
      eventId: eventIds[0],
      featureKey: 'portal_builder',
      kind: ProductTelemetryKind.COST,
      eventName: 'job.runtime',
      value: 2,
      unit: 'seconds',
      costCategory: 'JOB_RUNTIME' as const,
      costBasis: 'OBSERVED' as const,
      costMicros: 5000,
      currency: 'USD',
    };
    await expect(service.record(tenantA, cost)).resolves.toEqual({
      accepted: true,
      duplicate: false,
    });
    await expect(service.record(tenantA, cost)).resolves.toEqual({
      accepted: false,
      duplicate: true,
    });
    await service.record(tenantB, {
      eventId: eventIds[1],
      featureKey: 'alerts',
      kind: ProductTelemetryKind.FEATURE_SUCCESS,
      eventName: 'alert_resolved',
    });
    await service.record(tenantA, {
      eventId: eventIds[2],
      featureKey: 'decision_inbox',
      kind: ProductTelemetryKind.EXPERIMENT,
      eventName: 'approval_rate',
      value: 0.5,
      experimentKey: 'approval-copy',
      variantKey: 'short',
    });
    await service.record(tenantA, {
      eventId: eventIds[3],
      featureKey: 'decision_inbox',
      kind: ProductTelemetryKind.EXPERIMENT,
      eventName: 'approval_rate',
      value: 1,
      experimentKey: 'approval-copy',
      variantKey: 'short',
    });

    const a = await service.summary(tenantA);
    const b = await service.summary(tenantB);
    expect(a.features.find((feature) => feature.featureKey === 'portal_builder')?.costs).toEqual([
      { category: 'JOB_RUNTIME', basis: 'OBSERVED', currency: 'USD', amount: 0.005 },
    ]);
    expect(a.experiments).toEqual([
      expect.objectContaining({
        experimentKey: 'approval-copy',
        variantKey: 'short',
        metric: 'approval_rate',
        samples: 2,
        mean: 0.75,
      }),
    ]);
    expect(a.features.some((feature) => feature.featureKey === 'alerts')).toBe(false);
    expect(b.features).toEqual([
      expect.objectContaining({ featureKey: 'alerts', successEvents: 1 }),
    ]);
    expect(await service.exportExperimentsCsv(tenantB)).toContain('"experiment","variant"');
    expect(await service.exportExperimentsCsv(tenantB)).not.toContain('approval-copy');
  });
});
