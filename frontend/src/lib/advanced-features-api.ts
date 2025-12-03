/**
 * Advanced Features API Client
 * 
 * This module provides API client functions for all 10 advanced features:
 * 1. Real-Time Collaborative Editing
 * 2. Custom Scripting Engine
 * 3. Data Pipeline Builder
 * 4. Advanced User Role Management
 * 5. Federated Data Search
 * 6. ML Model Marketplace
 * 7. Voice-Activated Dashboards
 * 8. Blockchain Data Integrity
 * 9. AR Visualization
 * 10. API Marketplace
 */

import { apiClient } from './api';

// ==================== 1. Collaboration API ====================
export interface CollaborationSession {
  id: string;
  portalId: string;
  createdBy: string;
  participants: Array<{
    odId: string;
    name: string;
    color: string;
    cursor?: { x: number; y: number };
    selection?: string;
    joinedAt: Date;
    lastActivity: Date;
  }>;
  createdAt: Date;
}

export const collaborationAPI = {
  createSession: async (portalId: string) => {
    const response = await apiClient.post('/collaboration/sessions', { portalId });
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await apiClient.get(`/collaboration/sessions/${sessionId}`);
    return response.data;
  },

  getActiveSessions: async (portalId: string) => {
    const response = await apiClient.get(`/collaboration/portals/${portalId}/sessions`);
    return response.data;
  },

  applyOperation: async (sessionId: string, operation: any) => {
    const response = await apiClient.post(`/collaboration/sessions/${sessionId}/operations`, operation);
    return response.data;
  },
};

// ==================== 2. Scripting API ====================
export interface UserScript {
  id: string;
  name: string;
  description?: string;
  code: string;
  type: 'calculation' | 'transformation' | 'aggregation' | 'visualization';
  version: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const scriptingAPI = {
  listScripts: async () => {
    const response = await apiClient.get('/scripting/scripts');
    return response.data;
  },

  getScript: async (scriptId: string) => {
    const response = await apiClient.get(`/scripting/scripts/${scriptId}`);
    return response.data;
  },

  createScript: async (data: Partial<UserScript>) => {
    const response = await apiClient.post('/scripting/scripts', data);
    return response.data;
  },

  updateScript: async (scriptId: string, data: Partial<UserScript>) => {
    const response = await apiClient.put(`/scripting/scripts/${scriptId}`, data);
    return response.data;
  },

  deleteScript: async (scriptId: string) => {
    const response = await apiClient.delete(`/scripting/scripts/${scriptId}`);
    return response.data;
  },

  executeScript: async (scriptId: string, context: Record<string, any>) => {
    const response = await apiClient.post(`/scripting/scripts/${scriptId}/execute`, { context });
    return response.data;
  },

  validateScript: async (code: string) => {
    const response = await apiClient.post('/scripting/validate', { code });
    return response.data;
  },

  getLibraries: async () => {
    const response = await apiClient.get('/scripting/libraries');
    return response.data;
  },

  getVersions: async (scriptId: string) => {
    const response = await apiClient.get(`/scripting/scripts/${scriptId}/versions`);
    return response.data;
  },

  rollback: async (scriptId: string, version: number) => {
    const response = await apiClient.post(`/scripting/scripts/${scriptId}/rollback`, { version });
    return response.data;
  },
};

// ==================== 3. Pipeline API ====================
export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  status: 'draft' | 'active' | 'paused' | 'error';
  schedule?: string;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineNode {
  id: string;
  type: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
}

export const pipelineAPI = {
  listPipelines: async () => {
    const response = await apiClient.get('/pipeline/pipelines');
    return response.data;
  },

  getPipeline: async (pipelineId: string) => {
    const response = await apiClient.get(`/pipeline/pipelines/${pipelineId}`);
    return response.data;
  },

  createPipeline: async (data: Partial<Pipeline>) => {
    const response = await apiClient.post('/pipeline/pipelines', data);
    return response.data;
  },

  updatePipeline: async (pipelineId: string, data: Partial<Pipeline>) => {
    const response = await apiClient.put(`/pipeline/pipelines/${pipelineId}`, data);
    return response.data;
  },

  deletePipeline: async (pipelineId: string) => {
    const response = await apiClient.delete(`/pipeline/pipelines/${pipelineId}`);
    return response.data;
  },

  executePipeline: async (pipelineId: string, inputData?: any) => {
    const response = await apiClient.post(`/pipeline/pipelines/${pipelineId}/execute`, { inputData });
    return response.data;
  },

  getRuns: async (pipelineId: string) => {
    const response = await apiClient.get(`/pipeline/pipelines/${pipelineId}/runs`);
    return response.data;
  },

  testConnection: async (connectorType: string, config: Record<string, any>) => {
    const response = await apiClient.post('/pipeline/connectors/test', { type: connectorType, config });
    return response.data;
  },

  getConnectorTypes: async () => {
    const response = await apiClient.get('/pipeline/connectors/types');
    return response.data;
  },
};

// ==================== 4. Role Management API ====================
export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  permissions: RolePermission[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermission {
  resourceType: string;
  resourceId?: string;
  actions: string[];
}

export const roleManagementAPI = {
  listRoles: async () => {
    const response = await apiClient.get('/role-management/roles');
    return response.data;
  },

  getRole: async (roleId: string) => {
    const response = await apiClient.get(`/role-management/roles/${roleId}`);
    return response.data;
  },

  createRole: async (data: Partial<CustomRole>) => {
    const response = await apiClient.post('/role-management/roles', data);
    return response.data;
  },

  updateRole: async (roleId: string, data: Partial<CustomRole>) => {
    const response = await apiClient.put(`/role-management/roles/${roleId}`, data);
    return response.data;
  },

  deleteRole: async (roleId: string) => {
    const response = await apiClient.delete(`/role-management/roles/${roleId}`);
    return response.data;
  },

  assignRole: async (userId: string, roleId: string, resourceType?: string, resourceId?: string) => {
    const response = await apiClient.post('/role-management/assignments', {
      userId,
      roleId,
      resourceType,
      resourceId,
    });
    return response.data;
  },

  revokeRole: async (assignmentId: string) => {
    const response = await apiClient.delete(`/role-management/assignments/${assignmentId}`);
    return response.data;
  },

  checkPermission: async (resourceType: string, resourceId: string, action: string) => {
    const response = await apiClient.post('/role-management/check', {
      resourceType,
      resourceId,
      action,
    });
    return response.data;
  },

  getTemplates: async () => {
    const response = await apiClient.get('/role-management/templates');
    return response.data;
  },
};

// ==================== 5. Federated Search API ====================
export interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  url?: string;
  score: number;
  highlights: string[];
  metadata: Record<string, any>;
}

export const federatedSearchAPI = {
  search: async (query: string, options?: {
    sources?: string[];
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
  }) => {
    const response = await apiClient.post('/federated-search/search', { query, ...options });
    return response.data;
  },

  semanticSearch: async (query: string, options?: {
    sources?: string[];
    limit?: number;
  }) => {
    const response = await apiClient.post('/federated-search/semantic', { query, ...options });
    return response.data;
  },

  getSources: async () => {
    const response = await apiClient.get('/federated-search/sources');
    return response.data;
  },

  getSuggestions: async (query: string) => {
    const response = await apiClient.get('/federated-search/suggestions', { params: { query } });
    return response.data;
  },
};

// ==================== 6. ML Marketplace API ====================
export interface MLModel {
  id: string;
  name: string;
  description?: string;
  type: 'timeseries' | 'classification' | 'clustering' | 'regression' | 'anomaly';
  version: string;
  accuracy?: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  metrics?: Record<string, number>;
  startedAt?: Date;
  completedAt?: Date;
}

export const mlMarketplaceAPI = {
  listModels: async () => {
    const response = await apiClient.get('/ml-marketplace/models');
    return response.data;
  },

  getModel: async (modelId: string) => {
    const response = await apiClient.get(`/ml-marketplace/models/${modelId}`);
    return response.data;
  },

  createModel: async (data: Partial<MLModel>) => {
    const response = await apiClient.post('/ml-marketplace/models', data);
    return response.data;
  },

  predict: async (modelId: string, data: any) => {
    const response = await apiClient.post(`/ml-marketplace/models/${modelId}/predict`, { data });
    return response.data;
  },

  trainModel: async (modelId: string, trainingData: any, config?: Record<string, any>) => {
    const response = await apiClient.post(`/ml-marketplace/models/${modelId}/train`, {
      trainingData,
      config,
    });
    return response.data;
  },

  getTrainingJob: async (jobId: string) => {
    const response = await apiClient.get(`/ml-marketplace/training/${jobId}`);
    return response.data;
  },

  browseMarketplace: async (filters?: { category?: string; search?: string }) => {
    const response = await apiClient.get('/ml-marketplace/marketplace', { params: filters });
    return response.data;
  },

  installModel: async (modelId: string) => {
    const response = await apiClient.post(`/ml-marketplace/marketplace/${modelId}/install`);
    return response.data;
  },
};

// ==================== 7. Voice API ====================
export interface VoiceAnnotation {
  id: string;
  portalId: string;
  widgetId?: string;
  transcript: string;
  audioUrl?: string;
  timestamp: number;
  createdAt: Date;
}

export const voiceAPI = {
  transcribe: async (audioFile: File, language?: string) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    if (language) formData.append('language', language);
    
    const response = await apiClient.post('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  processCommand: async (transcript: string) => {
    const response = await apiClient.post('/voice/command', { transcript });
    return response.data;
  },

  synthesize: async (text: string, options?: { voice?: string; rate?: number }) => {
    const response = await apiClient.post('/voice/synthesize', { text, ...options });
    return response.data;
  },

  createAnnotation: async (data: Partial<VoiceAnnotation>) => {
    const response = await apiClient.post('/voice/annotations', data);
    return response.data;
  },

  getAnnotations: async (portalId: string) => {
    const response = await apiClient.get(`/voice/annotations/${portalId}`);
    return response.data;
  },

  deleteAnnotation: async (portalId: string, annotationId: string) => {
    const response = await apiClient.delete(`/voice/annotations/${portalId}/${annotationId}`);
    return response.data;
  },

  getVoices: async () => {
    const response = await apiClient.get('/voice/voices');
    return response.data;
  },

  getLanguages: async () => {
    const response = await apiClient.get('/voice/languages');
    return response.data;
  },

  getCommands: async () => {
    const response = await apiClient.get('/voice/commands');
    return response.data;
  },

  describeWidget: async (widgetType: string, widgetData: any) => {
    const response = await apiClient.post('/voice/accessibility/describe', { widgetType, widgetData });
    return response.data;
  },
};

// ==================== 8. Blockchain API ====================
export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
  hash: string;
}

export interface IntegrityVerification {
  isValid: boolean;
  blocksVerified: number;
  entriesVerified: number;
  invalidBlocks: string[];
  invalidEntries: string[];
  verifiedAt: Date;
}

export const blockchainAPI = {
  createAuditEntry: async (data: {
    entityType: string;
    entityId: string;
    action: string;
    data: Record<string, any>;
  }) => {
    const response = await apiClient.post('/blockchain/audit', data);
    return response.data;
  },

  verifyIntegrity: async () => {
    const response = await apiClient.get('/blockchain/verify');
    return response.data;
  },

  verifyEntry: async (entryId: string) => {
    const response = await apiClient.get(`/blockchain/verify/${entryId}`);
    return response.data;
  },

  getAuditTrail: async (entityType: string, entityId: string) => {
    const response = await apiClient.get(`/blockchain/audit/${entityType}/${entityId}`);
    return response.data;
  },

  generateComplianceReport: async (options?: {
    startDate?: string;
    endDate?: string;
    entityTypes?: string[];
    actions?: string[];
  }) => {
    const response = await apiClient.get('/blockchain/compliance', { params: options });
    return response.data;
  },

  exportChain: async () => {
    const response = await apiClient.get('/blockchain/export');
    return response.data;
  },
};

// ==================== 9. AR Visualization API ====================
export interface ARScene {
  id: string;
  name: string;
  description?: string;
  type: 'portal' | 'widget' | 'custom';
  targetId?: string;
  config: ARSceneConfig;
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ARSceneConfig {
  visualizationType: '3d-chart' | 'spatial-data' | 'holographic' | 'overlay';
  dimensions: { width: number; height: number; depth: number };
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  animations: any[];
  interactions: any[];
}

export const arVisualizationAPI = {
  createScene: async (data: {
    name: string;
    description?: string;
    type: 'portal' | 'widget' | 'custom';
    targetId?: string;
    config?: Partial<ARSceneConfig>;
  }) => {
    const response = await apiClient.post('/ar/scenes', data);
    return response.data;
  },

  getScenes: async () => {
    const response = await apiClient.get('/ar/scenes');
    return response.data;
  },

  getScene: async (sceneId: string) => {
    const response = await apiClient.get(`/ar/scenes/${sceneId}`);
    return response.data;
  },

  updateScene: async (sceneId: string, data: Partial<ARScene>) => {
    const response = await apiClient.put(`/ar/scenes/${sceneId}`, data);
    return response.data;
  },

  deleteScene: async (sceneId: string) => {
    const response = await apiClient.delete(`/ar/scenes/${sceneId}`);
    return response.data;
  },

  getQRCode: async (sceneId: string, baseUrl?: string) => {
    const response = await apiClient.get(`/ar/scenes/${sceneId}/qr`, { params: { baseUrl } });
    return response.data;
  },

  createMarker: async (sceneId: string, data: {
    type: 'qr' | 'image' | 'location';
    location?: { lat: number; lng: number; radius: number };
  }) => {
    const response = await apiClient.post(`/ar/scenes/${sceneId}/markers`, data);
    return response.data;
  },

  getMarkers: async (sceneId?: string) => {
    const response = await apiClient.get('/ar/markers', { params: { sceneId } });
    return response.data;
  },

  convertTo3D: async (widgetType: string, widgetData: any) => {
    const response = await apiClient.post('/ar/convert', { widgetType, widgetData });
    return response.data;
  },

  generateSceneDefinition: async (data: {
    type: 'portal' | 'widget';
    targetId: string;
    visualizationType: string;
    data: any;
  }) => {
    const response = await apiClient.post('/ar/scene-definition', data);
    return response.data;
  },

  exportToAFrame: async (sceneDefinition: any) => {
    const response = await apiClient.post('/ar/export/aframe', { sceneDefinition });
    return response.data;
  },

  exportToThreeJS: async (sceneDefinition: any) => {
    const response = await apiClient.post('/ar/export/threejs', { sceneDefinition });
    return response.data;
  },
};

// ==================== 10. API Marketplace API ====================
export interface MarketplaceConnector {
  id: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  version: string;
  authType: 'none' | 'api_key' | 'oauth2' | 'basic';
  endpoints: any[];
  configSchema: Record<string, any>;
  rating: number;
  downloads: number;
  verified: boolean;
}

export interface CustomEndpoint {
  id: string;
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  authentication: 'none' | 'api_key' | 'bearer' | 'workspace';
  rateLimit: { requests: number; windowMs: number };
  status: 'active' | 'inactive' | 'draft';
  apiKey?: string;
  usageCount: number;
}

export const apiMarketplaceAPI = {
  // Marketplace Connectors
  getConnectors: async (filters?: { category?: string; search?: string; verified?: boolean }) => {
    const response = await apiClient.get('/api-marketplace/connectors', { params: filters });
    return response.data;
  },

  getConnector: async (connectorId: string) => {
    const response = await apiClient.get(`/api-marketplace/connectors/${connectorId}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await apiClient.get('/api-marketplace/connectors/categories');
    return response.data;
  },

  installConnector: async (connectorId: string, config: Record<string, any>, credentials?: Record<string, any>) => {
    const response = await apiClient.post(`/api-marketplace/connectors/${connectorId}/install`, {
      config,
      credentials,
    });
    return response.data;
  },

  getInstalledConnectors: async () => {
    const response = await apiClient.get('/api-marketplace/installed');
    return response.data;
  },

  uninstallConnector: async (installationId: string) => {
    const response = await apiClient.delete(`/api-marketplace/installed/${installationId}`);
    return response.data;
  },

  updateConnectorConfig: async (installationId: string, config: Record<string, any>) => {
    const response = await apiClient.put(`/api-marketplace/installed/${installationId}/config`, { config });
    return response.data;
  },

  publishConnector: async (connector: Partial<MarketplaceConnector>) => {
    const response = await apiClient.post('/api-marketplace/connectors/publish', connector);
    return response.data;
  },

  // Custom Endpoints
  createEndpoint: async (data: Partial<CustomEndpoint> & { dataSource: any }) => {
    const response = await apiClient.post('/api-marketplace/endpoints', data);
    return response.data;
  },

  getEndpoints: async () => {
    const response = await apiClient.get('/api-marketplace/endpoints');
    return response.data;
  },

  getEndpoint: async (endpointId: string) => {
    const response = await apiClient.get(`/api-marketplace/endpoints/${endpointId}`);
    return response.data;
  },

  updateEndpoint: async (endpointId: string, data: Partial<CustomEndpoint>) => {
    const response = await apiClient.put(`/api-marketplace/endpoints/${endpointId}`, data);
    return response.data;
  },

  deleteEndpoint: async (endpointId: string) => {
    const response = await apiClient.delete(`/api-marketplace/endpoints/${endpointId}`);
    return response.data;
  },

  activateEndpoint: async (endpointId: string) => {
    const response = await apiClient.post(`/api-marketplace/endpoints/${endpointId}/activate`);
    return response.data;
  },

  deactivateEndpoint: async (endpointId: string) => {
    const response = await apiClient.post(`/api-marketplace/endpoints/${endpointId}/deactivate`);
    return response.data;
  },

  regenerateApiKey: async (endpointId: string) => {
    const response = await apiClient.post(`/api-marketplace/endpoints/${endpointId}/regenerate-key`);
    return response.data;
  },

  executeEndpoint: async (endpointId: string, params: Record<string, any>) => {
    const response = await apiClient.post(`/api-marketplace/endpoints/${endpointId}/execute`, params);
    return response.data;
  },

  getEndpointStats: async (endpointId: string, days?: number) => {
    const response = await apiClient.get(`/api-marketplace/endpoints/${endpointId}/stats`, {
      params: { days },
    });
    return response.data;
  },

  // Endpoint Builder
  initBuilder: async () => {
    const response = await apiClient.get('/api-marketplace/builder/init');
    return response.data;
  },

  validateBuilderStep: async (step: any) => {
    const response = await apiClient.post('/api-marketplace/builder/validate', step);
    return response.data;
  },

  buildEndpoint: async (steps: any[]) => {
    const response = await apiClient.post('/api-marketplace/builder/build', steps);
    return response.data;
  },

  generateOpenAPI: async (endpoint: any) => {
    const response = await apiClient.post('/api-marketplace/builder/openapi', endpoint);
    return response.data;
  },

  generateCodeSamples: async (endpoint: any, baseUrl: string, apiKey?: string) => {
    const response = await apiClient.post('/api-marketplace/builder/code-samples', {
      endpoint,
      baseUrl,
      apiKey,
    });
    return response.data;
  },

  getDataSources: async () => {
    const response = await apiClient.get('/api-marketplace/builder/data-sources');
    return response.data;
  },
};

// Export all advanced feature APIs
export const advancedFeaturesAPI = {
  collaboration: collaborationAPI,
  scripting: scriptingAPI,
  pipeline: pipelineAPI,
  roleManagement: roleManagementAPI,
  federatedSearch: federatedSearchAPI,
  mlMarketplace: mlMarketplaceAPI,
  voice: voiceAPI,
  blockchain: blockchainAPI,
  arVisualization: arVisualizationAPI,
  apiMarketplace: apiMarketplaceAPI,
};
