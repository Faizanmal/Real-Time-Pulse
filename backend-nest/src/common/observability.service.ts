/**
 * =============================================================================
 * REAL-TIME PULSE - OBSERVABILITY SERVICE
 * =============================================================================
 * 
 * Comprehensive observability including logging, metrics, tracing, and monitoring.
 */

import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import * as opentelemetry from '@opentelemetry/api';

// Logger with structured output
@Injectable()
export class StructuredLogger extends Logger {
  private static instance: StructuredLogger;
  private serviceName: string;
  private version: string;
  private environment: string;

  constructor(context?: string) {
    super(context);
    this.serviceName = process.env.SERVICE_NAME || 'real-time-pulse';
    this.version = process.env.APP_VERSION || '2.0.0';
    this.environment = process.env.NODE_ENV || 'development';
  }

  static getInstance(context?: string): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(context);
    }
    return StructuredLogger.instance;
  }

  private formatLog(
    level: string,
    message: string,
    meta?: Record<string, unknown>,
    error?: Error,
  ): string {
    const tracer = opentelemetry.trace.getActiveSpan();
    const spanContext = tracer?.spanContext();

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      version: this.version,
      environment: this.environment,
      message,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      ...meta,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return JSON.stringify(logEntry);
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.formatLog('INFO', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.formatLog('WARN', message, meta));
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>) {
    console.error(this.formatLog('ERROR', message, meta, error));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (this.environment === 'development') {
      console.debug(this.formatLog('DEBUG', message, meta));
    }
  }

  audit(action: string, userId: string, resourceType: string, resourceId: string, details?: Record<string, unknown>) {
    this.info(`AUDIT: ${action}`, {
      audit: true,
      action,
      userId,
      resourceType,
      resourceId,
      ...details,
    });
  }

  performance(operation: string, durationMs: number, meta?: Record<string, unknown>) {
    this.info(`PERF: ${operation} completed in ${durationMs}ms`, {
      performance: true,
      operation,
      durationMs,
      ...meta,
    });
  }

  security(event: string, details: Record<string, unknown>) {
    this.warn(`SECURITY: ${event}`, {
      security: true,
      event,
      ...details,
    });
  }
}

// Metrics collector
@Injectable()
export class MetricsService {
  private metrics: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private labels: Map<string, Map<string, number>> = new Map();

  // Counter operations
  increment(name: string, value: number = 1, labelValues?: Record<string, string>) {
    const key = this.getKey(name, labelValues);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }

  decrement(name: string, value: number = 1, labelValues?: Record<string, string>) {
    this.increment(name, -value, labelValues);
  }

  // Gauge operations
  set(name: string, value: number, labelValues?: Record<string, string>) {
    const key = this.getKey(name, labelValues);
    this.metrics.set(key, value);
  }

  // Histogram operations
  observe(name: string, value: number, labelValues?: Record<string, string>) {
    const key = this.getKey(name, labelValues);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  // Timer helper
  startTimer(name: string, labelValues?: Record<string, string>): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.observe(name, duration, labelValues);
      return duration;
    };
  }

  // Get metrics for export
  getMetrics(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      counters: Object.fromEntries(this.metrics),
      histograms: {},
    };

    this.histograms.forEach((values, key) => {
      const sorted = [...values].sort((a, b) => a - b);
      (result.histograms as Record<string, unknown>)[key] = {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p90: sorted[Math.floor(sorted.length * 0.9)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    });

    return result;
  }

  // Prometheus format export
  toPrometheus(): string {
    const lines: string[] = [];

    this.metrics.forEach((value, key) => {
      const [name, labels] = this.parseKey(key);
      lines.push(`${name}${labels} ${value}`);
    });

    return lines.join('\n');
  }

  private getKey(name: string, labelValues?: Record<string, string>): string {
    if (!labelValues) return name;
    const labels = Object.entries(labelValues)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labels}}`;
  }

  private parseKey(key: string): [string, string] {
    const match = key.match(/^([^{]+)(\{.*\})?$/);
    if (match) {
      return [match[1], match[2] || ''];
    }
    return [key, ''];
  }
}

// Request tracing interceptor
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger('TracingInterceptor');
  private readonly metrics = new MetricsService();
  private readonly tracer = opentelemetry.trace.getTracer('http-interceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers, ip } = request;
    const requestId = headers['x-request-id'] || this.generateRequestId();
    const startTime = Date.now();

    // Start span
    const span = this.tracer.startSpan(`HTTP ${method} ${url}`, {
      kind: opentelemetry.SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.url': url,
        'http.user_agent': headers['user-agent'],
        'http.request_id': requestId,
        'net.peer.ip': ip,
      },
    });

    // Add request ID to response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('x-request-id', requestId);

    // Metrics
    this.metrics.increment('http_requests_total', 1, { method, path: url });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        span.setAttributes({
          'http.status_code': statusCode,
          'http.duration_ms': duration,
        });
        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        span.end();

        this.metrics.observe('http_request_duration_ms', duration, { method, path: url, status: String(statusCode) });
        this.metrics.increment('http_requests_success', 1, { method, path: url });

        this.logger.performance(`${method} ${url}`, duration, {
          requestId,
          statusCode,
          method,
          url,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        span.setAttributes({
          'http.status_code': statusCode,
          'http.duration_ms': duration,
        });
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        span.end();

        this.metrics.observe('http_request_duration_ms', duration, { method, path: url, status: String(statusCode) });
        this.metrics.increment('http_requests_error', 1, { method, path: url, status: String(statusCode) });

        this.logger.error(`${method} ${url} failed`, error, {
          requestId,
          statusCode,
          method,
          url,
          duration,
        });

        throw error;
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// Health check service
@Injectable()
export class HealthService {
  private checks: Map<string, () => Promise<{ healthy: boolean; details?: unknown }>> = new Map();

  registerCheck(name: string, check: () => Promise<{ healthy: boolean; details?: unknown }>) {
    this.checks.set(name, check);
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { healthy: boolean; details?: unknown; duration: number }>;
    timestamp: string;
  }> {
    const results: Record<string, { healthy: boolean; details?: unknown; duration: number }> = {};
    let overallHealthy = true;
    let hasDegraded = false;

    for (const [name, check] of this.checks) {
      const start = Date.now();
      try {
        const result = await Promise.race([
          check(),
          new Promise<{ healthy: boolean; details?: unknown }>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          ),
        ]);
        results[name] = { ...result, duration: Date.now() - start };
        if (!result.healthy) {
          hasDegraded = true;
        }
      } catch (error) {
        results[name] = {
          healthy: false,
          details: { error: (error as Error).message },
          duration: Date.now() - start,
        };
        overallHealthy = false;
      }
    }

    return {
      status: !overallHealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  // Built-in health checks
  async checkDatabase(prisma: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }): Promise<{ healthy: boolean; details?: unknown }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { healthy: true };
    } catch (error) {
      return { healthy: false, details: { error: (error as Error).message } };
    }
  }

  async checkRedis(redis: { ping: () => Promise<string> }): Promise<{ healthy: boolean; details?: unknown }> {
    try {
      const result = await redis.ping();
      return { healthy: result === 'PONG', details: { response: result } };
    } catch (error) {
      return { healthy: false, details: { error: (error as Error).message } };
    }
  }

  async checkMemory(): Promise<{ healthy: boolean; details?: unknown }> {
    const used = process.memoryUsage();
    const heapUsedPercentage = (used.heapUsed / used.heapTotal) * 100;
    return {
      healthy: heapUsedPercentage < 90,
      details: {
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
        heapUsedPercentage: `${heapUsedPercentage.toFixed(1)}%`,
        rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      },
    };
  }

  async checkDisk(): Promise<{ healthy: boolean; details?: unknown }> {
    // Simplified - in production use fs/promises with statvfs
    return { healthy: true, details: { message: 'Disk check placeholder' } };
  }
}

// Alert service for monitoring
@Injectable()
export class AlertService {
  private readonly logger = new StructuredLogger('AlertService');
  private thresholds: Map<string, { metric: string; operator: '>' | '<' | '==' | '>='; value: number; callback: () => void }> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private cooldownMs = 300000; // 5 minutes

  registerThreshold(
    name: string,
    metric: string,
    operator: '>' | '<' | '==' | '>=',
    value: number,
    callback: () => void,
  ) {
    this.thresholds.set(name, { metric, operator, value, callback });
  }

  checkThreshold(metric: string, currentValue: number) {
    for (const [name, threshold] of this.thresholds) {
      if (threshold.metric !== metric) continue;

      let triggered = false;
      switch (threshold.operator) {
        case '>':
          triggered = currentValue > threshold.value;
          break;
        case '<':
          triggered = currentValue < threshold.value;
          break;
        case '==':
          triggered = currentValue === threshold.value;
          break;
        case '>=':
          triggered = currentValue >= threshold.value;
          break;
      }

      if (triggered) {
        const lastAlert = this.alertCooldowns.get(name) || 0;
        if (Date.now() - lastAlert > this.cooldownMs) {
          this.alertCooldowns.set(name, Date.now());
          this.logger.warn(`Alert triggered: ${name}`, {
            alert: name,
            metric,
            currentValue,
            threshold: threshold.value,
            operator: threshold.operator,
          });
          threshold.callback();
        }
      }
    }
  }
}

// Export observability module
export const observability = {
  StructuredLogger,
  MetricsService,
  TracingInterceptor,
  HealthService,
  AlertService,
};

export default observability;
