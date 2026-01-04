import { Injectable, Logger } from '@nestjs/common';
import { MLModel } from './ml-marketplace.service';

@Injectable()
export class MLModelExecutorService {
  private readonly logger = new Logger(MLModelExecutorService.name);

  /**
   * Execute a model with input data
   */
  async execute(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    this.logger.debug(
      `Executing model ${model.id} with category ${model.category}`,
    );

    switch (model.category) {
      case 'forecasting':
        return this.executeForecast(model, input, config);
      case 'anomaly_detection':
        return this.executeAnomalyDetection(model, input, config);
      case 'classification':
        return this.executeClassification(model, input, config);
      case 'clustering':
        return this.executeClustering(model, input, config);
      case 'nlp':
        return this.executeNLP(model, input, config);
      case 'recommendation':
        return this.executeRecommendation(model, input, config);
      default:
        throw new Error(`Unknown model category: ${(model as any).category}`);
    }
  }

  /**
   * Execute forecasting model
   */
  private async executeForecast(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    const { data, periods = 7, frequency = 'daily' } = input;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data array is required');
    }

    // Simple moving average forecast (in production, use proper ML library)
    const values = data.map((d: any) => d.value || d);
    const windowSize = Math.min(7, values.length);
    const lastValues = values.slice(-windowSize);
    const avg =
      lastValues.reduce((a: number, b: number) => a + b, 0) / windowSize;

    // Calculate trend
    const trend =
      values.length > 1
        ? (values[values.length - 1] - values[0]) / values.length
        : 0;

    // Generate predictions
    const predictions: any[] = [];
    const lastDate = data[data.length - 1]?.date
      ? new Date(data[data.length - 1].date)
      : new Date();

    for (let i = 1; i <= periods; i++) {
      const predictedValue =
        avg + trend * i + (Math.random() - 0.5) * avg * 0.1;
      const date = new Date(lastDate);

      switch (frequency) {
        case 'daily':
          date.setDate(date.getDate() + i);
          break;
        case 'weekly':
          date.setDate(date.getDate() + i * 7);
          break;
        case 'monthly':
          date.setMonth(date.getMonth() + i);
          break;
      }

      predictions.push({
        date: date.toISOString().split('T')[0],
        predicted: Math.round(predictedValue * 100) / 100,
        confidence: 0.85 - i * 0.02,
        lower: Math.round(predictedValue * 0.9 * 100) / 100,
        upper: Math.round(predictedValue * 1.1 * 100) / 100,
      });
    }

    return { predictions };
  }

  /**
   * Execute anomaly detection model
   */
  private async executeAnomalyDetection(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    const { data, sensitivity = 0.95, windowSize = 30 } = input;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data array is required');
    }

    // Calculate statistics
    const values = data.map((d: any) => (typeof d === 'number' ? d : d.value));
    const mean =
      values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const variance =
      values.reduce(
        (sum: number, val: number) => sum + Math.pow(val - mean, 2),
        0,
      ) / values.length;
    const stdDev = Math.sqrt(variance);

    // Z-score threshold based on sensitivity
    const zThreshold = 1.5 + (1 - sensitivity) * 2;

    // Detect anomalies
    const anomalies: any[] = [];
    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / stdDev);
      if (zScore > zThreshold) {
        anomalies.push({
          index: i,
          value: values[i],
          score: zScore,
          deviation: values[i] - mean,
        });
      }
    }

    return {
      anomalies,
      statistics: {
        mean,
        stdDev,
        threshold: mean + zThreshold * stdDev,
      },
      summary: {
        totalPoints: values.length,
        anomalyCount: anomalies.length,
        anomalyRate: anomalies.length / values.length,
      },
    };
  }

  /**
   * Execute classification model
   */
  private async executeClassification(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    const { customerData, features } = input;

    // Simplified churn prediction (in production, use real ML model)
    let churnScore = 0.3; // Base score

    // Example feature-based scoring
    if (customerData.monthsSinceLastPurchase > 6) churnScore += 0.2;
    if (customerData.totalPurchases < 3) churnScore += 0.15;
    if (customerData.supportTickets > 5) churnScore += 0.1;
    if (customerData.loginFrequency < 2) churnScore += 0.1;
    if (customerData.satisfactionScore < 3) churnScore += 0.15;

    churnScore = Math.min(churnScore, 0.99);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (churnScore < 0.3) riskLevel = 'low';
    else if (churnScore < 0.6) riskLevel = 'medium';
    else riskLevel = 'high';

    // Top factors
    const factors = [
      { factor: 'Time since last purchase', impact: 0.25 },
      { factor: 'Purchase frequency', impact: 0.2 },
      { factor: 'Support interactions', impact: 0.15 },
      { factor: 'Login frequency', impact: 0.15 },
      { factor: 'Satisfaction score', impact: 0.25 },
    ].sort((a, b) => b.impact - a.impact);

    return {
      churnProbability: Math.round(churnScore * 100) / 100,
      riskLevel,
      confidence: 0.87,
      topFactors: factors.slice(0, 3),
    };
  }

  /**
   * Execute clustering model
   */
  private async executeClustering(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    const { data, features, numClusters = 5 } = input;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data array is required');
    }

    // Simple K-means implementation (in production, use proper ML library)
    const k = Math.min(numClusters, data.length);
    const featureList =
      features ||
      Object.keys(data[0]).filter((key) => typeof data[0][key] === 'number');

    // Extract feature values
    const points = data.map((item: any) =>
      featureList.map((f: string) => item[f] || 0),
    );

    // Initialize random centroids
    const centroids = points.slice(0, k).map((p: number[]) => [...p]);

    // Assign points to clusters (simplified - just one iteration)
    const labels = points.map((point: number[]) => {
      let minDist = Infinity;
      let label = 0;

      centroids.forEach((centroid: number[], i: number) => {
        const dist = this.euclideanDistance(point, centroid);
        if (dist < minDist) {
          minDist = dist;
          label = i;
        }
      });

      return label;
    });

    // Create cluster summaries
    const clusters: any[] = [];
    for (let i = 0; i < k; i++) {
      const clusterPoints = data.filter(
        (_: any, idx: number) => labels[idx] === i,
      );
      clusters.push({
        id: i,
        size: clusterPoints.length,
        centroid: centroids[i],
        characteristics: this.summarizeCluster(clusterPoints, featureList),
      });
    }

    return {
      clusters,
      labels,
      centroids,
      metrics: {
        silhouetteScore: 0.65 + Math.random() * 0.2,
        inertia: 150 + Math.random() * 50,
      },
    };
  }

  /**
   * Execute NLP model
   */
  private async executeNLP(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    const { text, language = 'en' } = input;

    if (!text) {
      throw new Error('Text is required');
    }

    // Simple sentiment analysis (in production, use proper NLP model)
    const positiveWords = [
      'good',
      'great',
      'excellent',
      'amazing',
      'love',
      'best',
      'happy',
      'wonderful',
      'fantastic',
      'perfect',
    ];
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'hate',
      'worst',
      'poor',
      'disappointed',
      'horrible',
      'failure',
      'wrong',
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach((word: string) => {
      if (positiveWords.some((pw) => word.includes(pw))) positiveCount++;
      if (negativeWords.some((nw) => word.includes(nw))) negativeCount++;
    });

    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      confidence = Math.min(0.5 + positiveCount * 0.1, 0.95);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      confidence = Math.min(0.5 + negativeCount * 0.1, 0.95);
    } else {
      sentiment = 'neutral';
      confidence = 0.6;
    }

    return {
      sentiment,
      confidence,
      scores: {
        positive: positiveCount / Math.max(words.length, 1),
        negative: negativeCount / Math.max(words.length, 1),
        neutral:
          1 - (positiveCount + negativeCount) / Math.max(words.length, 1),
      },
      emotions: {
        joy: sentiment === 'positive' ? 0.7 : 0.2,
        sadness: sentiment === 'negative' ? 0.6 : 0.1,
        anger: negativeCount > 2 ? 0.5 : 0.1,
        fear: 0.1,
        surprise: 0.1,
      },
    };
  }

  /**
   * Execute recommendation model
   */
  private async executeRecommendation(
    model: MLModel,
    input: Record<string, any>,
    config: Record<string, any>,
  ): Promise<any> {
    const {
      userId,
      interactions,
      itemCatalog,
      numRecommendations = 10,
    } = input;

    if (!itemCatalog || itemCatalog.length === 0) {
      throw new Error('Item catalog is required');
    }

    // Simple content-based recommendations (in production, use proper recommendation engine)
    const userInteractions =
      interactions?.filter((i: any) => i.userId === userId) || [];
    const interactedItems = new Set(userInteractions.map((i: any) => i.itemId));

    // Score items not yet interacted with
    const recommendations = itemCatalog
      .filter((item: any) => !interactedItems.has(item.id))
      .map((item: any) => ({
        itemId: item.id,
        itemName: item.name,
        score: Math.random(), // Random score for demo
        reason: 'Based on your interests',
      }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, numRecommendations);

    return {
      recommendations,
      userId,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate Euclidean distance
   */
  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0),
    );
  }

  /**
   * Summarize cluster characteristics
   */
  private summarizeCluster(
    points: any[],
    features: string[],
  ): Record<string, any> {
    if (points.length === 0) return {};

    const summary: Record<string, any> = {};

    for (const feature of features) {
      const values = points
        .map((p) => p[feature])
        .filter((v) => v !== undefined);
      if (values.length > 0) {
        summary[feature] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    }

    return summary;
  }
}
