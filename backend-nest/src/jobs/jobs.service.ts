import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type * as Bull from 'bullmq';

import { QUEUE_NAMES } from './queue.constants';

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, any>;
  html?: string;
}

export interface ReportJobData {
  workspaceId: string;
  portalId?: string;
  reportType: 'analytics' | 'audit' | 'performance';
  format: 'pdf' | 'csv' | 'excel';
  startDate?: Date;
  endDate?: Date;
  recipientEmail: string;
}

export interface DataSyncJobData {
  workspaceId: string;
  integrationId: string;
  syncType: 'full' | 'incremental';
  requestId?: string;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Bull.Queue,
    @InjectQueue(QUEUE_NAMES.REPORT) private reportQueue: Bull.Queue,
    @InjectQueue(QUEUE_NAMES.DATA_SYNC) private dataSyncQueue: Bull.Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private analyticsQueue: Bull.Queue,
  ) {}

  /**
   * Add email to queue
   */
  async queueEmail(data: EmailJobData, options?: { delay?: number; priority?: number }) {
    try {
      const job = await this.emailQueue.add('send-email', data, {
        delay: options?.delay || 0,
        priority: options?.priority || 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Email job queued: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to queue email job', error);
      throw error;
    }
  }

  /**
   * Add report generation to queue
   */
  async queueReport(data: ReportJobData) {
    try {
      const job = await this.reportQueue.add('generate-report', data, {
        attempts: 2,
      });

      this.logger.log(`Report job queued: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to queue report job', error);
      throw error;
    }
  }

  /**
   * Add data sync to queue
   */
  async queueDataSync(data: DataSyncJobData) {
    try {
      // Prevent duplicate sync jobs for the same integration
      const existingJobs = await this.dataSyncQueue.getJobs(['waiting', 'active']);

      const duplicate = existingJobs.find(
        (job: any) => (job.data as { integrationId: string }).integrationId === data.integrationId,
      );

      if (duplicate) {
        this.logger.warn(`Data sync job already exists for integration: ${data.integrationId}`);
        return duplicate;
      }

      const job = await this.dataSyncQueue.add('sync-data', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        ...(data.requestId ? { jobId: `sync-${data.integrationId}-${data.requestId}` } : {}),
      });

      this.logger.log(`Data sync job queued: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to queue data sync job', error);
      throw error;
    }
  }

  /**
   * Add analytics aggregation to queue (scheduled job)
   */
  async queueAnalyticsAggregation(workspaceId: string) {
    try {
      const job = await this.analyticsQueue.add(
        'aggregate-analytics',
        { workspaceId },
        {
          repeat: {
            pattern: '0 * * * *', // Every hour
          },
        },
      );

      this.logger.log(`Analytics aggregation job queued: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to queue analytics aggregation job', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string, queueName: keyof typeof QUEUE_NAMES) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,

      failedReason: job.failedReason,
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, queueName: keyof typeof QUEUE_NAMES) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Job cancelled: ${jobId}`);
      return true;
    }

    return false;
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: keyof typeof QUEUE_NAMES) {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /** Workspace-scoped operational view for integration freshness. Job payloads are never returned. */
  async getDataSyncMetrics(workspaceId: string) {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      this.dataSyncQueue.getJobs(['waiting'], 0, 499),
      this.dataSyncQueue.getJobs(['active'], 0, 499),
      this.dataSyncQueue.getJobs(['delayed'], 0, 499),
      this.dataSyncQueue.getJobs(['failed'], 0, 499),
      this.dataSyncQueue.getJobs(['completed'], 0, 499),
    ]);
    const scope = (items: any[]) => items.filter((job) => job.data?.workspaceId === workspaceId);
    const waitingJobs = scope(waiting);
    const delayedJobs = scope(delayed);
    const activeJobs = scope(active);
    const failedJobs = scope(failed);
    const completedJobs = scope(completed);
    const scoped = [...waitingJobs, ...delayedJobs, ...activeJobs, ...failedJobs, ...completedJobs];
    const queued = [...waitingJobs, ...delayedJobs];
    const oldestQueuedAt = queued.reduce(
      (oldest: number | null, job: any) => Math.min(oldest ?? Infinity, job.timestamp ?? Date.now()),
      null as number | null,
    );
    return {
      queueDepth: queued.length,
      active: activeJobs.length,
      failed: failedJobs.length,
      retries: scoped.reduce((total: number, job: any) => total + Math.max(0, (job.attemptsMade ?? 0) - 1), 0),
      oldestQueuedAt: oldestQueuedAt === null ? null : new Date(oldestQueuedAt).toISOString(),
      oldestQueuedAgeMs: oldestQueuedAt === null ? null : Math.max(0, Date.now() - oldestQueuedAt),
      queueByState: {
        waiting: waitingJobs.length,
        delayed: delayedJobs.length,
        active: activeJobs.length,
        failed: failedJobs.length,
        completed: completedJobs.length,
      },
      asOf: new Date().toISOString(),
    };
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(queueName: keyof typeof QUEUE_NAMES, olderThan: number = 24 * 60 * 60 * 1000) {
    const queue = this.getQueue(queueName);
    await queue.clean(olderThan, 100, 'completed');
    await queue.clean(olderThan, 100, 'failed');
    this.logger.log(`Cleaned old jobs from queue: ${queueName}`);
  }

  private getQueue(queueName: keyof typeof QUEUE_NAMES): Bull.Queue {
    switch (queueName) {
      case 'EMAIL':
        return this.emailQueue;
      case 'REPORT':
        return this.reportQueue;
      case 'DATA_SYNC':
        return this.dataSyncQueue;
      case 'ANALYTICS':
        return this.analyticsQueue;
      default:
        throw new Error(`Unknown queue: ${String(queueName)}`);
    }
  }
}
