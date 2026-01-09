'use client';

import { apiClient } from './client';

export interface MLModel {
  id: string;
  name: string;
  description?: string;
  type: 'classification' | 'regression' | 'clustering' | 'timeseries' | 'anomaly';
  status: 'draft' | 'training' | 'ready' | 'failed' | 'deprecated';
  version: string;
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    mse?: number;
    mae?: number;
  };
  createdAt: string;
  updatedAt: string;
  trainedAt?: string;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  modelName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  metrics?: Record<string, number>;
}

export interface PredictionResult {
  prediction: unknown;
  confidence?: number;
  probabilities?: Record<string, number>;
  features?: Record<string, number>;
}

export interface CausalGraph {
  id: string;
  name: string;
  nodes: { id: string; name: string; type: string }[];
  edges: { source: string; target: string; weight?: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface FeatureAnalysis {
  features: {
    name: string;
    importance: number;
    correlation: number;
    type: string;
    missing: number;
    unique: number;
  }[];
  recommendations: string[];
}

export const mlApi = {
  // Models
  getModels: async (): Promise<MLModel[]> => {
    const response = await apiClient.get<MLModel[]>('/ml/models');
    return response;
  },

  getModel: async (id: string): Promise<MLModel> => {
    const response = await apiClient.get<MLModel>(`/ml/models/${id}`);
    return response;
  },

  createModel: async (data: {
    name: string;
    description?: string;
    type: MLModel['type'];
    config?: Record<string, unknown>;
    datasetId?: string;
  }): Promise<MLModel> => {
    const response = await apiClient.post('/ml/models', data);
    return response as MLModel;
  },

  deleteModel: async (id: string): Promise<void> => {
    await apiClient.delete(`/ml/models/${id}`);
  },

  trainModel: async (
    id: string,
    data: {
      datasetId?: string;
      parameters?: Record<string, unknown>;
    }
  ): Promise<TrainingJob> => {
    const response = await apiClient.post(`/ml/models/${id}/train`, data);
    return response as TrainingJob;
  },

  getTrainingJobs: async (modelId?: string): Promise<TrainingJob[]> => {
    const response = await apiClient.get<TrainingJob[]>('/ml/training-jobs', {
      params: modelId ? { modelId } : undefined,
    });
    return response as TrainingJob[];
  },

  predict: async (
    modelId: string,
    input: Record<string, unknown>
  ): Promise<PredictionResult> => {
    const response = await apiClient.post(`/ml/models/${modelId}/predict`, { input });
    return response as PredictionResult;
  },

  batchPredict: async (
    modelId: string,
    inputs: Record<string, unknown>[]
  ): Promise<PredictionResult[]> => {
    const response = await apiClient.post(`/ml/models/${modelId}/predict/batch`, { inputs });
    return response as PredictionResult[];
  },

  // Feature Analysis
  analyzeFeatures: async (data: {
    datasetId?: string;
    features?: string[];
  }): Promise<FeatureAnalysis> => {
    const response = await apiClient.post('/ml/features/analyze', data);
    return response as FeatureAnalysis;
  },

  // Causal Inference
  getCausalGraphs: async (): Promise<CausalGraph[]> => {
    const response = await apiClient.get<CausalGraph[]>('/ml/causal/graphs');
    return response;
  },

  getCausalGraph: async (id: string): Promise<CausalGraph> => {
    const response = await apiClient.get<CausalGraph>(`/ml/causal/graphs/${id}`);
    return response;
  },

  createCausalGraph: async (data: {
    name: string;
    nodes: CausalGraph['nodes'];
    edges: CausalGraph['edges'];
  }): Promise<CausalGraph> => {
    const response = await apiClient.post('/ml/causal/graphs', data);
    return response as CausalGraph;
  },

  updateCausalGraph: async (
    id: string,
    updates: Partial<CausalGraph>
  ): Promise<CausalGraph> => {
    const response = await apiClient.put(`/ml/causal/graphs/${id}`, updates);
    return response as CausalGraph;
  },

  deleteCausalGraph: async (id: string): Promise<void> => {
    await apiClient.delete(`/ml/causal/graphs/${id}`);
  },

  estimateCausalEffect: async (data: {
    graphId: string;
    treatment: string;
    outcome: string;
    confounders?: string[];
  }): Promise<{ effect: number; confidence: number }> => {
    const response = await apiClient.post('/ml/causal/estimate', data);
    return response as { effect: number; confidence: number };
  },

  computeCounterfactual: async (data: {
    graphId: string;
    intervention: Record<string, unknown>;
    query: string;
  }): Promise<{ result: unknown; probability: number }> => {
    const response = await apiClient.post('/ml/causal/counterfactual', data);
    return response as { result: unknown; probability: number };
  },

  analyzeABTest: async (data: {
    controlData: number[];
    treatmentData: number[];
    metric: string;
  }): Promise<{
    significant: boolean;
    pValue: number;
    effectSize: number;
    confidence: number;
  }> => {
    const response = await apiClient.post('/ml/causal/ab-test', data);
    return response as {
      significant: boolean;
      pValue: number;
      effectSize: number;
      confidence: number;
    };
  },

  sensitivityAnalysis: async (data: {
    graphId: string;
    effect: string;
  }): Promise<{ robust: boolean; bounds: [number, number] }> => {
    const response = await apiClient.post('/ml/causal/sensitivity', data);
    return response as { robust: boolean; bounds: [number, number] };
  },

  mediationAnalysis: async (data: {
    graphId: string;
    treatment: string;
    mediator: string;
    outcome: string;
  }): Promise<{ directEffect: number; indirectEffect: number; totalEffect: number }> => {
    const response = await apiClient.post('/ml/causal/mediation', data);
    return response as { directEffect: number; indirectEffect: number; totalEffect: number };
  },
};

