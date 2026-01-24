/**
 * =============================================================================
 * REAL-TIME PULSE - ANALYTICS ENGINE
 * =============================================================================
 *
 * Advanced analytics processing with real-time aggregations,
 * trend detection, and predictive insights.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Types
interface MetricDataPoint {
  timestamp: Date;
  value: number;
  dimensions?: Record<string, string>;
}

interface TimeSeriesData {
  metricId: string;
  dataPoints: MetricDataPoint[];
  aggregation: AggregationType;
  interval: TimeInterval;
}

type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p95' | 'p99';
type TimeInterval = '1m' | '5m' | '15m' | '1h' | '6h' | '1d' | '7d' | '30d';

interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  percentChange: number;
  confidence: number;
  prediction?: number;
  anomaly?: boolean;
}

interface AggregatedMetric {
  metricId: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend: TrendAnalysis;
  sparkline: number[];
  breakdown?: Record<string, number>;
}

interface AnalyticsQuery {
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, string | string[]>;
  timeRange: {
    start: Date;
    end: Date;
  };
  interval: TimeInterval;
  aggregations: AggregationType[];
  groupBy?: string[];
  limit?: number;
}

interface AnalyticsResult {
  data: TimeSeriesData[];
  summary: AggregatedMetric[];
  insights: string[];
  executionTime: number;
}

interface DashboardMetrics {
  totalRevenue: AggregatedMetric;
  activeUsers: AggregatedMetric;
  conversionRate: AggregatedMetric;
  averageOrderValue: AggregatedMetric;
  customMetrics: AggregatedMetric[];
}

@Injectable()
export class AnalyticsEngine implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsEngine.name);
  private dataBuffer: Map<string, MetricDataPoint[]> = new Map();
  private aggregationCache: Map<string, { data: unknown; expiresAt: Date }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly BUFFER_SIZE = 10000;

  constructor(
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.startAggregationWorker();
    this.logger.log('Analytics Engine initialized');
  }

  // ============================================================================
  // DATA INGESTION
  // ============================================================================

  /**
   * Ingest single metric data point
   */
  async ingest(
    metricId: string,
    value: number,
    dimensions?: Record<string, string>,
  ): Promise<void> {
    const dataPoint: MetricDataPoint = {
      timestamp: new Date(),
      value,
      dimensions,
    };

    if (!this.dataBuffer.has(metricId)) {
      this.dataBuffer.set(metricId, []);
    }

    const buffer = this.dataBuffer.get(metricId);
    buffer.push(dataPoint);

    // Trim buffer if too large
    if (buffer.length > this.BUFFER_SIZE) {
      buffer.splice(0, buffer.length - this.BUFFER_SIZE);
    }

    // Emit event for real-time updates
    this.eventEmitter.emit('analytics.metric.ingested', {
      metricId,
      dataPoint,
    });
  }

  /**
   * Batch ingest multiple data points
   */
  async ingestBatch(metricId: string, dataPoints: MetricDataPoint[]): Promise<void> {
    if (!this.dataBuffer.has(metricId)) {
      this.dataBuffer.set(metricId, []);
    }

    const buffer = this.dataBuffer.get(metricId);
    buffer.push(...dataPoints);

    // Trim buffer
    if (buffer.length > this.BUFFER_SIZE) {
      buffer.splice(0, buffer.length - this.BUFFER_SIZE);
    }
  }

  // ============================================================================
  // QUERYING
  // ============================================================================

  /**
   * Execute analytics query
   */
  async query(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(query);

    // Check cache
    const cached = this.aggregationCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return {
        ...(cached.data as AnalyticsResult),
        executionTime: Date.now() - startTime,
      };
    }

    // Process query
    const data: TimeSeriesData[] = [];
    const summary: AggregatedMetric[] = [];

    for (const metricId of query.metrics) {
      const buffer = this.dataBuffer.get(metricId) || [];

      // Filter by time range
      const filtered = buffer.filter(
        (dp) => dp.timestamp >= query.timeRange.start && dp.timestamp <= query.timeRange.end,
      );

      // Apply dimension filters
      const dimensionFiltered = this.applyDimensionFilters(filtered, query.filters);

      // Aggregate data
      for (const aggregation of query.aggregations) {
        const timeSeries = this.aggregateTimeSeries(
          metricId,
          dimensionFiltered,
          aggregation,
          query.interval,
        );
        data.push(timeSeries);
      }

      // Calculate summary metrics
      const summaryMetric = this.calculateSummary(metricId, dimensionFiltered);
      summary.push(summaryMetric);
    }

    // Generate insights
    const insights = this.generateInsights(summary);

    const result: AnalyticsResult = {
      data,
      summary,
      insights,
      executionTime: Date.now() - startTime,
    };

    // Cache result
    this.aggregationCache.set(cacheKey, {
      data: result,
      expiresAt: new Date(Date.now() + this.CACHE_TTL),
    });

    return result;
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(
    workspaceId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<DashboardMetrics> {
    const range = timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    const previousRange = {
      start: new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime())),
      end: range.start,
    };

    // Calculate core metrics
    const [revenue, users, conversion, aov] = await Promise.all([
      this.getMetricWithComparison(`${workspaceId}:revenue`, range, previousRange),
      this.getMetricWithComparison(`${workspaceId}:active_users`, range, previousRange),
      this.getMetricWithComparison(`${workspaceId}:conversion_rate`, range, previousRange),
      this.getMetricWithComparison(`${workspaceId}:avg_order_value`, range, previousRange),
    ]);

    return {
      totalRevenue: revenue,
      activeUsers: users,
      conversionRate: conversion,
      averageOrderValue: aov,
      customMetrics: [],
    };
  }

  // ============================================================================
  // AGGREGATION
  // ============================================================================

  private aggregateTimeSeries(
    metricId: string,
    dataPoints: MetricDataPoint[],
    aggregation: AggregationType,
    interval: TimeInterval,
  ): TimeSeriesData {
    const buckets = this.bucketByInterval(dataPoints, interval);
    const aggregatedPoints: MetricDataPoint[] = [];

    for (const [timestamp, points] of buckets) {
      const values = points.map((p) => p.value);
      const aggregatedValue = this.aggregate(values, aggregation);

      aggregatedPoints.push({
        timestamp: new Date(timestamp),
        value: aggregatedValue,
      });
    }

    return {
      metricId,
      dataPoints: aggregatedPoints,
      aggregation,
      interval,
    };
  }

  private aggregate(values: number[], type: AggregationType): number {
    if (values.length === 0) return 0;

    switch (type) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'p50':
        return this.percentile(values, 50);
      case 'p95':
        return this.percentile(values, 95);
      case 'p99':
        return this.percentile(values, 99);
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private bucketByInterval(
    dataPoints: MetricDataPoint[],
    interval: TimeInterval,
  ): Map<number, MetricDataPoint[]> {
    const buckets = new Map<number, MetricDataPoint[]>();
    const intervalMs = this.intervalToMs(interval);

    for (const dp of dataPoints) {
      const bucketTime = Math.floor(dp.timestamp.getTime() / intervalMs) * intervalMs;

      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime).push(dp);
    }

    return buckets;
  }

  private intervalToMs(interval: TimeInterval): number {
    const intervals: Record<TimeInterval, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return intervals[interval];
  }

  // ============================================================================
  // TREND ANALYSIS
  // ============================================================================

  private calculateSummary(metricId: string, dataPoints: MetricDataPoint[]): AggregatedMetric {
    const values = dataPoints.map((dp) => dp.value);
    const currentValue = values.length > 0 ? this.aggregate(values, 'sum') : 0;

    // Calculate trend
    const trend = this.analyzeTrend(values);

    // Generate sparkline (last 24 data points or all if fewer)
    const sparklinePoints = dataPoints.slice(-24);
    const sparkline = sparklinePoints.map((dp) => dp.value);

    return {
      metricId,
      value: currentValue,
      trend,
      sparkline,
    };
  }

  private analyzeTrend(values: number[]): TrendAnalysis {
    if (values.length < 2) {
      return {
        direction: 'stable',
        percentChange: 0,
        confidence: 0,
      };
    }

    // Simple linear regression
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Calculate percent change
    const firstHalf = values.slice(0, Math.floor(n / 2));
    const secondHalf = values.slice(Math.floor(n / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const percentChange = firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    // Determine direction
    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(percentChange) < 1) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    // Calculate confidence based on R-squared
    const ssRes = values.reduce((sum, y, i) => {
      const predicted = yMean + slope * (i - xMean);
      return sum + (y - predicted) ** 2;
    }, 0);
    const ssTot = values.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    // Detect anomaly
    const stdDev = this.standardDeviation(values);
    const lastValue = values[values.length - 1];
    const anomaly = Math.abs(lastValue - yMean) > 2.5 * stdDev;

    // Predict next value
    const prediction = yMean + slope * n;

    return {
      direction,
      percentChange: Math.round(percentChange * 100) / 100,
      confidence: Math.round(Math.max(0, rSquared) * 100) / 100,
      prediction: Math.round(prediction * 100) / 100,
      anomaly,
    };
  }

  private standardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;

    return Math.sqrt(avgSquaredDiff);
  }

  // ============================================================================
  // INSIGHTS GENERATION
  // ============================================================================

  private generateInsights(metrics: AggregatedMetric[]): string[] {
    const insights: string[] = [];

    for (const metric of metrics) {
      // Trend insights
      if (metric.trend.direction === 'up' && metric.trend.percentChange > 10) {
        insights.push(
          `${metric.metricId} is trending up by ${metric.trend.percentChange}% with ${Math.round(metric.trend.confidence * 100)}% confidence`,
        );
      } else if (metric.trend.direction === 'down' && metric.trend.percentChange < -10) {
        insights.push(
          `⚠️ ${metric.metricId} is declining by ${Math.abs(metric.trend.percentChange)}%`,
        );
      }

      // Anomaly detection
      if (metric.trend.anomaly) {
        insights.push(
          `🔴 Anomaly detected in ${metric.metricId} - current value deviates significantly from normal`,
        );
      }

      // Prediction insights
      if (metric.trend.prediction && metric.trend.confidence > 0.7) {
        insights.push(
          `Based on current trends, ${metric.metricId} is predicted to reach ${metric.trend.prediction}`,
        );
      }
    }

    return insights;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private applyDimensionFilters(
    dataPoints: MetricDataPoint[],
    filters?: Record<string, string | string[]>,
  ): MetricDataPoint[] {
    if (!filters) return dataPoints;

    return dataPoints.filter((dp) => {
      if (!dp.dimensions) return true;

      for (const [key, value] of Object.entries(filters)) {
        const dpValue = dp.dimensions[key];
        if (!dpValue) return false;

        if (Array.isArray(value)) {
          if (!value.includes(dpValue)) return false;
        } else {
          if (dpValue !== value) return false;
        }
      }

      return true;
    });
  }

  private async getMetricWithComparison(
    metricId: string,
    currentRange: { start: Date; end: Date },
    previousRange: { start: Date; end: Date },
  ): Promise<AggregatedMetric> {
    const buffer = this.dataBuffer.get(metricId) || [];

    const currentData = buffer.filter(
      (dp) => dp.timestamp >= currentRange.start && dp.timestamp <= currentRange.end,
    );
    const previousData = buffer.filter(
      (dp) => dp.timestamp >= previousRange.start && dp.timestamp <= previousRange.end,
    );

    const currentValue =
      currentData.length > 0 ? currentData.reduce((sum, dp) => sum + dp.value, 0) : 0;
    const previousValue =
      previousData.length > 0 ? previousData.reduce((sum, dp) => sum + dp.value, 0) : 0;

    const change = currentValue - previousValue;
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

    const trend = this.analyzeTrend(currentData.map((dp) => dp.value));
    const sparkline = currentData.slice(-24).map((dp) => dp.value);

    return {
      metricId,
      value: currentValue,
      previousValue,
      change,
      changePercent: Math.round(changePercent * 100) / 100,
      trend,
      sparkline,
    };
  }

  private getCacheKey(query: AnalyticsQuery): string {
    return JSON.stringify({
      metrics: query.metrics.sort(),
      timeRange: query.timeRange,
      interval: query.interval,
      aggregations: query.aggregations.sort(),
    });
  }

  private startAggregationWorker(): void {
    // Cleanup old cache entries every minute
    setInterval(() => {
      const now = new Date();
      for (const [key, value] of this.aggregationCache) {
        if (value.expiresAt < now) {
          this.aggregationCache.delete(key);
        }
      }
    }, 60000);
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  async exportToCSV(query: AnalyticsQuery): Promise<string> {
    const result = await this.query(query);

    const headers = ['timestamp', ...query.metrics];
    const rows: string[][] = [];

    // Combine all time series data
    const timestampMap = new Map<string, Record<string, number>>();

    for (const series of result.data) {
      for (const dp of series.dataPoints) {
        const key = dp.timestamp.toISOString();
        if (!timestampMap.has(key)) {
          timestampMap.set(key, {});
        }
        timestampMap.get(key)[series.metricId] = dp.value;
      }
    }

    for (const [timestamp, values] of timestampMap) {
      const row = [timestamp];
      for (const metric of query.metrics) {
        row.push(String(values[metric] ?? ''));
      }
      rows.push(row);
    }

    // Sort by timestamp
    rows.sort((a, b) => a[0].localeCompare(b[0]));

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export default AnalyticsEngine;
