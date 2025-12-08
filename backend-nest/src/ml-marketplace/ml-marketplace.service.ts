import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { MLModelExecutorService } from './ml-model-executor.service';

export interface MLModel {
  id: string;
  name: string;
  description: string;
  category:
    | 'forecasting'
    | 'anomaly_detection'
    | 'classification'
    | 'clustering'
    | 'nlp'
    | 'recommendation';
  version: string;
  author: string;
  isPublic: boolean;
  isPremium: boolean;
  price?: number;
  rating: number;
  downloads: number;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  config: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelDeployment {
  id: string;
  modelId: string;
  workspaceId: string;
  widgetId?: string;
  status: 'active' | 'paused' | 'failed';
  config: Record<string, any>;
  metrics: {
    predictions: number;
    avgLatency: number;
    errorRate: number;
  };
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface TrainingJob {
  id: string;
  workspaceId: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: Record<string, any>;
  trainingData: { source: string; config: Record<string, any> };
  metrics?: Record<string, number>;
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class MLMarketplaceService {
  private readonly logger = new Logger(MLMarketplaceService.name);

  // Pre-built models
  private readonly prebuiltModels: MLModel[] = [
    {
      id: 'model_forecast_timeseries',
      name: 'Time Series Forecaster',
      description:
        'Predict future values based on historical time series data using ARIMA and Prophet algorithms',
      category: 'forecasting',
      version: '1.2.0',
      author: 'Real-Time Pulse',
      isPublic: true,
      isPremium: false,
      rating: 4.7,
      downloads: 1250,
      inputSchema: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: { date: { type: 'string' }, value: { type: 'number' } },
          },
        },
        periods: { type: 'number', default: 7 },
        frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      },
      outputSchema: {
        predictions: {
          type: 'array',
          items: {
            date: { type: 'string' },
            predicted: { type: 'number' },
            confidence: { type: 'number' },
          },
        },
      },
      config: { algorithm: 'auto', seasonality: true },
      tags: ['forecasting', 'time-series', 'prediction'],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-06-20'),
    },
    {
      id: 'model_anomaly_statistical',
      name: 'Anomaly Detector',
      description:
        'Detect anomalies in metric data using statistical methods and isolation forests',
      category: 'anomaly_detection',
      version: '2.0.1',
      author: 'Real-Time Pulse',
      isPublic: true,
      isPremium: false,
      rating: 4.5,
      downloads: 980,
      inputSchema: {
        data: { type: 'array', items: { type: 'number' } },
        sensitivity: { type: 'number', min: 0, max: 1, default: 0.95 },
        windowSize: { type: 'number', default: 30 },
      },
      outputSchema: {
        anomalies: {
          type: 'array',
          items: {
            index: { type: 'number' },
            value: { type: 'number' },
            score: { type: 'number' },
          },
        },
        threshold: { type: 'number' },
      },
      config: { method: 'isolation_forest' },
      tags: ['anomaly', 'detection', 'monitoring'],
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-07-15'),
    },
    {
      id: 'model_sentiment_analysis',
      name: 'Sentiment Analyzer',
      description: 'Analyze sentiment in text data, comments, and feedback',
      category: 'nlp',
      version: '1.5.0',
      author: 'Real-Time Pulse',
      isPublic: true,
      isPremium: true,
      price: 29,
      rating: 4.8,
      downloads: 2100,
      inputSchema: {
        text: { type: 'string' },
        language: { type: 'string', default: 'en' },
      },
      outputSchema: {
        sentiment: {
          type: 'string',
          enum: ['positive', 'negative', 'neutral'],
        },
        confidence: { type: 'number' },
        emotions: { type: 'object' },
      },
      config: { model: 'transformer-based' },
      tags: ['nlp', 'sentiment', 'text-analysis'],
      createdAt: new Date('2024-03-05'),
      updatedAt: new Date('2024-08-01'),
    },
    {
      id: 'model_customer_segmentation',
      name: 'Customer Segmentation',
      description:
        'Automatically segment customers based on behavior and attributes using K-means clustering',
      category: 'clustering',
      version: '1.1.0',
      author: 'Real-Time Pulse',
      isPublic: true,
      isPremium: false,
      rating: 4.3,
      downloads: 650,
      inputSchema: {
        data: { type: 'array', items: { type: 'object' } },
        features: { type: 'array', items: { type: 'string' } },
        numClusters: { type: 'number', default: 5 },
      },
      outputSchema: {
        clusters: { type: 'array' },
        centroids: { type: 'array' },
        labels: { type: 'array' },
      },
      config: { algorithm: 'kmeans', normalize: true },
      tags: ['clustering', 'segmentation', 'customers'],
      createdAt: new Date('2024-04-20'),
      updatedAt: new Date('2024-09-10'),
    },
    {
      id: 'model_churn_prediction',
      name: 'Churn Predictor',
      description: 'Predict customer churn probability using gradient boosting',
      category: 'classification',
      version: '2.1.0',
      author: 'Real-Time Pulse',
      isPublic: true,
      isPremium: true,
      price: 49,
      rating: 4.6,
      downloads: 890,
      inputSchema: {
        customerData: { type: 'object' },
        features: { type: 'array', items: { type: 'string' } },
      },
      outputSchema: {
        churnProbability: { type: 'number' },
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        topFactors: { type: 'array' },
      },
      config: { algorithm: 'xgboost', threshold: 0.5 },
      tags: ['classification', 'churn', 'prediction'],
      createdAt: new Date('2024-05-15'),
      updatedAt: new Date('2024-10-05'),
    },
    {
      id: 'model_recommendation_engine',
      name: 'Smart Recommender',
      description:
        'Generate personalized recommendations using collaborative filtering',
      category: 'recommendation',
      version: '1.3.0',
      author: 'Real-Time Pulse',
      isPublic: true,
      isPremium: true,
      price: 39,
      rating: 4.4,
      downloads: 720,
      inputSchema: {
        userId: { type: 'string' },
        interactions: { type: 'array' },
        itemCatalog: { type: 'array' },
        numRecommendations: { type: 'number', default: 10 },
      },
      outputSchema: {
        recommendations: {
          type: 'array',
          items: { itemId: { type: 'string' }, score: { type: 'number' } },
        },
      },
      config: { algorithm: 'collaborative_filtering', similarity: 'cosine' },
      tags: ['recommendation', 'personalization', 'collaborative-filtering'],
      createdAt: new Date('2024-06-01'),
      updatedAt: new Date('2024-11-01'),
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly executor: MLModelExecutorService,
  ) {}

  /**
   * Get all available models
   */
  async getModels(options?: {
    category?: string;
    search?: string;
    isPremium?: boolean;
  }): Promise<MLModel[]> {
    let models = [...this.prebuiltModels];

    // Get custom models from cache
    const customModelsJson = await this.cache.get('ml:custom_models');
    if (customModelsJson) {
      const customModels: MLModel[] = JSON.parse(customModelsJson);
      models = [...models, ...customModels];
    }

    // Apply filters
    if (options?.category) {
      models = models.filter((m) => m.category === options.category);
    }

    if (options?.search) {
      const search = options.search.toLowerCase();
      models = models.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          m.description.toLowerCase().includes(search) ||
          m.tags.some((t) => t.toLowerCase().includes(search)),
      );
    }

    if (options?.isPremium !== undefined) {
      models = models.filter((m) => m.isPremium === options.isPremium);
    }

    return models;
  }

  /**
   * Get a model by ID
   */
  async getModel(modelId: string): Promise<MLModel> {
    const models = await this.getModels();
    const model = models.find((m) => m.id === modelId);

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    return model;
  }

  /**
   * Deploy a model to a workspace
   */
  async deployModel(
    workspaceId: string,
    modelId: string,
    config: { widgetId?: string; config?: Record<string, any> },
  ): Promise<ModelDeployment> {
    const model = await this.getModel(modelId);

    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const deployment: ModelDeployment = {
      id: deploymentId,
      modelId,
      workspaceId,
      widgetId: config.widgetId,
      status: 'active',
      config: config.config || {},
      metrics: {
        predictions: 0,
        avgLatency: 0,
        errorRate: 0,
      },
      createdAt: new Date(),
    };

    // Save deployment
    const key = `ml:deployments:${workspaceId}`;
    const deploymentsJson = await this.cache.get(key);
    const deployments: ModelDeployment[] = deploymentsJson
      ? JSON.parse(deploymentsJson)
      : [];
    deployments.push(deployment);

    await this.cache.set(key, JSON.stringify(deployments), 86400 * 365);

    this.logger.log(`Model ${modelId} deployed to workspace ${workspaceId}`);

    return deployment;
  }

  /**
   * Get workspace deployments
   */
  async getDeployments(workspaceId: string): Promise<ModelDeployment[]> {
    const key = `ml:deployments:${workspaceId}`;
    const deploymentsJson = await this.cache.get(key);
    return deploymentsJson ? JSON.parse(deploymentsJson) : [];
  }

  /**
   * Run prediction using a deployed model
   */
  async predict(
    workspaceId: string,
    deploymentId: string,
    input: Record<string, any>,
  ): Promise<any> {
    const deployments = await this.getDeployments(workspaceId);
    const deployment = deployments.find((d) => d.id === deploymentId);

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.status !== 'active') {
      throw new BadRequestException('Deployment is not active');
    }

    const model = await this.getModel(deployment.modelId);
    const startTime = Date.now();

    try {
      // Execute model
      const result = await this.executor.execute(
        model,
        input,
        deployment.config,
      );

      // Update metrics
      const latency = Date.now() - startTime;
      deployment.metrics.predictions++;
      deployment.metrics.avgLatency =
        (deployment.metrics.avgLatency * (deployment.metrics.predictions - 1) +
          latency) /
        deployment.metrics.predictions;
      deployment.lastUsedAt = new Date();

      // Save updated deployment
      const key = `ml:deployments:${workspaceId}`;
      const index = deployments.findIndex((d) => d.id === deploymentId);
      deployments[index] = deployment;
      await this.cache.set(key, JSON.stringify(deployments), 86400 * 365);

      return {
        success: true,
        result,
        latency,
        modelId: model.id,
        modelVersion: model.version,
      };
    } catch (error: any) {
      // Update error rate
      deployment.metrics.errorRate =
        (deployment.metrics.errorRate * deployment.metrics.predictions + 1) /
        (deployment.metrics.predictions + 1);
      deployment.metrics.predictions++;

      throw error;
    }
  }

  /**
   * Start a custom training job
   */
  async startTrainingJob(
    workspaceId: string,
    data: {
      modelId: string;
      trainingData: { source: string; config: Record<string, any> };
      config?: Record<string, any>;
    },
  ): Promise<TrainingJob> {
    const model = await this.getModel(data.modelId);

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: TrainingJob = {
      id: jobId,
      workspaceId,
      modelId: data.modelId,
      status: 'pending',
      config: data.config || {},
      trainingData: data.trainingData,
      progress: 0,
      createdAt: new Date(),
    };

    // Save job
    const key = `ml:training_jobs:${workspaceId}`;
    const jobsJson = await this.cache.get(key);
    const jobs: TrainingJob[] = jobsJson ? JSON.parse(jobsJson) : [];
    jobs.push(job);

    await this.cache.set(key, JSON.stringify(jobs), 86400 * 30);

    // Start training in background (simulated)
    this.runTrainingJob(workspaceId, jobId);

    return job;
  }

  /**
   * Get training jobs
   */
  async getTrainingJobs(workspaceId: string): Promise<TrainingJob[]> {
    const key = `ml:training_jobs:${workspaceId}`;
    const jobsJson = await this.cache.get(key);
    return jobsJson ? JSON.parse(jobsJson) : [];
  }

  /**
   * Run training job (simulated)
   */
  private async runTrainingJob(
    workspaceId: string,
    jobId: string,
  ): Promise<void> {
    const key = `ml:training_jobs:${workspaceId}`;

    // Update status to running
    const jobsJson = await this.cache.get(key);
    const jobs: TrainingJob[] = jobsJson ? JSON.parse(jobsJson) : [];
    const jobIndex = jobs.findIndex((j) => j.id === jobId);

    if (jobIndex === -1) return;

    jobs[jobIndex].status = 'running';
    await this.cache.set(key, JSON.stringify(jobs), 86400 * 30);

    // Simulate training progress
    for (let progress = 10; progress <= 100; progress += 10) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const currentJobsJson = await this.cache.get(key);
      const currentJobs: TrainingJob[] = currentJobsJson
        ? JSON.parse(currentJobsJson)
        : [];
      const currentJobIndex = currentJobs.findIndex((j) => j.id === jobId);

      if (currentJobIndex !== -1) {
        currentJobs[currentJobIndex].progress = progress;

        if (progress === 100) {
          currentJobs[currentJobIndex].status = 'completed';
          currentJobs[currentJobIndex].completedAt = new Date();
          currentJobs[currentJobIndex].metrics = {
            accuracy: 0.92,
            precision: 0.89,
            recall: 0.94,
            f1Score: 0.91,
          };
        }

        await this.cache.set(key, JSON.stringify(currentJobs), 86400 * 30);
      }
    }

    this.logger.log(`Training job ${jobId} completed`);
  }

  /**
   * Get model categories
   */
  getCategories() {
    return [
      {
        id: 'forecasting',
        name: 'Forecasting',
        description: 'Predict future values',
      },
      {
        id: 'anomaly_detection',
        name: 'Anomaly Detection',
        description: 'Detect unusual patterns',
      },
      {
        id: 'classification',
        name: 'Classification',
        description: 'Categorize data',
      },
      {
        id: 'clustering',
        name: 'Clustering',
        description: 'Group similar items',
      },
      { id: 'nlp', name: 'NLP', description: 'Natural language processing' },
      {
        id: 'recommendation',
        name: 'Recommendation',
        description: 'Personalized suggestions',
      },
    ];
  }
}
