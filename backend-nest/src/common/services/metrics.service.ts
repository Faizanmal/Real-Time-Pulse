import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface MetricSummary {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface RequestMetric {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  workspaceId?: string;
}

interface MetricBucket {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
}

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly METRICS_PREFIX = 'metrics:';
  private readonly REQUEST_METRICS_KEY = 'request_metrics';
  private readonly RETENTION_HOURS = 24;
  private readonly AGGREGATION_INTERVAL = 60000; // 1 minute

  private requestMetrics: RequestMetric[] = [];
  private metricBuckets: Map<string, MetricBucket> = new Map();
  private aggregationTimer: NodeJS.Timeout | null = null;

  constructor(private readonly cacheService: CacheService) {}

  onModuleInit(): void {
    // Start periodic aggregation
    this.aggregationTimer = setInterval(
      () => this.aggregateMetrics(),
      this.AGGREGATION_INTERVAL,
    );
    this.logger.log('Metrics service initialized');
  }

  onModuleDestroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    // Final flush before shutdown
    this.aggregateMetrics();
  }

  /**
   * Record an HTTP request metric
   */
  recordRequest(metric: RequestMetric): void {
    this.requestMetrics.push(metric);
    this.recordCounter('http_requests_total', 1, {
      path: this.normalizePath(metric.path),
      method: metric.method,
      status: String(metric.statusCode),
    });
    this.recordHistogram('http_request_duration_ms', metric.duration, {
      path: this.normalizePath(metric.path),
      method: metric.method,
    });
  }

  /**
   * Record a counter metric (incremental)
   */
  recordCounter(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    const key = this.generateMetricKey(name, tags);
    const bucket = this.getOrCreateBucket(key);
    bucket.count += value;
    bucket.sum += value;
  }

  /**
   * Record a gauge metric (point-in-time value)
   */
  recordGauge(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    const key = this.generateMetricKey(name, tags);
    const bucket = this.getOrCreateBucket(key);
    bucket.values = [value]; // Gauge only keeps the latest value
    bucket.min = value;
    bucket.max = value;
    bucket.sum = value;
    bucket.count = 1;
  }

  /**
   * Record a histogram metric (distribution)
   */
  recordHistogram(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    const key = this.generateMetricKey(name, tags);
    const bucket = this.getOrCreateBucket(key);
    bucket.values.push(value);
    bucket.count++;
    bucket.sum += value;
    bucket.min = Math.min(bucket.min, value);
    bucket.max = Math.max(bucket.max, value);

    // Keep only last 1000 values to prevent memory issues
    if (bucket.values.length > 1000) {
      bucket.values = bucket.values.slice(-1000);
    }
  }

  /**
   * Get metric summary
   */
  getMetricSummary(
    name: string,
    tags: Record<string, string> = {},
  ): MetricSummary | null {
    const key = this.generateMetricKey(name, tags);
    const bucket = this.metricBuckets.get(key);

    if (!bucket || bucket.count === 0) {
      return null;
    }

    const sortedValues = [...bucket.values].sort((a, b) => a - b);

    return {
      name,
      count: bucket.count,
      sum: bucket.sum,
      min: bucket.min,
      max: bucket.max,
      avg: bucket.sum / bucket.count,
      p50: this.percentile(sortedValues, 50),
      p95: this.percentile(sortedValues, 95),
      p99: this.percentile(sortedValues, 99),
    };
  }

  /**
   * Get all request metrics for the last N minutes
   */
  getRecentRequestMetrics(minutes: number = 5): RequestMetric[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.requestMetrics.filter((m) => m.timestamp >= cutoff);
  }

  /**
   * Get endpoint performance summary
   */
  getEndpointPerformance(): Record<string, MetricSummary> {
    const grouped: Record<string, number[]> = {};

    for (const metric of this.requestMetrics) {
      const key = `${metric.method} ${this.normalizePath(metric.path)}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(metric.duration);
    }

    const result: Record<string, MetricSummary> = {};
    for (const [key, values] of Object.entries(grouped)) {
      const sorted = values.sort((a, b) => a - b);
      result[key] = {
        name: key,
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p50: this.percentile(sorted, 50),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99),
      };
    }

    return result;
  }

  /**
   * Get error rate by endpoint
   */
  getErrorRates(): Record<string, { total: number; errors: number; errorRate: number }> {
    const grouped: Record<string, { total: number; errors: number }> = {};

    for (const metric of this.requestMetrics) {
      const key = `${metric.method} ${this.normalizePath(metric.path)}`;
      if (!grouped[key]) {
        grouped[key] = { total: 0, errors: 0 };
      }
      grouped[key].total++;
      if (metric.statusCode >= 400) {
        grouped[key].errors++;
      }
    }

    const result: Record<string, { total: number; errors: number; errorRate: number }> = {};
    for (const [key, stats] of Object.entries(grouped)) {
      result[key] = {
        ...stats,
        errorRate: stats.total > 0 ? stats.errors / stats.total : 0,
      };
    }

    return result;
  }

  /**
   * Get overall system metrics
   */
  getSystemMetrics(): Record<string, unknown> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      uptimeSeconds: uptime,
      memory: {
        heapUsed: this.formatBytes(memoryUsage.heapUsed),
        heapTotal: this.formatBytes(memoryUsage.heapTotal),
        external: this.formatBytes(memoryUsage.external),
        rss: this.formatBytes(memoryUsage.rss),
      },
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  private aggregateMetrics(): void {
    // Clean up old request metrics
    const cutoff = new Date(Date.now() - this.RETENTION_HOURS * 60 * 60 * 1000);
    this.requestMetrics = this.requestMetrics.filter((m) => m.timestamp >= cutoff);

    // Persist current metrics to cache
    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    try {
      const summary = {
        timestamp: new Date().toISOString(),
        requestCount: this.requestMetrics.length,
        endpointPerformance: this.getEndpointPerformance(),
        errorRates: this.getErrorRates(),
        system: this.getSystemMetrics(),
      };

      await this.cacheService.set(
        `${this.METRICS_PREFIX}summary`,
        JSON.stringify(summary),
        3600, // 1 hour
      );
    } catch (error) {
      this.logger.error('Failed to persist metrics', error);
    }
  }

  private getOrCreateBucket(key: string): MetricBucket {
    if (!this.metricBuckets.has(key)) {
      this.metricBuckets.set(key, {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        values: [],
      });
    }
    return this.metricBuckets.get(key)!;
  }

  private generateMetricKey(name: string, tags: Record<string, string>): string {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return tagStr ? `${name}{${tagStr}}` : name;
  }

  private normalizePath(path: string): string {
    // Replace UUIDs and IDs with placeholders
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id')
      .split('?')[0]; // Remove query string
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let value = bytes;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }
}
