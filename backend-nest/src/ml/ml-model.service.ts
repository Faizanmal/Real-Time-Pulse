import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

export interface MLModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'timeseries' | 'anomaly' | 'nlp';
  framework: 'sklearn' | 'tensorflow' | 'pytorch' | 'xgboost' | 'custom';
  version: string;
  status: 'training' | 'ready' | 'failed' | 'archived';
  metrics: Record<string, number>;
  hyperparameters: Record<string, any>;
  features: string[];
  target?: string;
  createdAt: Date;
  trainedAt?: Date;
  deployedAt?: Date;
}

interface TrainingConfig {
  algorithm: string;
  hyperparameters?: Record<string, any>;
  validationSplit?: number;
  crossValidation?: number;
  maxIterations?: number;
  earlyStoppingPatience?: number;
  automl?: boolean;
}

interface PredictionRequest {
  modelId: string;
  features: Record<string, any>;
  options?: {
    explain?: boolean;
    threshold?: number;
  };
}

export interface PredictionResult {
  prediction: any;
  probability?: number;
  confidence?: number;
  explanation?: FeatureImportance[];
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  direction: 'positive' | 'negative';
}

interface AutoMLResult {
  bestModel: {
    algorithm: string;
    hyperparameters: Record<string, any>;
    score: number;
  };
  candidateModels: {
    algorithm: string;
    score: number;
    trainingTime: number;
  }[];
  featureImportance: FeatureImportance[];
}

@Injectable()
export class MLModelService {
  private readonly logger = new Logger(MLModelService.name);
  private readonly models = new Map<string, MLModel>();
  private readonly modelWeights = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Model Management
  async createModel(config: {
    name: string;
    type: MLModel['type'];
    framework: MLModel['framework'];
    features: string[];
    target?: string;
  }): Promise<MLModel> {
    const id = `model-${Date.now()}`;
    const model: MLModel = {
      id,
      name: config.name,
      type: config.type,
      framework: config.framework,
      version: '1.0.0',
      status: 'training',
      metrics: {},
      hyperparameters: {},
      features: config.features,
      target: config.target,
      createdAt: new Date(),
    };

    this.models.set(id, model);
    this.logger.log(`Created model: ${model.name} (${id})`);

    return model;
  }

  async getModels(): Promise<MLModel[]> {
    return Array.from(this.models.values());
  }

  async getModel(id: string): Promise<MLModel | undefined> {
    return this.models.get(id);
  }

  async deleteModel(id: string): Promise<void> {
    this.models.delete(id);
    this.modelWeights.delete(id);
  }

  // Training
  async trainModel(modelId: string, data: any[], config: TrainingConfig): Promise<MLModel> {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    this.logger.log(`Starting training for model ${model.name}`);
    model.status = 'training';

    try {
      if (config.automl) {
        const automlResult = await this.runAutoML(model, data, config);
        model.hyperparameters = automlResult.bestModel.hyperparameters;
        model.metrics = {
          ...model.metrics,
          automl_score: automlResult.bestModel.score,
        };
      }

      // Simulate training process
      const trainingResult = await this.executeTraining(model, data, config);

      model.metrics = trainingResult.metrics;
      model.hyperparameters = trainingResult.hyperparameters;
      model.status = 'ready';
      model.trainedAt = new Date();

      // Store model weights
      this.modelWeights.set(modelId, trainingResult.weights);

      this.eventEmitter.emit('ml.model.trained', {
        modelId,
        metrics: model.metrics,
      });

      this.logger.log(`Training completed for model ${model.name}`);
      return model;
    } catch (error) {
      model.status = 'failed';
      this.logger.error(`Training failed for model ${model.name}:`, error);
      throw error;
    }
  }

  private async executeTraining(
    model: MLModel,
    data: any[],
    config: TrainingConfig,
  ): Promise<{
    metrics: Record<string, number>;
    hyperparameters: Record<string, any>;
    weights: any;
  }> {
    // In production, call actual ML backend (Python microservice, SageMaker, etc.)
    await this.simulateDelay(2000);

    const baseMetrics = this.generateMockMetrics(model.type);
    const hyperparameters = {
      algorithm: config.algorithm,
      learningRate: config.hyperparameters?.learningRate || 0.01,
      maxDepth: config.hyperparameters?.maxDepth || 6,
      numEstimators: config.hyperparameters?.numEstimators || 100,
      regularization: config.hyperparameters?.regularization || 0.1,
    };

    return {
      metrics: baseMetrics,
      hyperparameters,
      weights: { mock: true, layers: [] },
    };
  }

  private generateMockMetrics(type: MLModel['type']): Record<string, number> {
    switch (type) {
      case 'classification':
        return {
          accuracy: 0.85 + Math.random() * 0.1,
          precision: 0.82 + Math.random() * 0.1,
          recall: 0.8 + Math.random() * 0.1,
          f1_score: 0.81 + Math.random() * 0.1,
          auc_roc: 0.88 + Math.random() * 0.08,
        };
      case 'regression':
        return {
          mse: 0.05 + Math.random() * 0.05,
          rmse: 0.22 + Math.random() * 0.1,
          mae: 0.18 + Math.random() * 0.08,
          r2_score: 0.85 + Math.random() * 0.1,
        };
      case 'clustering':
        return {
          silhouette_score: 0.6 + Math.random() * 0.2,
          calinski_harabasz: 200 + Math.random() * 100,
          davies_bouldin: 0.5 + Math.random() * 0.3,
        };
      case 'timeseries':
        return {
          mape: 5 + Math.random() * 5,
          smape: 4 + Math.random() * 4,
          rmse: 0.15 + Math.random() * 0.1,
        };
      case 'anomaly':
        return {
          precision: 0.9 + Math.random() * 0.08,
          recall: 0.85 + Math.random() * 0.1,
          f1_score: 0.87 + Math.random() * 0.08,
        };
      case 'nlp':
        return {
          accuracy: 0.88 + Math.random() * 0.08,
          bleu_score: 0.75 + Math.random() * 0.15,
          perplexity: 10 + Math.random() * 10,
        };
      default:
        return {};
    }
  }

  // AutoML
  async runAutoML(model: MLModel, _data: any[], _config: TrainingConfig): Promise<AutoMLResult> {
    this.logger.log(`Running AutoML for model ${model.name}`);

    const algorithms = this.getAlgorithmsForType(model.type);
    const candidates: AutoMLResult['candidateModels'] = [];

    for (const algorithm of algorithms) {
      const startTime = Date.now();
      await this.simulateDelay(500);

      const score = 0.7 + Math.random() * 0.25;
      candidates.push({
        algorithm,
        score,
        trainingTime: Date.now() - startTime,
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    const featureImportance: FeatureImportance[] = model.features
      .map((f) => ({
        feature: f,
        importance: Math.random(),
        direction: Math.random() > 0.5 ? ('positive' as const) : ('negative' as const),
      }))
      .sort((a, b) => b.importance - a.importance);

    return {
      bestModel: {
        algorithm: best.algorithm,
        hyperparameters: this.getDefaultHyperparameters(best.algorithm),
        score: best.score,
      },
      candidateModels: candidates,
      featureImportance,
    };
  }

  private getAlgorithmsForType(type: MLModel['type']): string[] {
    switch (type) {
      case 'classification':
        return ['random_forest', 'xgboost', 'logistic_regression', 'svm', 'neural_network'];
      case 'regression':
        return [
          'linear_regression',
          'ridge',
          'lasso',
          'random_forest',
          'xgboost',
          'neural_network',
        ];
      case 'clustering':
        return ['kmeans', 'dbscan', 'hierarchical', 'gaussian_mixture'];
      case 'timeseries':
        return ['arima', 'prophet', 'lstm', 'transformer'];
      case 'anomaly':
        return ['isolation_forest', 'one_class_svm', 'autoencoder', 'lof'];
      case 'nlp':
        return ['bert', 'gpt', 'lstm', 'transformer'];
      default:
        return [];
    }
  }

  private getDefaultHyperparameters(algorithm: string): Record<string, any> {
    const defaults: Record<string, any> = {
      random_forest: { n_estimators: 100, max_depth: 10, min_samples_split: 2 },
      xgboost: { n_estimators: 100, max_depth: 6, learning_rate: 0.1 },
      logistic_regression: { C: 1.0, max_iter: 100 },
      neural_network: { layers: [64, 32], dropout: 0.2, learning_rate: 0.001 },
      kmeans: { n_clusters: 5, max_iter: 300 },
      arima: { p: 1, d: 1, q: 1 },
      prophet: { seasonality_mode: 'additive' },
      lstm: { units: 64, layers: 2, dropout: 0.2 },
      isolation_forest: { n_estimators: 100, contamination: 0.1 },
    };

    return defaults[algorithm] || {};
  }

  // Prediction
  async predict(request: PredictionRequest): Promise<PredictionResult> {
    const model = this.models.get(request.modelId);
    if (!model) throw new Error(`Model ${request.modelId} not found`);
    if (model.status !== 'ready') throw new Error(`Model ${request.modelId} is not ready`);

    // Validate features
    const missingFeatures = model.features.filter((f) => !(f in request.features));
    if (missingFeatures.length > 0) {
      throw new Error(`Missing features: ${missingFeatures.join(', ')}`);
    }

    // Execute prediction
    const prediction = await this.executePrediction(model, request.features);

    const result: PredictionResult = {
      prediction: prediction.value,
      probability: prediction.probability,
      confidence: prediction.confidence,
    };

    // Add explanation if requested
    if (request.options?.explain) {
      result.explanation = this.generateExplanation(model, request.features);
    }

    return result;
  }

  private async executePrediction(
    model: MLModel,
    _features: Record<string, any>,
  ): Promise<{
    value: any;
    probability?: number;
    confidence?: number;
  }> {
    // In production, use actual model inference
    await this.simulateDelay(50);

    switch (model.type) {
      case 'classification': {
        const classes = ['A', 'B', 'C'];
        const probabilities = [Math.random(), Math.random(), Math.random()];
        const sum = probabilities.reduce((a, b) => a + b, 0);
        const normalized = probabilities.map((p) => p / sum);
        const maxIdx = normalized.indexOf(Math.max(...normalized));
        return {
          value: classes[maxIdx],
          probability: normalized[maxIdx],
          confidence: normalized[maxIdx] - (normalized.sort((a, b) => b - a)[1] || 0),
        };
      }

      case 'regression':
        return {
          value: Math.random() * 100,
          confidence: 0.8 + Math.random() * 0.15,
        };

      case 'clustering':
        return {
          value: Math.floor(Math.random() * 5),
          confidence: 0.7 + Math.random() * 0.2,
        };

      case 'anomaly': {
        const isAnomaly = Math.random() > 0.9;
        return {
          value: isAnomaly ? 'anomaly' : 'normal',
          probability: isAnomaly ? 0.85 : 0.15,
          confidence: 0.9,
        };
      }

      default:
        return { value: null };
    }
  }

  private generateExplanation(model: MLModel, _features: Record<string, any>): FeatureImportance[] {
    return model.features
      .map((feature) => ({
        feature,
        importance: Math.random(),
        direction: Math.random() > 0.5 ? ('positive' as const) : ('negative' as const),
      }))
      .sort((a, b) => b.importance - a.importance);
  }

  // Batch Prediction
  async batchPredict(
    modelId: string,
    dataPoints: Record<string, any>[],
  ): Promise<PredictionResult[]> {
    const results: PredictionResult[] = [];

    for (const features of dataPoints) {
      const result = await this.predict({ modelId, features });
      results.push(result);
    }

    return results;
  }

  // Feature Engineering
  async analyzeFeatures(
    data: any[],
    targetColumn: string,
  ): Promise<{
    features: {
      name: string;
      type: 'numeric' | 'categorical' | 'text' | 'datetime';
      stats: Record<string, any>;
      correlation?: number;
      importance?: number;
    }[];
    recommendations: string[];
  }> {
    const features = Object.keys(data[0] || {})
      .filter((k) => k !== targetColumn)
      .map((name) => {
        const values = data.map((d) => d[name]);
        const type = this.inferFeatureType(values);

        return {
          name,
          type,
          stats: this.calculateStats(values, type),
          correlation: Math.random() * 2 - 1,
          importance: Math.random(),
        };
      });

    features.sort((a, b) => (b.importance || 0) - (a.importance || 0));

    const recommendations = [
      'Consider one-hot encoding for categorical features',
      'Normalize numeric features for better convergence',
      'Remove features with low correlation to target',
      'Consider creating interaction features',
    ];

    return { features, recommendations };
  }

  private inferFeatureType(values: any[]): 'numeric' | 'categorical' | 'text' | 'datetime' {
    const sample = values.find((v) => v !== null && v !== undefined);
    if (typeof sample === 'number') return 'numeric';
    if (sample instanceof Date) return 'datetime';
    if (typeof sample === 'string') {
      if (sample.length > 50) return 'text';
      return 'categorical';
    }
    return 'categorical';
  }

  private calculateStats(values: any[], type: string): Record<string, any> {
    const nonNull = values.filter((v) => v !== null && v !== undefined);

    if (type === 'numeric') {
      const nums = nonNull.map(Number).filter((n) => !isNaN(n));
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const variance = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / nums.length;

      return {
        count: nums.length,
        mean,
        std: Math.sqrt(variance),
        min: Math.min(...nums),
        max: Math.max(...nums),
        nulls: values.length - nums.length,
      };
    }

    if (type === 'categorical') {
      const counts: Record<string, number> = {};
      for (const v of nonNull) {
        counts[String(v)] = (counts[String(v)] || 0) + 1;
      }

      return {
        unique: Object.keys(counts).length,
        top: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0],
        nulls: values.length - nonNull.length,
      };
    }

    return { count: nonNull.length };
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
