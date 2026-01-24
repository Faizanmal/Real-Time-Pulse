/**
 * Enhanced Monitoring Service
 * Provides APM integration, custom metrics collection, and performance monitoring
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface LatencyBucket {
  le: number;
  count: number;
}

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private metrics: Map<string, MetricData[]> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, LatencyBucket[]> = new Map();
  private gauges: Map<string, number> = new Map();
  private flushInterval: NodeJS.Timeout;

  // APM client (DataDog, New Relic, etc.)
  private apmClient: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
  ) {}

  async onModuleInit() {
    await this.initializeAPM();
    this.startMetricsFlush();
    this.logger.log('Monitoring service initialized', 'MonitoringService');
  }

  onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    void this.flushMetrics();
  }

  /**
   * Initialize APM based on configuration
   */
  private async initializeAPM() {
    const apmProvider = this.configService.get<string>('monitoring.apmProvider');
    const apmApiKey = this.configService.get<string>('monitoring.apmApiKey');

    if (!apmProvider || !apmApiKey) {
      this.logger.warn('APM not configured, using local metrics only', 'MonitoringService');
      return;
    }

    try {
      switch (apmProvider.toLowerCase()) {
        case 'datadog':
          await this.initializeDataDog(apmApiKey);
          break;
        case 'newrelic':
          await this.initializeNewRelic(apmApiKey);
          break;
        case 'prometheus':
          await this.initializePrometheus();
          break;
        default:
          this.logger.warn(`Unknown APM provider: ${apmProvider}`, 'MonitoringService');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize APM: ${error}`, 'MonitoringService');
    }
  }

  private async initializeDataDog(apiKey: string) {
    // DataDog initialization
    this.apmClient = {
      type: 'datadog',
      send: async (metrics: any) => {
        // Send to DataDog API
        const response = await fetch('https://api.datadoghq.com/api/v2/series', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': apiKey,
          },
          body: JSON.stringify({ series: metrics }),
        });
        return response.ok;
      },
    };
    this.logger.log('DataDog APM initialized', 'MonitoringService');
  }

  private async initializeNewRelic(apiKey: string) {
    // New Relic initialization
    this.apmClient = {
      type: 'newrelic',
      send: async (metrics: any) => {
        const response = await fetch('https://metric-api.newrelic.com/metric/v1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': apiKey,
          },
          body: JSON.stringify([{ metrics }]),
        });
        return response.ok;
      },
    };
    this.logger.log('New Relic APM initialized', 'MonitoringService');
  }

  private async initializePrometheus() {
    // Prometheus metrics endpoint (handled by MetricsController)
    this.apmClient = { type: 'prometheus' };
    this.logger.log('Prometheus metrics initialized', 'MonitoringService');
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value = 1, tags?: Record<string, string>) {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>) {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);
  }

  /**
   * Record a value in a histogram (for latency tracking)
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>) {
    const key = this.getMetricKey(name, tags);
    const buckets = this.histograms.get(key) || this.createDefaultBuckets();

    for (const bucket of buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }

    this.histograms.set(key, buckets);
  }

  /**
   * Track API request metrics
   */
  trackRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    _userId?: string,
  ) {
    const tags = {
      method,
      path: this.normalizePath(path),
      status: String(statusCode),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };

    this.incrementCounter('http_requests_total', 1, tags);
    this.recordHistogram('http_request_duration_seconds', duration / 1000, tags);

    // Track error rates
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, tags);
    }

    // Track slow requests
    if (duration > 1000) {
      this.incrementCounter('http_slow_requests_total', 1, tags);
    }
  }

  /**
   * Track database query metrics
   */
  trackDatabaseQuery(operation: string, table: string, duration: number, success: boolean) {
    const tags = { operation, table, success: String(success) };

    this.incrementCounter('database_queries_total', 1, tags);
    this.recordHistogram('database_query_duration_seconds', duration / 1000, tags);

    if (!success) {
      this.incrementCounter('database_errors_total', 1, tags);
    }
  }

  /**
   * Track cache metrics
   */
  trackCache(operation: 'hit' | 'miss' | 'set' | 'delete', key: string) {
    const tags = { operation, key_prefix: key.split(':')[0] };
    this.incrementCounter('cache_operations_total', 1, tags);
  }

  /**
   * Track WebSocket connections
   */
  trackWebSocket(event: 'connect' | 'disconnect' | 'message', namespace?: string) {
    const tags = { event, namespace: namespace || 'default' };
    this.incrementCounter('websocket_events_total', 1, tags);

    if (event === 'connect') {
      const current = this.gauges.get('websocket_connections') || 0;
      this.setGauge('websocket_connections', current + 1);
    } else if (event === 'disconnect') {
      const current = this.gauges.get('websocket_connections') || 0;
      this.setGauge('websocket_connections', Math.max(0, current - 1));
    }
  }

  /**
   * Track background job metrics
   */
  trackJob(jobName: string, status: 'started' | 'completed' | 'failed', duration?: number) {
    const tags = { job: jobName, status };
    this.incrementCounter('background_jobs_total', 1, tags);

    if (duration) {
      this.recordHistogram('background_job_duration_seconds', duration / 1000, { job: jobName });
    }
  }

  /**
   * Track external API calls
   */
  trackExternalApi(service: string, endpoint: string, statusCode: number, duration: number) {
    const tags = { service, endpoint, status: String(statusCode) };

    this.incrementCounter('external_api_calls_total', 1, tags);
    this.recordHistogram('external_api_duration_seconds', duration / 1000, tags);

    if (statusCode >= 400) {
      this.incrementCounter('external_api_errors_total', 1, tags);
    }
  }

  /**
   * Track business metrics
   */
  trackBusinessMetric(name: string, value: number, tags?: Record<string, string>) {
    this.incrementCounter(`business_${name}`, value, tags);
  }

  /**
   * Get all metrics for export
   */
  getMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, LatencyBucket[]>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms),
    };
  }

  /**
   * Get Prometheus format metrics
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      const { name, tags } = this.parseMetricKey(key);
      const tagsStr = this.formatPrometheusTags(tags);
      lines.push(`${name}${tagsStr} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const { name, tags } = this.parseMetricKey(key);
      const tagsStr = this.formatPrometheusTags(tags);
      lines.push(`${name}${tagsStr} ${value}`);
    }

    // Histograms
    for (const [key, buckets] of this.histograms) {
      const { name, tags } = this.parseMetricKey(key);
      const tagsStr = this.formatPrometheusTags(tags);

      for (const bucket of buckets) {
        const bucketTags = tagsStr
          ? tagsStr.slice(0, -1) + `,le="${bucket.le}"}`
          : `{le="${bucket.le}"}`;
        lines.push(`${name}_bucket${bucketTags} ${bucket.count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Start periodic metrics flush
   */
  private startMetricsFlush() {
    const flushIntervalMs = this.configService.get<number>('monitoring.flushInterval') || 60000;

    this.flushInterval = setInterval(() => {
      void this.flushMetrics();
    }, flushIntervalMs);
  }

  /**
   * Flush metrics to APM provider
   */
  private async flushMetrics() {
    if (!this.apmClient?.send) {
      return;
    }

    try {
      const metrics = this.getMetrics();
      const formattedMetrics = this.formatMetricsForAPM(metrics);
      await this.apmClient.send(formattedMetrics);
      this.logger.debug('Metrics flushed to APM', 'MonitoringService');
    } catch (error) {
      this.logger.error(`Failed to flush metrics: ${error}`, 'MonitoringService');
    }
  }

  /**
   * Format metrics for APM provider
   */
  private formatMetricsForAPM(metrics: any) {
    const timestamp = Math.floor(Date.now() / 1000);
    const formattedMetrics: any[] = [];

    for (const [key, value] of Object.entries(metrics.counters)) {
      const { name, tags } = this.parseMetricKey(key);
      formattedMetrics.push({
        metric: `realtimepulse.${name}`,
        type: 0, // Count
        points: [[timestamp, value]],
        tags: Object.entries(tags).map(([k, v]) => `${k}:${v}`),
      });
    }

    for (const [key, value] of Object.entries(metrics.gauges)) {
      const { name, tags } = this.parseMetricKey(key);
      formattedMetrics.push({
        metric: `realtimepulse.${name}`,
        type: 1, // Gauge
        points: [[timestamp, value]],
        tags: Object.entries(tags).map(([k, v]) => `${k}:${v}`),
      });
    }

    return formattedMetrics;
  }

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  }

  private parseMetricKey(key: string): { name: string; tags: Record<string, string> } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) return { name: key, tags: {} };

    const name = match[1];
    const tags: Record<string, string> = {};

    if (match[2]) {
      match[2].split(',').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k && v) tags[k] = v;
      });
    }

    return { name, tags };
  }

  private formatPrometheusTags(tags: Record<string, string>): string {
    const entries = Object.entries(tags);
    if (entries.length === 0) return '';
    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }

  private normalizePath(path: string): string {
    // Replace IDs with placeholders for grouping
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  private createDefaultBuckets(): LatencyBucket[] {
    return [
      { le: 0.005, count: 0 },
      { le: 0.01, count: 0 },
      { le: 0.025, count: 0 },
      { le: 0.05, count: 0 },
      { le: 0.1, count: 0 },
      { le: 0.25, count: 0 },
      { le: 0.5, count: 0 },
      { le: 1, count: 0 },
      { le: 2.5, count: 0 },
      { le: 5, count: 0 },
      { le: 10, count: 0 },
      { le: Infinity, count: 0 },
    ];
  }
}
