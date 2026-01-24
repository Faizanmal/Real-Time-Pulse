import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export interface RateLimitConfig {
  integrationId: string;
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
}

export interface RequestMetrics {
  integrationId: string;
  timestamp: Date;
  requestCount: number;
  remainingQuota: number;
  resetAt: Date;
}

interface QueuedRequest {
  id: string;
  integrationId: string;
  endpoint: string;
  method: string;
  params: any;
  priority: number;
  createdAt: Date;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private rateLimitCache: Map<string, RateLimitConfig> = new Map();
  private requestCounters: Map<string, { count: number; resetAt: number }> = new Map();
  private predictiveMetrics: Map<string, number[]> = new Map(); // Store request patterns

  constructor(
    @InjectQueue('api-requests') private requestQueue: Queue,
    private prisma: PrismaService,
  ) {
    void this.initializeRateLimits();
    this.startPredictiveAnalysis();
  }

  /**
   * Initialize rate limits from configuration
   */
  private async initializeRateLimits() {
    try {
      const configs = await this.prisma.$queryRaw<any[]>`
        SELECT integration_id, max_requests, window_ms, burst_limit
        FROM rate_limit_configs
      `;

      for (const config of configs) {
        this.rateLimitCache.set(config.integration_id, {
          integrationId: config.integration_id,
          maxRequests: config.max_requests,
          windowMs: config.window_ms,
          burstLimit: config.burst_limit,
        });
      }

      this.logger.log('Rate limits initialized');
    } catch (error) {
      this.logger.error('Failed to initialize rate limits', error);
    }
  }

  /**
   * Configure rate limit for an integration
   */
  async setRateLimit(config: RateLimitConfig): Promise<void> {
    this.rateLimitCache.set(config.integrationId, config);

    await this.prisma.$executeRaw`
      INSERT INTO rate_limit_configs (integration_id, max_requests, window_ms, burst_limit)
      VALUES (${config.integrationId}, ${config.maxRequests}, ${config.windowMs}, ${config.burstLimit || null})
      ON CONFLICT (integration_id)
      DO UPDATE SET max_requests = EXCLUDED.max_requests,
                    window_ms = EXCLUDED.window_ms,
                    burst_limit = EXCLUDED.burst_limit
    `;

    this.logger.log(`Rate limit configured for ${config.integrationId}`);
  }

  /**
   * Check if request is within rate limit
   */
  async checkRateLimit(integrationId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const config = this.rateLimitCache.get(integrationId);
    if (!config) {
      // No rate limit configured, allow request
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 3600000),
      };
    }

    const now = Date.now();
    const counter = this.requestCounters.get(integrationId);

    if (!counter || counter.resetAt < now) {
      // Reset counter
      this.requestCounters.set(integrationId, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now + config.windowMs),
      };
    }

    if (counter.count < config.maxRequests) {
      counter.count++;
      return {
        allowed: true,
        remaining: config.maxRequests - counter.count,
        resetAt: new Date(counter.resetAt),
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(counter.resetAt),
    };
  }

  /**
   * Queue request with intelligent batching
   */
  async queueRequest(
    integrationId: string,
    endpoint: string,
    method: string,
    params: any,
    priority = 5,
  ): Promise<string> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const queuedRequest: QueuedRequest = {
      id: requestId,
      integrationId,
      endpoint,
      method,
      params,
      priority,
      createdAt: new Date(),
    };

    // Add to queue with priority
    await this.requestQueue.add('execute-request', queuedRequest, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // Track for predictive analysis
    this.trackRequestPattern(integrationId);

    this.logger.log(`Request queued: ${requestId}`);
    return requestId;
  }

  /**
   * Process queued request with rate limiting
   */
  async processQueuedRequest(request: QueuedRequest): Promise<any> {
    const rateLimit = await this.checkRateLimit(request.integrationId);

    if (!rateLimit.allowed) {
      // Calculate wait time
      const waitMs = rateLimit.resetAt.getTime() - Date.now();
      this.logger.log(`Rate limit exceeded, waiting ${waitMs}ms`);

      // Re-queue with delay
      await this.requestQueue.add('execute-request', request, {
        delay: waitMs,
        priority: request.priority,
      });
      return null;
    }

    // Execute the request (delegate to integration service)
    try {
      // Record metrics
      await this.recordRequestMetrics(request.integrationId, rateLimit);

      return {
        success: true,
        requestId: request.id,
        remaining: rateLimit.remaining,
      };
    } catch (error) {
      this.logger.error(`Request execution failed: ${request.id}`, error);
      throw error;
    }
  }

  /**
   * Batch similar requests together
   */
  async batchRequests(integrationId: string): Promise<QueuedRequest[]> {
    const jobs = await this.requestQueue.getJobs(['waiting', 'delayed']);

    // Group requests by integration and endpoint
    const batches = new Map<string, QueuedRequest[]>();

    for (const job of jobs) {
      const request = job.data as QueuedRequest;
      if (request.integrationId === integrationId) {
        const key = `${request.endpoint}_${request.method}`;
        if (!batches.has(key)) {
          batches.set(key, []);
        }
        batches.get(key).push(request);
      }
    }

    // Return the largest batch
    let largestBatch: QueuedRequest[] = [];
    for (const batch of batches.values()) {
      if (batch.length > largestBatch.length) {
        largestBatch = batch;
      }
    }

    return largestBatch;
  }

  /**
   * Predictive rate limit management
   */
  private startPredictiveAnalysis() {
    // Run analysis every minute
    setInterval(() => {
      this.analyzePredictivePatterns();
    }, 60000);
  }

  private trackRequestPattern(integrationId: string) {
    const now = Date.now();
    if (!this.predictiveMetrics.has(integrationId)) {
      this.predictiveMetrics.set(integrationId, []);
    }

    const metrics = this.predictiveMetrics.get(integrationId);
    metrics.push(now);

    // Keep only last hour of data
    const oneHourAgo = now - 3600000;
    this.predictiveMetrics.set(
      integrationId,
      metrics.filter((ts) => ts > oneHourAgo),
    );
  }

  private analyzePredictivePatterns() {
    for (const [integrationId, timestamps] of this.predictiveMetrics.entries()) {
      if (timestamps.length < 10) continue; // Need enough data

      // Calculate request rate
      const now = Date.now();
      const recentRequests = timestamps.filter((ts) => ts > now - 300000); // Last 5 minutes
      const requestRate = recentRequests.length / 5; // Requests per minute

      // Predict if we're approaching rate limit
      const config = this.rateLimitCache.get(integrationId);
      if (!config) continue;

      const maxRatePerMinute = (config.maxRequests / config.windowMs) * 60000;
      const utilizationPercent = (requestRate / maxRatePerMinute) * 100;

      if (utilizationPercent > 80) {
        this.logger.warn(
          `High rate limit utilization for ${integrationId}: ${utilizationPercent.toFixed(1)}%`,
        );
        // Could trigger alerts or auto-scaling here
      }
    }
  }

  /**
   * Exponential backoff retry logic
   */
  async retryWithBackoff(request: QueuedRequest, attempt: number): Promise<void> {
    const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds

    this.logger.log(`Retry attempt ${attempt} for ${request.id} in ${delayMs}ms`);

    await this.requestQueue.add('execute-request', request, {
      delay: delayMs,
      priority: request.priority,
      attempts: 3 - attempt,
    });
  }

  /**
   * Get real-time rate limit monitoring
   */
  async getMonitoring(integrationId?: string): Promise<RequestMetrics[]> {
    const metrics: RequestMetrics[] = [];

    const integrations = integrationId ? [integrationId] : Array.from(this.rateLimitCache.keys());

    for (const id of integrations) {
      const config = this.rateLimitCache.get(id);
      const counter = this.requestCounters.get(id);

      if (!config) continue;

      metrics.push({
        integrationId: id,
        timestamp: new Date(),
        requestCount: counter?.count || 0,
        remainingQuota: config.maxRequests - (counter?.count || 0),
        resetAt: counter ? new Date(counter.resetAt) : new Date(),
      });
    }

    return metrics;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await this.requestQueue.getWaitingCount();
    const active = await this.requestQueue.getActiveCount();
    const completed = await this.requestQueue.getCompletedCount();
    const failed = await this.requestQueue.getFailedCount();
    const delayed = await this.requestQueue.getDelayedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }

  /**
   * Record request metrics for analytics
   */
  private async recordRequestMetrics(
    integrationId: string,
    rateLimit: { remaining: number; resetAt: Date },
  ) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO rate_limit_metrics (integration_id, timestamp, remaining_quota, reset_at)
        VALUES (${integrationId}, ${new Date()}, ${rateLimit.remaining}, ${rateLimit.resetAt})
      `;
    } catch (error) {
      this.logger.error('Failed to record metrics', error);
    }
  }

  /**
   * Clear rate limit for integration (admin use)
   */
  async clearRateLimit(integrationId: string): Promise<void> {
    this.requestCounters.delete(integrationId);
    this.logger.log(`Rate limit cleared for ${integrationId}`);
  }

  /**
   * Adjust rate limit dynamically based on usage
   */
  async adjustRateLimit(integrationId: string, adjustment: 'increase' | 'decrease'): Promise<void> {
    const config = this.rateLimitCache.get(integrationId);
    if (!config) return;

    const factor = adjustment === 'increase' ? 1.5 : 0.75;
    config.maxRequests = Math.floor(config.maxRequests * factor);

    await this.setRateLimit(config);
    this.logger.log(`Rate limit ${adjustment}d for ${integrationId}`);
  }
}
