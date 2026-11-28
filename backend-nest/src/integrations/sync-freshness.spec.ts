import { IntegrationService } from './integration.service';

jest.mock('../jobs/jobs.service', () => ({ JobsService: class JobsService {} }));

describe('sync freshness', () => {
  it('reports stale feeds and workspace scoped queue metrics without credentials', async () => {
    const now = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const prisma = {
      integration: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'fixture-feed-a', provider: 'GITHUB', connectionState: 'CONNECTED', lastSyncedAt: now, lastValidDataAt: now, lastSyncError: null },
        ]),
      },
    };
    const jobsService = {
      getDataSyncMetrics: jest.fn().mockResolvedValue({ queueDepth: 1, active: 0, failed: 0, retries: 2, oldestQueuedAt: now.toISOString(), asOf: new Date().toISOString() }),
    };
    const service = Object.create(IntegrationService.prototype) as IntegrationService;
    Object.assign(service, { prisma, jobsService });

    const result = await service.getSyncFreshness('workspace-fixture');
    expect(result.integrations[0].health).toBe('STALE');
    expect(result.integrations[0].lastUpdatedAt).toEqual(now);
    expect(result.queue.retries).toBe(2);
    expect(JSON.stringify(result)).not.toContain('accessToken');
    expect(prisma.integration.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: 'workspace-fixture' } }));
  });

  it('does not enqueue or contact providers for dry runs', async () => {
    const integration = { id: 'feed-a', provider: 'GITHUB', syncCursor: { watermark: 'opaque-fixture-cursor' }, settings: {}, workspaceId: 'workspace-a' };
    const prisma = { integration: { findUnique: jest.fn().mockResolvedValue(integration) } };
    const jobsService = { queueDataSync: jest.fn() };
    const service = Object.create(IntegrationService.prototype) as IntegrationService;
    Object.assign(service, { prisma, jobsService });

    await expect(service.triggerSync('feed-a', 'incremental', true)).resolves.toMatchObject({ queued: false, dryRun: true, cursorAvailable: true });
    expect(jobsService.queueDataSync).not.toHaveBeenCalled();
  });
});
