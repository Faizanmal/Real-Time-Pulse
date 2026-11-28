import { JobsService } from './jobs.service';

jest.mock('@nestjs/bull', () => ({ InjectQueue: () => () => undefined }));

describe('JobsService sync metrics', () => {
  it('scopes queue depth, age, and retries to the requested workspace', async () => {
    const timestamp = Date.now() - 60_000;
    const job = (workspaceId: string, extra: Record<string, unknown> = {}) => ({
      data: { workspaceId }, timestamp, attemptsMade: 3, ...extra,
    });
    const queue = {
      getJobs: jest.fn(async (states: string[]) => states[0] === 'waiting'
        ? [job('workspace-a'), job('workspace-b')]
        : states[0] === 'failed' ? [job('workspace-a')] : []),
    };
    const service = new JobsService(null as any, null as any, queue as any, null as any);

    const metrics = await service.getDataSyncMetrics('workspace-a');
    expect(metrics.queueDepth).toBe(1);
    expect(metrics.retries).toBe(4);
    expect(metrics.oldestQueuedAt).toBe(new Date(timestamp).toISOString());
    expect(metrics.queueByState.waiting).toBe(1);
  });

  it('deduplicates a repeated request ID and configures bounded worker retries', async () => {
    const queued = { id: 'sync-fixture-job', data: { integrationId: 'connector-a', workspaceId: 'workspace-a' } };
    const queue = {
      getJobs: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([queued]),
      add: jest.fn().mockResolvedValue(queued),
    };
    const service = new JobsService(null as any, null as any, queue as any, null as any);
    const request = { workspaceId: 'workspace-a', integrationId: 'connector-a', syncType: 'full' as const, requestId: 'request-fixture-uuid' };
    await service.queueDataSync(request);
    const duplicate = await service.queueDataSync(request);
    expect(duplicate).toBe(queued);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith('sync-data', request, expect.objectContaining({
      attempts: 3,
      jobId: 'sync-connector-a-request-fixture-uuid',
      backoff: { type: 'exponential', delay: 1000 },
    }));
  });
});
