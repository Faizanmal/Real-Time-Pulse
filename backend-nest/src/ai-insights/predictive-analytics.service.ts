/**
 * Enhanced Predictive Analytics Service
 * Provides ML-powered forecasting, anomaly detection, and trend analysis
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import OpenAI from 'openai';

interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

interface PredictionResult {
  predictions: { timestamp: Date; value: number; confidence: number }[];
  trend: 'up' | 'down' | 'stable';
  trendStrength: number;
  seasonality?: { period: number; strength: number };
}

interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  expectedRange: { min: number; max: number };
  severity: 'low' | 'medium' | 'high';
  possibleCauses?: string[];
}

@Injectable()
export class PredictiveAnalyticsService {
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
  }

  /**
   * Forecast future values using statistical methods
   */
  async forecast(
    data: TimeSeriesPoint[],
    horizonDays: number = 30,
  ): Promise<PredictionResult> {
    if (data.length < 7) {
      throw new Error('Insufficient data for forecasting (minimum 7 points)');
    }

    const values = data.map((d) => d.value);
    
    // Calculate basic statistics
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);
    const trend = this.calculateTrend(values);
    
    // Simple exponential smoothing for prediction
    const alpha = 0.3; // Smoothing factor
    let smoothed = values[0];
    
    const predictions: { timestamp: Date; value: number; confidence: number }[] = [];
    const lastDate = data[data.length - 1].timestamp;
    
    // Apply smoothing to existing data
    for (const value of values) {
      smoothed = alpha * value + (1 - alpha) * smoothed;
    }
    
    // Generate predictions
    for (let i = 1; i <= horizonDays; i++) {
      const predictedValue = smoothed + (trend.slope * i);
      const confidence = Math.max(0.5, 1 - (i * 0.02)); // Confidence decreases over time
      
      const predictionDate = new Date(lastDate);
      predictionDate.setDate(predictionDate.getDate() + i);
      
      predictions.push({
        timestamp: predictionDate,
        value: Math.max(0, predictedValue), // Ensure non-negative
        confidence,
      });
    }
    
    // Detect seasonality
    const seasonality = this.detectSeasonality(values);
    
    return {
      predictions,
      trend: trend.slope > 0.01 ? 'up' : trend.slope < -0.01 ? 'down' : 'stable',
      trendStrength: Math.abs(trend.rSquared),
      seasonality,
    };
  }

  /**
   * Detect anomalies in time series data
   */
  async detectAnomalies(
    data: TimeSeriesPoint[],
    sensitivityLevel: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<{ points: (TimeSeriesPoint & AnomalyResult)[]; summary: any }> {
    const values = data.map((d) => d.value);
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);
    
    // Z-score thresholds based on sensitivity
    const thresholds = { low: 3, medium: 2, high: 1.5 };
    const threshold = thresholds[sensitivityLevel];
    
    const results: (TimeSeriesPoint & AnomalyResult)[] = [];
    let anomalyCount = 0;
    
    for (const point of data) {
      const zScore = Math.abs((point.value - mean) / stdDev);
      const isAnomaly = zScore > threshold;
      
      if (isAnomaly) anomalyCount++;
      
      const expectedMin = mean - (threshold * stdDev);
      const expectedMax = mean + (threshold * stdDev);
      
      results.push({
        ...point,
        isAnomaly,
        score: zScore,
        expectedRange: { min: expectedMin, max: expectedMax },
        severity: zScore > 3 ? 'high' : zScore > 2 ? 'medium' : 'low',
      });
    }
    
    return {
      points: results,
      summary: {
        totalPoints: data.length,
        anomalyCount,
        anomalyRate: anomalyCount / data.length,
        mean,
        stdDev,
      },
    };
  }

  /**
   * Generate AI-powered insights from data
   */
  async generateInsights(
    data: any[],
    context: string,
  ): Promise<{ insights: string[]; recommendations: string[] }> {
    const cacheKey = `insights:${JSON.stringify(data).slice(0, 100)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data analyst assistant. Analyze the provided data and generate actionable insights and recommendations. 
                      Format response as JSON with "insights" and "recommendations" arrays.`,
          },
          {
            role: 'user',
            content: `Context: ${context}\n\nData: ${JSON.stringify(data.slice(0, 50))}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      await this.cache.set(cacheKey, JSON.stringify(result), 3600);
      return result;
    } catch (error) {
      this.logger.error(`AI insights generation failed: ${error}`, 'PredictiveAnalyticsService');
      return { insights: [], recommendations: [] };
    }
  }

  /**
   * Automated report generation with GPT-4
   */
  async generateReport(
    dashboardData: any,
    reportType: 'executive' | 'detailed' | 'technical',
  ): Promise<{ title: string; sections: any[]; summary: string }> {
    const prompts = {
      executive: 'Generate a concise executive summary highlighting key metrics, trends, and recommended actions.',
      detailed: 'Generate a detailed analysis with all metrics, comparisons, and in-depth insights.',
      technical: 'Generate a technical report with statistical analysis, methodology, and data quality notes.',
    };

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional report writer. ${prompts[reportType]} 
                      Format as JSON with "title", "sections" array (each with "heading" and "content"), and "summary".`,
          },
          {
            role: 'user',
            content: `Generate a ${reportType} report from this dashboard data: ${JSON.stringify(dashboardData)}`,
          },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      this.logger.error(`Report generation failed: ${error}`, 'PredictiveAnalyticsService');
      throw error;
    }
  }

  /**
   * Natural language query for data
   */
  async naturalLanguageQuery(
    query: string,
    availableMetrics: string[],
    workspaceId: string,
  ): Promise<{ response: string; data?: any; visualization?: any }> {
    try {
      // First, understand the query intent
      const intentResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data query assistant. Available metrics: ${availableMetrics.join(', ')}.
                      Parse the user's natural language query into a structured format.
                      Return JSON with: "metrics" (array), "timeRange" (start, end), "aggregation" (sum, avg, etc), "groupBy" (optional).`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const querySpec = JSON.parse(intentResponse.choices[0].message.content || '{}');

      // Execute the query (simplified - would connect to actual data source)
      const data = await this.executeStructuredQuery(querySpec, workspaceId);

      // Generate natural language response
      const nlResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful data analyst. Explain the query results in clear, conversational language.',
          },
          {
            role: 'user',
            content: `User asked: "${query}"\n\nResults: ${JSON.stringify(data)}`,
          },
        ],
        temperature: 0.5,
      });

      return {
        response: nlResponse.choices[0].message.content || 'Unable to generate response',
        data,
        visualization: this.suggestVisualization(querySpec),
      };
    } catch (error) {
      this.logger.error(`NL query failed: ${error}`, 'PredictiveAnalyticsService');
      throw error;
    }
  }

  /**
   * Correlation analysis between metrics
   */
  async analyzeCorrelations(
    datasets: { name: string; data: TimeSeriesPoint[] }[],
  ): Promise<{ correlations: any[]; strongestPairs: any[] }> {
    const correlations: any[] = [];

    for (let i = 0; i < datasets.length; i++) {
      for (let j = i + 1; j < datasets.length; j++) {
        const correlation = this.calculateCorrelation(
          datasets[i].data.map((d) => d.value),
          datasets[j].data.map((d) => d.value),
        );

        correlations.push({
          metric1: datasets[i].name,
          metric2: datasets[j].name,
          correlation,
          strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak',
          direction: correlation > 0 ? 'positive' : 'negative',
        });
      }
    }

    const strongestPairs = correlations
      .filter((c) => Math.abs(c.correlation) > 0.5)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 5);

    return { correlations, strongestPairs };
  }

  /**
   * Calculate trend using linear regression
   */
  private calculateTrend(values: number[]): { slope: number; intercept: number; rSquared: number } {
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, y, x) => sum + x * y, 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;

    // Calculate R-squared
    const yMean = ySum / n;
    const ssRes = values.reduce((sum, y, x) => sum + Math.pow(y - (slope * x + intercept), 2), 0);
    const ssTot = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const rSquared = 1 - ssRes / ssTot;

    return { slope, intercept, rSquared };
  }

  /**
   * Detect seasonality using autocorrelation
   */
  private detectSeasonality(values: number[]): { period: number; strength: number } | undefined {
    const possiblePeriods = [7, 14, 30, 90, 365]; // Weekly, bi-weekly, monthly, quarterly, yearly
    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (const period of possiblePeriods) {
      if (values.length < period * 2) continue;

      const original = values.slice(period);
      const lagged = values.slice(0, values.length - period);
      const correlation = Math.abs(this.calculateCorrelation(original, lagged));

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation > 0.5) {
      return { period: bestPeriod, strength: bestCorrelation };
    }

    return undefined;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);

    const xMean = this.calculateMean(xSlice);
    const yMean = this.calculateMean(ySlice);

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xSlice[i] - xMean;
      const yDiff = ySlice[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async executeStructuredQuery(spec: any, workspaceId: string): Promise<any> {
    // This would connect to your actual data sources
    // Simplified for demonstration
    return {
      query: spec,
      results: [],
      executed: true,
    };
  }

  private suggestVisualization(querySpec: any): any {
    if (querySpec.groupBy) {
      return { type: 'bar', reason: 'Grouped data works well with bar charts' };
    }
    if (querySpec.timeRange) {
      return { type: 'line', reason: 'Time series data is best shown with line charts' };
    }
    return { type: 'table', reason: 'Default visualization for structured data' };
  }
}
