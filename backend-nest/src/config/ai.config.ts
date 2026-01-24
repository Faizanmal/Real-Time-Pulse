/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX AI/ML CONFIGURATION
 * ============================================================================
 * Advanced AI/ML configuration supporting multiple providers,
 * embeddings, vector search, and intelligent automation.
 */

import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  // Primary AI Provider
  provider: process.env.AI_PROVIDER || 'openai', // openai | anthropic | google | azure | local

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION,
    baseUrl: process.env.OPENAI_BASE_URL,
    models: {
      chat: process.env.OPENAI_CHAT_MODEL || 'gpt-4-turbo-preview',
      embedding: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
      vision: process.env.OPENAI_VISION_MODEL || 'gpt-4-vision-preview',
      code: process.env.OPENAI_CODE_MODEL || 'gpt-4-turbo-preview',
    },
    maxTokens: {
      chat: parseInt(process.env.OPENAI_MAX_TOKENS_CHAT || '4096', 10),
      embedding: parseInt(process.env.OPENAI_MAX_TOKENS_EMBEDDING || '8192', 10),
    },
    temperature: {
      default: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      creative: 0.9,
      precise: 0.3,
    },
  },

  // Anthropic Claude Configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: {
      chat: process.env.ANTHROPIC_CHAT_MODEL || 'claude-3-opus-20240229',
      fast: process.env.ANTHROPIC_FAST_MODEL || 'claude-3-haiku-20240307',
    },
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
  },

  // Google Gemini Configuration
  google: {
    apiKey: process.env.GOOGLE_AI_API_KEY,
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_AI_LOCATION || 'us-central1',
    models: {
      chat: 'gemini-pro',
      vision: 'gemini-pro-vision',
      embedding: 'textembedding-gecko',
    },
  },

  // Azure OpenAI Configuration
  azure: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    deployments: {
      chat: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
      embedding: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    },
  },

  // Local Model Configuration (Ollama, LMStudio, etc.)
  local: {
    enabled: process.env.LOCAL_AI_ENABLED === 'true',
    endpoint: process.env.LOCAL_AI_ENDPOINT || 'http://localhost:11434',
    model: process.env.LOCAL_AI_MODEL || 'llama2',
  },

  // Vector Database Configuration
  vectorDb: {
    provider: process.env.VECTOR_DB_PROVIDER || 'pinecone', // pinecone | weaviate | milvus | qdrant | pgvector

    pinecone: {
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
      indexName: process.env.PINECONE_INDEX_NAME || 'pulse-vectors',
      namespace: process.env.PINECONE_NAMESPACE || 'default',
    },

    weaviate: {
      host: process.env.WEAVIATE_HOST || 'localhost:8080',
      scheme: process.env.WEAVIATE_SCHEME || 'http',
      apiKey: process.env.WEAVIATE_API_KEY,
      className: process.env.WEAVIATE_CLASS_NAME || 'PulseDocument',
    },

    qdrant: {
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT || '6333', 10),
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION || 'pulse-vectors',
    },

    pgvector: {
      enabled: process.env.PGVECTOR_ENABLED === 'true',
      tableName: 'document_embeddings',
      dimensions: 1536,
    },
  },

  // RAG (Retrieval Augmented Generation) Configuration
  rag: {
    enabled: process.env.RAG_ENABLED === 'true',
    chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200', 10),
    topK: parseInt(process.env.RAG_TOP_K || '5', 10),
    similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.7'),
    reranking: {
      enabled: process.env.RAG_RERANKING_ENABLED === 'true',
      model: process.env.RAG_RERANKING_MODEL || 'cohere-rerank-v3',
    },
  },

  // AI Features Configuration
  features: {
    // Natural Language Queries
    nlq: {
      enabled: true,
      maxQueryLength: 500,
      contextWindow: 4000,
      examples: true,
    },

    // Predictive Analytics
    predictive: {
      enabled: true,
      models: ['trend', 'anomaly', 'forecast'],
      trainingDataMinDays: 30,
      forecastHorizon: 90, // days
    },

    // Anomaly Detection
    anomalyDetection: {
      enabled: true,
      sensitivityLevel: process.env.ANOMALY_SENSITIVITY || 'medium', // low | medium | high
      algorithms: ['isolation_forest', 'lstm', 'statistical'],
      minDataPoints: 100,
    },

    // Smart Recommendations
    recommendations: {
      enabled: true,
      maxRecommendations: 10,
      refreshInterval: 3600, // seconds
      personalization: true,
    },

    // Auto-Insights
    autoInsights: {
      enabled: true,
      schedule: '0 */6 * * *', // Every 6 hours
      batchSize: 50,
      severity: ['low', 'medium', 'high', 'critical'],
    },

    // Sentiment Analysis
    sentiment: {
      enabled: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh'],
    },

    // Auto-Summarization
    summarization: {
      enabled: true,
      maxLength: 500,
      format: 'bullet_points', // paragraph | bullet_points | executive
    },

    // Smart Alerting
    smartAlerting: {
      enabled: true,
      learningPeriod: 14, // days
      suppressDuplicates: true,
      correlateAlerts: true,
    },
  },

  // ML Pipeline Configuration
  pipeline: {
    // Feature Store
    featureStore: {
      enabled: process.env.FEATURE_STORE_ENABLED === 'true',
      provider: process.env.FEATURE_STORE_PROVIDER || 'redis', // redis | feast | tecton
      ttl: 86400, // 24 hours
    },

    // Model Registry
    modelRegistry: {
      enabled: process.env.MODEL_REGISTRY_ENABLED === 'true',
      provider: process.env.MODEL_REGISTRY_PROVIDER || 'mlflow', // mlflow | wandb | neptune
      endpoint: process.env.MODEL_REGISTRY_ENDPOINT,
    },

    // Training Configuration
    training: {
      batchSize: parseInt(process.env.ML_BATCH_SIZE || '32', 10),
      epochs: parseInt(process.env.ML_EPOCHS || '100', 10),
      learningRate: parseFloat(process.env.ML_LEARNING_RATE || '0.001'),
      validationSplit: 0.2,
      earlyStoppingPatience: 10,
    },

    // Inference Configuration
    inference: {
      batchSize: parseInt(process.env.ML_INFERENCE_BATCH_SIZE || '64', 10),
      timeout: parseInt(process.env.ML_INFERENCE_TIMEOUT || '30000', 10),
      caching: true,
      cacheTtl: 3600, // seconds
    },
  },

  // Rate Limiting for AI APIs
  rateLimiting: {
    enabled: true,
    requestsPerMinute: parseInt(process.env.AI_RATE_LIMIT_RPM || '60', 10),
    tokensPerMinute: parseInt(process.env.AI_RATE_LIMIT_TPM || '90000', 10),
    concurrentRequests: parseInt(process.env.AI_CONCURRENT_REQUESTS || '10', 10),
    retryAttempts: 3,
    retryDelay: 1000, // ms
    exponentialBackoff: true,
  },

  // Cost Management
  costManagement: {
    enabled: true,
    budgetPerMonth: parseFloat(process.env.AI_MONTHLY_BUDGET || '1000'), // USD
    alertThreshold: 0.8, // 80% of budget
    trackUsage: true,
    costPerToken: {
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
      'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
      'claude-3-opus': { input: 0.000015, output: 0.000075 },
    },
  },

  // Prompt Templates
  prompts: {
    systemPrompt: `You are an intelligent analytics assistant for Real-Time Pulse, a business intelligence platform. 
Your role is to help users understand their data, identify trends, and provide actionable insights.
Always be concise, accurate, and data-driven in your responses.`,

    templates: {
      dataAnalysis: 'Analyze the following data and provide key insights: {{data}}',
      trendDetection: 'Identify trends and patterns in: {{metrics}}',
      anomalyExplanation: 'Explain this anomaly in simple terms: {{anomaly}}',
      recommendation: 'Based on the data, what actions would you recommend? {{context}}',
      summary: 'Summarize the key points from this report: {{report}}',
      nlq: 'Convert this natural language query to a data query: "{{query}}"',
    },
  },

  // Caching Configuration
  caching: {
    enabled: true,
    provider: 'redis',
    ttl: {
      embeddings: 86400 * 7, // 7 days
      completions: 3600, // 1 hour
      analysis: 1800, // 30 minutes
    },
    maxCacheSize: 1000, // entries
  },
}));
