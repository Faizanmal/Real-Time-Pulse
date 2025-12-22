import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIModelType, AIProvider, AIQueryType } from '@prisma/client';

@Injectable()
export class AdvancedAiService {
  constructor(private prisma: PrismaService) {}

  // AI Models Management
  async createModel(data: {
    name: string;
    description?: string;
    modelType: AIModelType;
    provider: AIProvider;
    modelId: string;
    config: any;
    workspaceId?: string;
  }) {
    return this.prisma.aIModel.create({
      data,
    });
  }

  async getModels(workspaceId?: string, modelType?: AIModelType) {
    return this.prisma.aIModel.findMany({
      where: {
        isActive: true,
        ...(workspaceId && { workspaceId }),
        ...(modelType && { modelType }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getModel(id: string) {
    const model = await this.prisma.aIModel.findUnique({
      where: { id },
    });

    if (!model) {
      throw new NotFoundException('AI Model not found');
    }

    return model;
  }

  async updateModel(id: string, data: any) {
    return this.prisma.aIModel.update({
      where: { id },
      data,
    });
  }

  // Predictions
  async createPrediction(data: {
    modelId: string;
    workspaceId: string;
    inputData: any;
    widgetId?: string;
    portalId?: string;
  }) {
    const model = await this.getModel(data.modelId);

    // Simulate AI prediction (integrate with actual AI service)
    const prediction = await this.runPrediction(model, data.inputData);

    return this.prisma.aIPrediction.create({
      data: {
        modelId: data.modelId,
        workspaceId: data.workspaceId,
        inputData: data.inputData,
        prediction: prediction.result,
        confidence: prediction.confidence,
        executionTime: prediction.executionTime,
        widgetId: data.widgetId,
        portalId: data.portalId,
      },
      include: {
        model: true,
      },
    });
  }

  async getPredictions(workspaceId: string, filters?: {
    modelId?: string;
    portalId?: string;
    widgetId?: string;
  }) {
    return this.prisma.aIPrediction.findMany({
      where: {
        workspaceId,
        ...filters,
      },
      include: {
        model: true,
        widget: true,
        portal: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // Natural Language Queries
  async processNaturalLanguageQuery(
    workspaceId: string,
    userId: string,
    query: string,
    portalId?: string,
  ) {
    // Find appropriate AI model for NLP
    const models = await this.getModels(workspaceId, AIModelType.NLP);
    const model = models[0];

    if (!model) {
      throw new NotFoundException('No NLP model available');
    }

    // Process query (integrate with OpenAI/Anthropic)
    const response = await this.processQuery(model, query, workspaceId, portalId);

    // Save query
    return this.prisma.aIQuery.create({
      data: {
        workspaceId,
        userId,
        modelId: model.id,
        query,
        queryType: AIQueryType.NATURAL_LANGUAGE,
        response: response.answer,
        sqlGenerated: response.sql,
        portalId,
      },
      include: {
        model: true,
      },
    });
  }

  async generateSQLFromNaturalLanguage(
    workspaceId: string,
    userId: string,
    query: string,
  ) {
    const models = await this.getModels(workspaceId, AIModelType.NLP);
    const model = models[0];

    if (!model) {
      throw new NotFoundException('No NLP model available');
    }

    // Generate SQL (integrate with AI service)
    const sql = await this.generateSQL(model, query);

    return this.prisma.aIQuery.create({
      data: {
        workspaceId,
        userId,
        modelId: model.id,
        query,
        queryType: AIQueryType.SQL_GENERATION,
        response: { sql },
        sqlGenerated: sql,
      },
    });
  }

  async getQueries(workspaceId: string, userId?: string) {
    return this.prisma.aIQuery.findMany({
      where: {
        workspaceId,
        ...(userId && { userId }),
      },
      include: {
        model: true,
        portal: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // Time Series Forecasting
  async forecastTimeSeries(
    workspaceId: string,
    data: {
      widgetId: string;
      historicalData: Array<{ timestamp: Date; value: number }>;
      forecastPeriods: number;
    },
  ) {
    const models = await this.getModels(workspaceId, AIModelType.FORECASTING);
    const model = models[0];

    if (!model) {
      throw new NotFoundException('No forecasting model available');
    }

    // Run forecasting algorithm
    const forecast = await this.runForecasting(model, data.historicalData, data.forecastPeriods);

    return this.prisma.aIPrediction.create({
      data: {
        modelId: model.id,
        workspaceId,
        inputData: { historicalData: data.historicalData },
        prediction: { forecast: forecast.predictions },
        confidence: forecast.confidence,
        executionTime: forecast.executionTime,
        widgetId: data.widgetId,
      },
    });
  }

  // Anomaly Detection
  async detectAnomalies(
    workspaceId: string,
    data: {
      widgetId?: string;
      portalId?: string;
      timeSeries: Array<{ timestamp: Date; value: number }>;
    },
  ) {
    const models = await this.getModels(workspaceId, AIModelType.ANOMALY_DETECTION);
    const model = models[0];

    if (!model) {
      throw new NotFoundException('No anomaly detection model available');
    }

    const anomalies = await this.runAnomalyDetection(model, data.timeSeries);

    return {
      anomalies,
      count: anomalies.length,
      model: model.name,
    };
  }

  // Recommendations
  async generateRecommendations(
    workspaceId: string,
    portalId: string,
  ) {
    const models = await this.getModels(workspaceId, AIModelType.RECOMMENDATION);
    const model = models[0];

    if (!model) {
      // Use default recommendation engine
      return this.getDefaultRecommendations(workspaceId, portalId);
    }

    const recommendations = await this.runRecommendationEngine(model, workspaceId, portalId);

    return recommendations;
  }

  // Private helper methods (simulate AI operations)
  private async runPrediction(model: any, inputData: any) {
    const startTime = Date.now();

    // Simulate AI prediction
    // In production, integrate with OpenAI, Anthropic, or custom model
    const result = {
      prediction: 'Sample prediction result',
      details: inputData,
    };

    return {
      result,
      confidence: 0.85,
      executionTime: Date.now() - startTime,
    };
  }

  private async processQuery(model: any, query: string, workspaceId: string, portalId?: string) {
    // Simulate NLP processing
    // In production, use OpenAI GPT-4, Claude, etc.
    
    const answer = {
      text: `Analysis for: ${query}`,
      insights: [
        'Insight 1 based on your data',
        'Insight 2 with recommendations',
      ],
      visualizations: [],
    };

    const sql = this.generateSQLFromQuery(query);

    return {
      answer,
      sql,
    };
  }

  private async generateSQL(model: any, query: string) {
    // Simulate SQL generation
    // In production, use AI to convert natural language to SQL
    return `SELECT * FROM portals WHERE name LIKE '%${query}%'`;
  }

  private async runForecasting(
    model: any,
    historicalData: Array<{ timestamp: Date; value: number }>,
    periods: number,
  ) {
    const startTime = Date.now();

    // Simple linear regression for demo
    const predictions = [];
    const values = historicalData.map(d => d.value);
    const avgGrowth = values.length > 1 
      ? (values[values.length - 1] - values[0]) / values.length 
      : 0;

    let lastValue = values[values.length - 1];
    
    for (let i = 0; i < periods; i++) {
      lastValue += avgGrowth;
      predictions.push({
        period: i + 1,
        value: Math.max(0, lastValue),
        confidence: Math.max(0.5, 1 - (i * 0.05)),
      });
    }

    return {
      predictions,
      confidence: 0.78,
      executionTime: Date.now() - startTime,
    };
  }

  private async runAnomalyDetection(
    model: any,
    timeSeries: Array<{ timestamp: Date; value: number }>,
  ) {
    // Simple z-score based anomaly detection for demo
    const values = timeSeries.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length,
    );

    const anomalies = [];
    const threshold = 2; // 2 standard deviations

    timeSeries.forEach((point, index) => {
      const zScore = Math.abs((point.value - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          zScore,
          severity: zScore > 3 ? 'HIGH' : 'MEDIUM',
        });
      }
    });

    return anomalies;
  }

  private async runRecommendationEngine(model: any, workspaceId: string, portalId: string) {
    // Simulate recommendation engine
    return this.getDefaultRecommendations(workspaceId, portalId);
  }

  private async getDefaultRecommendations(workspaceId: string, portalId: string) {
    // Get portal data
    const portal = await this.prisma.portal.findUnique({
      where: { id: portalId },
      include: {
        widgets: true,
      },
    });

    if (!portal) {
      return [];
    }

    const recommendations = [];

    // Check widget count
    if (portal.widgets.length < 3) {
      recommendations.push({
        type: 'ADD_WIDGETS',
        title: 'Add more widgets',
        description: 'Your dashboard has few widgets. Consider adding more visualizations.',
        priority: 'MEDIUM',
      });
    }

    // Check for data freshness
    const staleWidgets = portal.widgets.filter(w => {
      if (!w.lastRefreshedAt) return true;
      const hoursSinceRefresh = (Date.now() - w.lastRefreshedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceRefresh > 24;
    });

    if (staleWidgets.length > 0) {
      recommendations.push({
        type: 'UPDATE_DATA',
        title: 'Refresh stale data',
        description: `${staleWidgets.length} widgets have stale data. Consider refreshing them.`,
        priority: 'HIGH',
      });
    }

    return recommendations;
  }

  private generateSQLFromQuery(query: string): string {
    // Simple keyword-based SQL generation for demo
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('total') || lowerQuery.includes('count')) {
      return 'SELECT COUNT(*) as total FROM portals';
    }
    
    if (lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
      return 'SELECT * FROM portals ORDER BY created_at DESC LIMIT 10';
    }
    
    return 'SELECT * FROM portals';
  }
}
