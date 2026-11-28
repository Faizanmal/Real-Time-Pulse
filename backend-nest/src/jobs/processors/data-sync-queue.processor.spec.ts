import { DataSyncQueueProcessor, hashProviderSchema } from './data-sync-queue.processor';

jest.mock('@nestjs/bull', () => ({
  Process: () => () => undefined,
  Processor: () => () => undefined,
}));
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

describe('DataSyncQueueProcessor checkpoint safety', () => {
  it('fingerprints provider field names and types without retaining provider values', () => {
    const stable = hashProviderSchema({ id: 101, state: 'open' });
    expect(hashProviderSchema({ id: 102, state: 'closed' })).toBe(stable);
    expect(hashProviderSchema({ id: 102, state: 1 })).not.toBe(stable);
    expect(stable).not.toContain('open');
  });

  const fixtureIntegration = () => ({
    id: 'connector-fixture-a',
    workspaceId: 'workspace-fixture-a',
    provider: 'GITHUB',
    accessToken: 'fixture-secret-must-not-leak',
    settings: { sync: { owner: 'fictional-org', repo: 'fictional-repo', perPage: 2 } },
    syncCursor: null as any,
    lastValidDataAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const makeHarness = (options: { integration?: any; pages?: any[]; completedRun?: any } = {}) => {
    const integration = options.integration === undefined ? fixtureIntegration() : options.integration;
    const run = options.completedRun ?? { id: 'run-fixture-a', status: 'RUNNING', processedCount: 0, pageCount: 0 };
    const savedRecords = new Map<string, unknown>();
    const prisma: any = {
      integration: {
        findFirst: jest.fn().mockResolvedValue(integration),
        update: jest.fn(async ({ data }: any) => { Object.assign(integration, data); return integration; }),
        updateMany: jest.fn(async ({ data }: any) => { Object.assign(integration, data); return { count: 1 }; }),
      },
      syncRun: {
        findUnique: jest.fn(async () => run.status === 'COMPLETED' ? run : null),
        upsert: jest.fn().mockResolvedValue(run),
        update: jest.fn(async ({ data }: any) => { Object.assign(run, data); return run; }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.leaseToken && run.leaseToken !== where.leaseToken) return { count: 0 };
          Object.assign(run, data);
          return { count: 1 };
        }),
      },
      $transaction: jest.fn(async (operation: any) => {
        if (typeof operation !== 'function') return Promise.all(operation);
        const tx = {
          integration: prisma.integration,
          syncRun: prisma.syncRun,
          syncRecord: {
            upsert: jest.fn(async ({ where, create, update }: any) => {
              const key = where.integrationId_externalId.externalId;
              savedRecords.set(key, savedRecords.has(key) ? update : create);
              return savedRecords.get(key);
            }),
          },
        };
        return operation(tx);
      }),
    };
    const pages = [...(options.pages ?? [])];
    const syncProviderService = { fetchGitHubIssues: jest.fn(async (..._args: any[]) => {
      const next = pages.shift();
      if (next instanceof Error) throw next;
      if (!next) throw new Error('No fixture page available');
      return next;
    }) };
    const broadcastService = { integrationError: jest.fn(), integrationSynced: jest.fn() };
    const metricProvenanceService = { recordGitHubSync: jest.fn().mockResolvedValue(undefined) };
    const alertsService = { recordSyncSignal: jest.fn().mockResolvedValue(undefined) };
    const onboardingFunnel = { recordStage: jest.fn().mockResolvedValue({ recorded: true }) };
    const processor = Object.create(DataSyncQueueProcessor.prototype) as DataSyncQueueProcessor;
    Object.assign(processor, { prisma, syncProviderService, broadcastService, metricProvenanceService, alertsService, onboardingFunnel, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    const job: any = {
      id: 'delivery-fixture-1',
      timestamp: Date.now(),
      opts: { attempts: 3 },
      attemptsMade: 0,
      data: { integrationId: 'connector-fixture-a', workspaceId: 'workspace-fixture-a', syncType: 'incremental' },
      updateProgress: jest.fn(),
    };
    return { processor, prisma, syncProviderService, broadcastService, metricProvenanceService, alertsService, onboardingFunnel, job, integration, run, savedRecords };
  };

  it('commits page records and cursor atomically, resumes after partial failure, and does not duplicate records', async () => {
    const oldValidAt = new Date('2026-01-01T00:00:00.000Z');
    const { processor, prisma, syncProviderService, broadcastService, metricProvenanceService, alertsService, onboardingFunnel, job, integration, savedRecords, run } = makeHarness({
      pages: [
        { records: [{ id: 101, updated_at: '2026-02-01T00:00:00Z', body: 'private issue text', user: { email: 'fictional@example.test' } }, { id: 102, updated_at: '2026-02-02T00:00:00Z' }], nextPage: 2 },
        Object.assign(new Error('fixture provider temporarily unavailable'), { response: { status: 503 } }),
      ],
    });

    await expect(processor.handleDataSync(job)).rejects.toThrow();
    expect(integration.syncCursor).toMatchObject({ page: 2, watermark: '2026-02-02T00:00:00Z', runKey: job.id });
    expect(savedRecords.size).toBe(2);
    expect(JSON.stringify([...savedRecords.values()])).not.toContain('private issue text');
    expect(JSON.stringify([...savedRecords.values()])).not.toContain('fictional@example.test');
    expect(integration.lastValidDataAt).toEqual(oldValidAt);
    expect(run.status).toBe('PARTIAL_FAILED');
    expect(alertsService.recordSyncSignal).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: job.data.workspaceId,
      integrationId: integration.id,
      eventId: `${job.id}:failed`,
      failed: true,
      freshnessAt: oldValidAt,
    }));
    expect(broadcastService.integrationError).not.toHaveBeenCalled();

    syncProviderService.fetchGitHubIssues.mockImplementationOnce(async () => ({
      records: [{ id: 103, updated_at: '2026-02-03T00:00:00Z' }], nextPage: null,
    }));
    const restartedBroadcastService = { integrationError: jest.fn(), integrationSynced: jest.fn() };
    const restartedWorker = Object.create(DataSyncQueueProcessor.prototype) as DataSyncQueueProcessor;
    Object.assign(restartedWorker, {
      prisma,
      syncProviderService,
      broadcastService: restartedBroadcastService,
      metricProvenanceService,
      alertsService,
      onboardingFunnel,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
    await restartedWorker.handleDataSync(job);
    expect(syncProviderService.fetchGitHubIssues).toHaveBeenCalledTimes(3);
    expect((syncProviderService.fetchGitHubIssues.mock.calls.at(-1) as any)?.[1]).toMatchObject({ page: 2, since: '2026-02-01T23:59:59.999Z' });
    expect(savedRecords.size).toBe(3);
    expect(run.status).toBe('COMPLETED');
    expect(restartedBroadcastService.integrationSynced).toHaveBeenCalledTimes(1);
    expect(restartedBroadcastService.integrationSynced.mock.calls[0][1]).toMatchObject({ id: integration.id, metricsUpdated: true });
    expect(metricProvenanceService.recordGitHubSync).toHaveBeenCalledTimes(1);
    expect(integration.lastValidDataAt).not.toEqual(oldValidAt);
    expect(alertsService.recordSyncSignal).toHaveBeenCalledWith(expect.objectContaining({
      eventId: `${job.id}:recovered`, failed: false,
    }));
    expect(onboardingFunnel.recordStage).toHaveBeenCalledWith(job.data.workspaceId, 'FIRST_VALID_SYNC');
    expect(JSON.stringify(prisma)).not.toContain('fixture-secret-must-not-leak');

    await expect(processor.handleDataSync(job)).resolves.toMatchObject({ duplicate: true, processedCount: 3 });
    expect(syncProviderService.fetchGitHubIssues).toHaveBeenCalledTimes(3);
    expect(alertsService.recordSyncSignal).toHaveBeenCalledTimes(2);
    expect(onboardingFunnel.recordStage).toHaveBeenCalledTimes(2);
  });

  it('refuses cross-workspace job identifiers without fetching provider data', async () => {
    const { processor, prisma, syncProviderService, job } = makeHarness({ integration: null });
    await expect(processor.handleDataSync(job)).rejects.toThrow();
    expect(prisma.integration.findFirst).toHaveBeenCalledWith({ where: { id: job.data.integrationId, workspaceId: job.data.workspaceId } });
    expect(syncProviderService.fetchGitHubIssues).not.toHaveBeenCalled();
  });

  it('starts a full backfill at page one and does not send the incremental since cursor', async () => {
    const integration = fixtureIntegration();
    integration.syncCursor = { provider: 'GITHUB', page: 8, watermark: '2026-02-01T00:00:00Z' };
    const { processor, syncProviderService, job, savedRecords } = makeHarness({
      integration,
      pages: [
        { records: [{ id: 201, updated_at: '2025-10-01T00:00:00Z' }], nextPage: 2 },
        { records: [{ id: 202, updated_at: '2025-10-02T00:00:00Z' }], nextPage: null },
      ],
    });
    job.data.syncType = 'full';
    await expect(processor.handleDataSync(job)).resolves.toMatchObject({ processedCount: 2, pageCount: 2 });
    expect((syncProviderService.fetchGitHubIssues.mock.calls[0] as any)[1]).toMatchObject({ page: 1 });
    expect((syncProviderService.fetchGitHubIssues.mock.calls[0] as any)[1].since).toBeUndefined();
    expect(savedRecords.size).toBe(2);
  });

  it('finalizes a page-complete run after a worker restart without fetching or counting the page twice', async () => {
    const integration = fixtureIntegration();
    integration.syncCursor = { provider: 'GITHUB', runKey: 'delivery-fixture-1', syncType: 'incremental', page: 1, watermark: '2026-02-03T00:00:00Z', complete: true };
    const run = { id: 'run-fixture-a', status: 'PARTIAL_FAILED', processedCount: 3, pageCount: 2 };
    const { processor, syncProviderService, job } = makeHarness({ integration, completedRun: run });
    await expect(processor.handleDataSync(job)).resolves.toMatchObject({ processedCount: 3, pageCount: 2 });
    expect(syncProviderService.fetchGitHubIssues).not.toHaveBeenCalled();
    expect(run.status).toBe('COMPLETED');
  });

  it('does not steal an unexpired lease from a concurrently running worker', async () => {
    const { processor, prisma, syncProviderService, job, run } = makeHarness();
    prisma.syncRun.updateMany.mockImplementationOnce(async ({ data }: any) => {
      run.leaseToken = 'another-worker-token';
      return { count: 0 };
    });
    await expect(processor.handleDataSync(job)).rejects.toThrow('Another worker currently owns this sync run');
    expect(syncProviderService.fetchGitHubIssues).not.toHaveBeenCalled();
    expect(prisma.integration.updateMany).not.toHaveBeenCalled();
  });
});
