/**
 * =============================================================================
 * REAL-TIME PULSE - ENHANCED OBSERVABILITY
 * =============================================================================
 * 
 * Comprehensive logging, metrics, and error tracking with structured output.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ============================================================================
// TYPES
// ============================================================================

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  workspaceId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface MetricEntry {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: Record<string, string>;
  timestamp: number;
}

export interface MetricsSnapshot {
  // HTTP Metrics
  httpRequestsTotal: number;
  httpRequestDuration: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  httpErrorRate: number;
  
  // Business Metrics
  activeUsers: number;
  portalsCreated: number;
  widgetsRendered: number;
  integrationsConnected: number;
  aiQueriesProcessed: number;
  reportsGenerated: number;
  
  // System Metrics
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: number;
  eventLoopLag: number;
  
  // Cache Metrics
  cacheHitRate: number;
  cacheMissRate: number;
  
  // Queue Metrics
  queueDepth: number;
  queueProcessingRate: number;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    url?: string;
    method?: string;
    userId?: string;
    workspaceId?: string;
    correlationId?: string;
  };
  environment: string;
  release: string;
  fingerprint: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class EnhancedObservabilityService implements OnModuleInit {
  private readonly logger = new Logger(EnhancedObservabilityService.name);
  
  private readonly serviceName: string;
  private readonly version: string;
  private readonly environment: string;
  
  // Metrics storage
  private metrics: Map<string, MetricEntry[]> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  
  // Error tracking
  private errorBuffer: ErrorReport[] = [];
  private errorFingerprints: Map<string, ErrorReport> = new Map();
  
  // Request tracking
  private requestDurations: number[] = [];
  private readonly MAX_DURATIONS = 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.serviceName = config.get('SERVICE_NAME') || 'real-time-pulse-api';
    this.version = config.get('APP_VERSION') || '2.0.0';
    this.environment = config.get('NODE_ENV') || 'development';
  }

  async onModuleInit() {
    // Start metrics collection interval
    this.startMetricsCollection();
    
    // Setup error aggregation
    this.setupErrorAggregation();
    
    this.logger.log('Enhanced observability service initialized');
  }

  // ============================================================================
  // STRUCTURED LOGGING
  // ============================================================================

  /**
   * Create a structured log entry
   */
  log(
    level: LogEntry['level'],
    message: string,
    context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message' | 'service' | 'version' | 'environment'>>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.version,
      environment: this.environment,
      ...context,
    };

    // Output as JSON for log aggregation systems
    const output = JSON.stringify(entry);
    
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }

    // Emit event for subscribers
    this.eventEmitter.emit('log.entry', entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, { metadata: context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, { metadata: context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, { metadata: context });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, {
      metadata: context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });

    // Track error
    if (error) {
      this.trackError(error, context);
    }
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    this.counters.set(key, value);
  }

  /**
   * Record a histogram value (for timing, sizes, etc.)
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    
    this.histograms.set(key, values);
  }

  /**
   * Time a function and record its duration
   */
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    labels: Record<string, string> = {},
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordHistogram(name, Date.now() - start, { ...labels, status: 'success' });
      return result;
    } catch (error) {
      this.recordHistogram(name, Date.now() - start, { ...labels, status: 'error' });
      throw error;
    }
  }

  /**
   * Record HTTP request duration
   */
  recordRequestDuration(duration: number): void {
    this.requestDurations.push(duration);
    if (this.requestDurations.length > this.MAX_DURATIONS) {
      this.requestDurations.shift();
    }
  }

  /**
   * Get percentile from sorted array
   */
  private getPercentile(sortedArr: number[], percentile: number): number {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): MetricsSnapshot {
    const sortedDurations = [...this.requestDurations].sort((a, b) => a - b);
    const memUsage = process.memoryUsage();
    
    return {
      httpRequestsTotal: this.counters.get('http_requests_total') || 0,
      httpRequestDuration: {
        avg: sortedDurations.length > 0 
          ? sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length 
          : 0,
        p50: this.getPercentile(sortedDurations, 50),
        p95: this.getPercentile(sortedDurations, 95),
        p99: this.getPercentile(sortedDurations, 99),
      },
      httpErrorRate: this.calculateErrorRate(),
      
      activeUsers: this.counters.get('active_users') || 0,
      portalsCreated: this.counters.get('portals_created') || 0,
      widgetsRendered: this.counters.get('widgets_rendered') || 0,
      integrationsConnected: this.counters.get('integrations_connected') || 0,
      aiQueriesProcessed: this.counters.get('ai_queries_processed') || 0,
      reportsGenerated: this.counters.get('reports_generated') || 0,
      
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: 0, // Would need separate measurement
      eventLoopLag: 0, // Would need separate measurement
      
      cacheHitRate: this.counters.get('cache_hit_rate') || 0,
      cacheMissRate: this.counters.get('cache_miss_rate') || 0,
      
      queueDepth: this.counters.get('queue_depth') || 0,
      queueProcessingRate: this.counters.get('queue_processing_rate') || 0,
    };
  }

  /**
   * Get Prometheus-compatible metrics output
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Counters
    this.counters.forEach((value, key) => {
      lines.push(`# TYPE ${key} counter`);
      lines.push(`${key} ${value}`);
    });
    
    // Histograms
    this.histograms.forEach((values, key) => {
      if (values.length === 0) return;
      
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      
      lines.push(`# TYPE ${key} histogram`);
      lines.push(`${key}_count ${values.length}`);
      lines.push(`${key}_sum ${sum}`);
      lines.push(`${key}{le="0.1"} ${sorted.filter(v => v <= 100).length}`);
      lines.push(`${key}{le="0.5"} ${sorted.filter(v => v <= 500).length}`);
      lines.push(`${key}{le="1"} ${sorted.filter(v => v <= 1000).length}`);
      lines.push(`${key}{le="5"} ${sorted.filter(v => v <= 5000).length}`);
      lines.push(`${key}{le="+Inf"} ${values.length}`);
    });
    
    return lines.join('\n');
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private calculateErrorRate(): number {
    const total = this.counters.get('http_requests_total') || 0;
    const errors = this.counters.get('http_errors_total') || 0;
    return total > 0 ? errors / total : 0;
  }

  // ============================================================================
  // ERROR TRACKING
  // ============================================================================

  /**
   * Track an error for aggregation
   */
  trackError(error: Error, context?: Record<string, unknown>): void {
    const fingerprint = this.generateErrorFingerprint(error);
    const now = new Date().toISOString();

    const existing = this.errorFingerprints.get(fingerprint);
    
    if (existing) {
      existing.occurrences++;
      existing.lastSeen = now;
    } else {
      const report: ErrorReport = {
        id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: now,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context: {
          url: context?.url as string,
          method: context?.method as string,
          userId: context?.userId as string,
          workspaceId: context?.workspaceId as string,
          correlationId: context?.correlationId as string,
        },
        environment: this.environment,
        release: this.version,
        fingerprint,
        occurrences: 1,
        firstSeen: now,
        lastSeen: now,
      };

      this.errorFingerprints.set(fingerprint, report);
      this.errorBuffer.push(report);
      
      // Keep buffer size manageable
      if (this.errorBuffer.length > 1000) {
        this.errorBuffer.shift();
      }
    }

    this.incrementCounter('errors_total', { type: error.name });
  }

  /**
   * Generate fingerprint for error deduplication
   */
  private generateErrorFingerprint(error: Error): string {
    const parts = [
      error.name,
      error.message.replace(/\d+/g, 'N'), // Normalize numbers
    ];
    
    // Add first meaningful stack frame
    if (error.stack) {
      const lines = error.stack.split('\n');
      const meaningfulLine = lines.find(
        line => line.includes('/src/') && !line.includes('node_modules'),
      );
      if (meaningfulLine) {
        parts.push(meaningfulLine.trim());
      }
    }
    
    return Buffer.from(parts.join('|')).toString('base64').substring(0, 32);
  }

  /**
   * Get error reports
   */
  getErrorReports(limit = 50): ErrorReport[] {
    return [...this.errorBuffer]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  /**
   * Get top errors by occurrence
   */
  getTopErrors(limit = 10): ErrorReport[] {
    return [...this.errorFingerprints.values()]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.setGauge('memory_heap_used_bytes', memUsage.heapUsed);
      this.setGauge('memory_heap_total_bytes', memUsage.heapTotal);
      this.setGauge('memory_rss_bytes', memUsage.rss);
    }, 30000);
  }

  private setupErrorAggregation(): void {
    // Periodically flush old errors (older than 24 hours)
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      this.errorBuffer = this.errorBuffer.filter(e => e.lastSeen > cutoff);
      
      this.errorFingerprints.forEach((report, fingerprint) => {
        if (report.lastSeen < cutoff) {
          this.errorFingerprints.delete(fingerprint);
        }
      });
    }, 60 * 60 * 1000); // Every hour
  }
}
