/**
 * =============================================================================
 * REAL-TIME PULSE - CORRELATION SERVICE
 * =============================================================================
 *
 * Manages correlation IDs for distributed tracing across the application.
 * Uses AsyncLocalStorage for request-scoped context propagation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface CorrelationContext {
  correlationId: string;
  parentSpanId?: string;
  spanId: string;
  traceId: string;
  userId?: string;
  workspaceId?: string;
  serviceName: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class CorrelationService {
  private readonly logger = new Logger(CorrelationService.name);
  private readonly storage = new AsyncLocalStorage<CorrelationContext>();
  private readonly serviceName: string;

  // Metrics tracking
  private metrics = {
    totalRequests: 0,
    activeRequests: 0,
    slowRequests: 0,
    errorCount: 0,
    avgResponseTime: 0,
    responseTimeSum: 0,
  };

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'real-time-pulse-api';
  }

  /**
   * Run a function within a correlation context
   */
  run<T>(context: Partial<CorrelationContext>, fn: () => T | Promise<T>): T | Promise<T> {
    const fullContext: CorrelationContext = {
      correlationId: context.correlationId || uuidv4(),
      spanId: uuidv4().substring(0, 16),
      traceId: context.traceId || uuidv4().replace(/-/g, ''),
      parentSpanId: context.parentSpanId,
      userId: context.userId,
      workspaceId: context.workspaceId,
      serviceName: this.serviceName,
      startTime: Date.now(),
      metadata: context.metadata || {},
    };

    this.metrics.totalRequests++;
    this.metrics.activeRequests++;

    return this.storage.run(fullContext, fn);
  }

  /**
   * Get current correlation context
   */
  getContext(): CorrelationContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.getContext()?.correlationId || 'no-correlation';
  }

  /**
   * Get current trace ID (for distributed tracing)
   */
  getTraceId(): string {
    return this.getContext()?.traceId || 'no-trace';
  }

  /**
   * Get current span ID
   */
  getSpanId(): string {
    return this.getContext()?.spanId || 'no-span';
  }

  /**
   * Add metadata to current context
   */
  addMetadata(key: string, value: unknown): void {
    const context = this.getContext();
    if (context) {
      context.metadata[key] = value;
    }
  }

  /**
   * Create child span for nested operations
   */
  createChildSpan(operationName: string): string {
    const context = this.getContext();
    const childSpanId = uuidv4().substring(0, 16);

    if (context) {
      this.logger.debug({
        message: `Creating child span: ${operationName}`,
        correlationId: context.correlationId,
        parentSpanId: context.spanId,
        childSpanId,
      });
    }

    return childSpanId;
  }

  /**
   * Mark request as complete and update metrics
   */
  completeRequest(success = true): void {
    const context = this.getContext();
    if (context) {
      const duration = Date.now() - context.startTime;

      this.metrics.activeRequests--;
      this.metrics.responseTimeSum += duration;
      this.metrics.avgResponseTime = this.metrics.responseTimeSum / this.metrics.totalRequests;

      if (duration > 5000) {
        this.metrics.slowRequests++;
      }

      if (!success) {
        this.metrics.errorCount++;
      }
    }
  }

  /**
   * Get headers for propagating correlation to external services
   */
  getPropagationHeaders(): Record<string, string> {
    const context = this.getContext();
    if (!context) {
      return {};
    }

    return {
      'X-Correlation-ID': context.correlationId,
      'X-Trace-ID': context.traceId,
      'X-Span-ID': context.spanId,
      'X-Parent-Span-ID': context.parentSpanId || '',
      'X-Service-Name': context.serviceName,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      activeRequests: 0,
      slowRequests: 0,
      errorCount: 0,
      avgResponseTime: 0,
      responseTimeSum: 0,
    };
  }

  /**
   * Create structured log entry with correlation context
   */
  createLogEntry(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
  ): Record<string, unknown> {
    const context = this.getContext();

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: context?.correlationId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      userId: context?.userId,
      workspaceId: context?.workspaceId,
      service: this.serviceName,
      duration: context ? Date.now() - context.startTime : undefined,
      ...data,
    };
  }
}
