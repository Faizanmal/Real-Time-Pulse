import { Process, Processor } from '@nestjs/bull';
import { Logger, Optional } from '@nestjs/common';
import { OnboardingFunnelStage } from '@prisma/client';
import type { Job } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';

import { classifyConnectorFailure, revealIntegrationTokens } from '../../integrations/connector-security.util';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastService } from '../../realtime/broadcast.service';
import type { DataSyncJobData } from '../jobs.service';
import { SyncProviderService } from '../sync-provider.service';
import { QUEUE_NAMES } from '../queue.constants';
import { MetricProvenanceService } from '../../analytics/metric-provenance.service';
import { AlertsService } from '../../alerts/alerts.service';
import { OnboardingFunnelService } from '../../analytics/onboarding-funnel.service';

export function hashProviderSchema(record: Record<string, any>) {
  const descriptor = Object.keys(record)
    .sort()
    .map((key) => {
      const value = record[key];
      const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      return `${key}:${valueType}`;
    })
    .join('|');
  return createHash('sha256').update(descriptor).digest('hex');
}

function toStoredIssue(record: Record<string, any>) {
  const updatedAt = typeof record.updated_at === 'string' ? record.updated_at : null;
  if (updatedAt && Number.isNaN(Date.parse(updatedAt))) throw new Error('Provider record has an invalid update timestamp');
  return {
    id: String(record.id),
    state: typeof record.state === 'string' ? record.state : null,
    createdAt: typeof record.created_at === 'string' ? record.created_at : null,
    updatedAt,
    closedAt: typeof record.closed_at === 'string' ? record.closed_at : null,
    comments: typeof record.comments === 'number' ? record.comments : null,
    isPullRequest: Boolean(record.pull_request),
    labelNames: Array.isArray(record.labels)
      ? record.labels.flatMap((label: any) => typeof label?.name === 'string' ? [label.name] : [])
      : [],
    _sourceSchemaHash: hashProviderSchema(record),
  };
}

@Processor(QUEUE_NAMES.DATA_SYNC)
export class DataSyncQueueProcessor {
  private readonly logger = new Logger(DataSyncQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: BroadcastService,
    private readonly syncProviderService: SyncProviderService,
    private readonly metricProvenanceService: MetricProvenanceService,
    private readonly alertsService: AlertsService,
    private readonly encryptionService: EncryptionService,
    @Optional() private readonly onboardingFunnel?: OnboardingFunnelService,
  ) {}

  @Process('sync-data')
  async handleDataSync(job: Job<DataSyncJobData>) {
    this.logger.log(`Processing data sync job ${job.id} for workspace ${job.data.workspaceId}`);
    const runKey = String(job.id ?? `${job.data.integrationId}:${job.timestamp}`);
    let leaseToken: string | undefined;

    try {
      const { integrationId } = job.data;

      // Get integration details
      const storedIntegration = await this.prisma.integration.findFirst({
        where: { id: integrationId, workspaceId: job.data.workspaceId },
      });

      if (!storedIntegration) {
        throw new Error(`Integration not found: ${integrationId}`);
      }
      const integration = revealIntegrationTokens(this.encryptionService, storedIntegration);

      if (integration.provider !== 'GITHUB') {
        throw Object.assign(new Error(`Sync is not configured for ${integration.provider}`), { code: 'sync_not_configured' });
      }

      const settings = integration.settings as Record<string, any>;
      const syncSettings = settings?.sync as { owner?: string; repo?: string; perPage?: number } | undefined;
      if (Boolean(syncSettings?.owner) !== Boolean(syncSettings?.repo)) {
        throw Object.assign(new Error('GitHub issue sync requires both owner and repo when repository-scoped'), { code: 'sync_configuration_missing' });
      }
      const perPage = Math.min(100, Math.max(1, Math.floor(syncSettings.perPage ?? 100)));
      const unique = { integrationId_idempotencyKey: { integrationId: integration.id, idempotencyKey: runKey } };
      const existingRun = await this.prisma.syncRun.findUnique({ where: unique });
      if (existingRun?.status === 'COMPLETED') {
        this.logger.log(`Sync run ${runKey} already completed; duplicate delivery ignored`);
        try {
          await this.onboardingFunnel?.recordStage(job.data.workspaceId, OnboardingFunnelStage.FIRST_VALID_SYNC);
        } catch {
          this.logger.warn('Onboarding funnel event could not be reconciled for a completed sync');
        }
        return { duplicate: true, processedCount: existingRun.processedCount };
      }
      const run = await this.prisma.syncRun.upsert({
        where: unique,
        create: { integrationId: integration.id, idempotencyKey: runKey },
        update: {},
      });
      leaseToken = randomUUID();
      const lease = await this.prisma.syncRun.updateMany({
        where: {
          id: run.id,
          status: { not: 'COMPLETED' },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
        },
        data: { status: 'RUNNING', lastErrorCode: null, leaseToken, leaseExpiresAt: new Date(Date.now() + 60_000) },
      });
      if (lease.count !== 1) {
        leaseToken = undefined;
        throw Object.assign(new Error('Another worker currently owns this sync run'), { code: 'sync_lock_held' });
      }

      const storedCursor = integration.syncCursor as { runKey?: string; syncType?: string; page?: number; watermark?: string; complete?: boolean } | null;
      const resume = storedCursor?.runKey === runKey;
      let page = resume ? Math.max(1, storedCursor?.page ?? 1) : 1;
      let alreadyFetchedAllPages = resume && storedCursor?.complete === true;
      let watermark = resume
        ? storedCursor?.watermark
        : job.data.syncType === 'incremental' && typeof storedCursor?.watermark === 'string'
          ? storedCursor.watermark
          : undefined;
      let processedCount = run.processedCount;
      let pageCount = run.pageCount;
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { syncCursor: { runKey, syncType: job.data.syncType, page, watermark: watermark ?? null, provider: 'GITHUB', ...(alreadyFetchedAllPages ? { complete: true } : {}) } },
      });

      while (!alreadyFetchedAllPages) {
        const overlapSince = watermark && job.data.syncType === 'incremental'
          ? new Date(Math.max(0, Date.parse(watermark) - 1)).toISOString()
          : undefined;
        const result = await this.syncProviderService.fetchGitHubIssues(integration, {
          owner: syncSettings?.owner,
          repo: syncSettings?.repo,
          page,
          since: overlapSince,
          perPage,
        });
        const nextWatermark = result.records.reduce((latest, record) => {
          const value = typeof record.updated_at === 'string' ? record.updated_at : null;
          if (value && Number.isNaN(Date.parse(value))) throw new Error('Provider record has an invalid update timestamp');
          return value && (!latest || Date.parse(value) > Date.parse(latest)) ? value : latest;
        }, watermark);
        if (result.nextPage !== null && (!Number.isInteger(result.nextPage) || result.nextPage <= page)) {
          throw new Error('Provider pagination cursor did not advance');
        }
        await this.prisma.$transaction(async (tx: any) => {
          for (const record of result.records) {
            await tx.syncRecord.upsert({
              where: { integrationId_externalId: { integrationId: integration.id, externalId: String(record.id) } },
              create: {
                integrationId: integration.id,
                externalId: String(record.id),
                payload: toStoredIssue(record),
                sourceUpdatedAt: typeof record.updated_at === 'string' ? new Date(record.updated_at) : null,
              },
              update: {
                payload: toStoredIssue(record),
                sourceUpdatedAt: typeof record.updated_at === 'string' ? new Date(record.updated_at) : null,
              },
            });
          }
          processedCount += result.records.length;
          pageCount += 1;
          await tx.integration.update({
            where: { id: integration.id },
            data: { syncCursor: { runKey, syncType: job.data.syncType, page: result.nextPage ?? 1, watermark: nextWatermark ?? null, provider: 'GITHUB', complete: result.nextPage === null } },
          });
          await tx.syncRun.update({ where: { id: run.id }, data: { processedCount, pageCount } });
          const leaseRenewed = await tx.syncRun.updateMany({
            where: { id: run.id, leaseToken },
            data: { leaseExpiresAt: new Date(Date.now() + 60_000) },
          });
          if (leaseRenewed.count !== 1) throw new Error('Sync run lease was lost');
        });
        watermark = nextWatermark;
        await job.updateProgress({ page: pageCount, processed: processedCount });
        if (result.nextPage === null) {
          alreadyFetchedAllPages = true;
          break;
        }
        page = result.nextPage;
      }

      const completedAt = new Date();
      await this.metricProvenanceService.recordGitHubSync(job.data.workspaceId, integration.id);
      await this.prisma.$transaction([
        this.prisma.syncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt, lastErrorCode: null, leaseToken: null, leaseExpiresAt: null } }),
        this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            lastSyncedAt: completedAt,
            lastValidDataAt: completedAt,
            connectionState: 'CONNECTED',
            lastSyncError: null,
            syncCursor: { provider: 'GITHUB', page: 1, watermark: watermark ?? null },
          },
        }),
      ]);
      try {
        await this.onboardingFunnel?.recordStage(job.data.workspaceId, OnboardingFunnelStage.FIRST_VALID_SYNC);
      } catch {
        this.logger.warn('Onboarding funnel event could not be recorded for a successful sync');
      }
      try {
        await this.alertsService.recordSyncSignal({
          workspaceId: job.data.workspaceId,
          integrationId: integration.id,
          provider: integration.provider,
          eventId: `${runKey}:recovered`,
          failed: false,
          freshnessAt: completedAt,
          observedAt: completedAt,
        });
      } catch (alertError) {
        this.logger.error(`Could not record sync recovery alert signal: ${(alertError as Error).message}`);
      }
      this.broadcastService.integrationSynced?.(job.data.workspaceId, { id: integration.id, lastSyncedAt: completedAt, metricsUpdated: true });
      return { processedCount, pageCount, lastSyncedAt: completedAt };
    } catch (error) {
      if ((error as { code?: string })?.code === 'sync_lock_held') throw error;
      const failure = classifyConnectorFailure(error);
      await this.prisma.syncRun.updateMany({
        where: { integrationId: job.data.integrationId, idempotencyKey: runKey, ...(leaseToken ? { leaseToken } : {}) },
        data: { status: 'PARTIAL_FAILED', lastErrorCode: failure.code, leaseToken: null, leaseExpiresAt: null },
      });
      await this.prisma.integration.updateMany({
        where: { id: job.data.integrationId, workspaceId: job.data.workspaceId },
        data: { connectionState: failure.state, lastSyncError: failure.code },
      });
      try {
        const failedIntegration = await this.prisma.integration.findFirst({
          where: { id: job.data.integrationId, workspaceId: job.data.workspaceId },
          select: { provider: true, lastValidDataAt: true },
        });
        if (failedIntegration) {
          await this.alertsService.recordSyncSignal({
            workspaceId: job.data.workspaceId,
            integrationId: job.data.integrationId,
            provider: failedIntegration.provider,
            eventId: `${runKey}:failed`,
            failed: true,
            failureCode: failure.code,
            freshnessAt: failedIntegration.lastValidDataAt,
          });
        }
      } catch (alertError) {
        this.logger.error(`Could not record sync failure alert signal: ${(alertError as Error).message}`);
      }
      const totalAttempts = Number(job.opts?.attempts ?? 1);
      if ((job.attemptsMade ?? 0) + 1 >= totalAttempts) {
        this.broadcastService.integrationError(
          job.data.workspaceId,
          { id: job.data.integrationId, connectionState: failure.state },
          failure.message,
        );
      }
      this.logger.warn(`Data sync job ${job.id} failed (${failure.code}); previous valid data timestamp preserved`);
      throw new Error(failure.message);
    }
  }

}
