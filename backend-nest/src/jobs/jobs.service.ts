import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QUEUE_NAMES } from './jobs.module';

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
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORT) private reportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DATA_SYNC) private dataSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private analyticsQueue: Queue,
  ) {}

  /**
   * Add email to queue
   */
  async queueEmail(
    data: EmailJobData,
    options?: { delay?: number; priority?: number },
  ) {
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
        timeout: 300000, // 5 minutes
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
      const existingJobs = await this.dataSyncQueue.getJobs([
        'waiting',
        'active',
      ]);
      const duplicate = existingJobs.find(
        (job) => job.data.integrationId === data.integrationId,
      );

      if (duplicate) {
        this.logger.warn(
          `Data sync job already exists for integration: ${data.integrationId}`,
        );
        return duplicate;
      }

      const job = await this.dataSyncQueue.add('sync-data', data, {
        attempts: 3,
        timeout: 600000, // 10 minutes
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
            cron: '0 * * * *', // Every hour
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
      progress: job.progress(),
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

  /**
   * Clean old jobs
   */
  async cleanOldJobs(
    queueName: keyof typeof QUEUE_NAMES,
    olderThan: number = 24 * 60 * 60 * 1000,
  ) {
    const queue = this.getQueue(queueName);
    await queue.clean(olderThan, 'completed');
    await queue.clean(olderThan, 'failed');
    this.logger.log(`Cleaned old jobs from queue: ${queueName}`);
  }

  private getQueue(queueName: keyof typeof QUEUE_NAMES): Queue {
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
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }
}
