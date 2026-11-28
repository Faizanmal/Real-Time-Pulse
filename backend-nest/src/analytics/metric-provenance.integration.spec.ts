import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { MetricProvenanceService } from './metric-provenance.service';
import { PrismaService } from '../prisma/prisma.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const approvedTestDatabase = Boolean(
  parsedUrl &&
    ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname) &&
    parsedUrl.pathname.replace(/^\//, '') === 'pulse_test',
);
const suite = process.env.RUN_DB_INTEGRATION === 'true' && approvedTestDatabase ? describe : describe.skip;

suite('metric provenance database contract', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const service = new MetricProvenanceService(prisma as unknown as PrismaService);
  const workspaceId = '00000000-0000-4000-8000-000000000001';
  const portalId = '00000000-0000-4000-8000-000000000032';
  const secondClientPortalId = '00000000-0000-4000-8000-000000000033';
  const integrationId = '00000000-0000-4000-8000-000000000043';

  beforeAll(async () => {
    await prisma.metricMapping.deleteMany({ where: { portalId } });
  });

  afterAll(async () => {
    await prisma.metricMapping.deleteMany({ where: { portalId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('materializes idempotent snapshots, audits replay and gates client source drilldown', async () => {
    const definitions = await service.listCatalog(workspaceId);
    const openIssues = definitions.find(({ key }) => key === 'github.issue_open');
    expect(openIssues).toBeDefined();
    const mapping = await service.createMapping(workspaceId, {
      portalId,
      integrationId,
      metricDefinitionId: openIssues!.id,
      displayName: 'Current open issues',
      clientVisible: true,
    });

    await service.recordGitHubSync(workspaceId, integrationId);
    await service.recordGitHubSync(workspaceId, integrationId);

    const [sourceCount, normalizedCount, snapshots] = await Promise.all([
      prisma.metricSourceObservation.count({ where: { integrationId } }),
      prisma.metricNormalizedObservation.count({ where: { workspaceId, metricDefinitionId: openIssues!.id } }),
      prisma.metricSnapshot.findMany({ where: { mappingId: mapping.id } }),
    ]);
    expect(sourceCount).toBe(3);
    expect(normalizedCount).toBe(3);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].value?.toString()).toBe('2');
    expect(snapshots[0].quality).toBe('VALID');

    const publicMetric = (await service.publicMetrics(portalId))[0];
    expect(publicMetric.value).toBe('2');
    expect(publicMetric.timeRange).toMatchObject({ timeZone: 'UTC' });
    expect(publicMetric.sources).toBeUndefined();
    // Both fictional client portals share one workspace GitHub account; portal B cannot see portal A's mapping.
    expect(await service.publicMetrics(secondClientPortalId)).toEqual([]);

    await prisma.metricMapping.update({ where: { id: mapping.id }, data: { allowSourceDrilldown: true } });
    expect((await service.publicMetrics(portalId))[0].sources).toHaveLength(3);

    const milestone = await service.createMilestone(workspaceId, mapping.id, {
      name: 'Keep the queue manageable',
      targetValue: 2,
      targetDate: '2026-12-15T00:00:00.000Z',
    });
    expect(milestone.mappingId).toBe(mapping.id);

    const repair = await service.reprocess(workspaceId, '00000000-0000-4000-8000-000000000011', mapping.id, 'Replay fictional source fixture');
    expect(repair.status).toBe('COMPLETED');
    expect(repair.reason).toBe('Replay fictional source fixture');
    expect(await prisma.metricSnapshot.count({ where: { mappingId: mapping.id } })).toBe(1);
    expect(await prisma.metricReprocessRun.count({ where: { mappingId: mapping.id } })).toBe(1);
  });

  it('rejects a portal ID owned by another fixture tenant despite the shared service', async () => {
    const definitions = await service.listCatalog(workspaceId);
    const openIssues = definitions.find(({ key }) => key === 'github.issue_open')!;
    await expect(service.createMapping(workspaceId, {
      portalId: '00000000-0000-4000-8000-000000000031',
      integrationId,
      metricDefinitionId: openIssues.id,
      displayName: 'Cross-tenant attempt',
    })).rejects.toThrow('unavailable in this workspace');
  });
});
