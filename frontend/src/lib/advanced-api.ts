/**
 * Advanced Features API Client
 * Handles all API calls for new enterprise features
 */
import { apiClient } from './api';
import type {
  IndustryTemplate,
  IndustryDeployment,
  IndustryType,
  AIModel,
  AIPrediction,
  AIQuery,
  AIModelType,
  AIProvider,
  APIConnector,
  APIConnectorInstallation,
  APIUsageLog,
  APIConnectorType,
  ARScene,
  ARSession,
  ARMarker,
  Workflow,
  WorkflowExecution,
  WorkflowTemplate,
  ComplianceFramework,
  ComplianceAssessment,
  ComplianceDashboard,
  DataMapping,
  SecurityIncident,
  DataSensitivity,
  IncidentSeverity,
  IncidentCategory,
  IncidentStatus,
} from '../types/advanced-features';

// ========================================
// INDUSTRY-SPECIFIC SOLUTIONS
// ========================================

export const industryApi = {
  // Templates
  getTemplates: (industry?: IndustryType) => {
    return apiClient.get<IndustryTemplate[]>('/industry-solutions/templates', {
      params: { industry },
    });
  },

  getTemplate: (id: string) => {
    return apiClient.get<IndustryTemplate>(`/industry-solutions/templates/${id}`);
  },

  createTemplate: (data: {
    name: string;
    description?: string;
    industry: IndustryType;
    config: unknown;
    thumbnail?: string;
  }) => {
    return apiClient.post<IndustryTemplate>('/industry-solutions/templates', data);
  },

  deployTemplate: (templateId: string, data: { portalId: string; customizations?: Record<string, unknown> }) => {
    return apiClient.post<IndustryDeployment>(
      `/industry-solutions/templates/${templateId}/deploy`,
      data
    );
  },

  rateTemplate: (templateId: string, rating: number) => {
    return apiClient.post(`/industry-solutions/templates/${templateId}/rate`, { rating });
  },

  // Deployments
  getDeployments: () => {
    return apiClient.get<IndustryDeployment[]>('/industry-solutions/deployments');
  },

  updateComplianceStatus: (deploymentId: string, complianceStatus: string) => {
    return apiClient.patch<IndustryDeployment>(
      `/industry-solutions/deployments/${deploymentId}/compliance`,
      { complianceStatus }
    );
  },

  getComplianceCheck: (deploymentId: string) => {
    return apiClient.get(`/industry-solutions/deployments/${deploymentId}/compliance`);
  },

  // Healthcare specific
  getHealthcareTemplates: () => {
    return apiClient.get<IndustryTemplate[]>('/industry-solutions/healthcare/templates');
  },

  createHealthcareDashboard: (portalData: Record<string, unknown>) => {
    return apiClient.post('/industry-solutions/healthcare/dashboard', portalData);
  },
};

// ========================================
// ADVANCED AI/ML
// ========================================

export const advancedAiApi = {
  // Models
  getModels: (type?: AIModelType) => {
    return apiClient.get<AIModel[]>('/advanced-ai/models', { params: { type } });
  },

  getModel: (id: string) => {
    return apiClient.get<AIModel>(`/advanced-ai/models/${id}`);
  },

  createModel: (data: {
    name: string;
    description?: string;
    modelType: AIModelType;
    provider: AIProvider;
    modelId: string;
    config: Record<string, unknown>;
  }) => {
    return apiClient.post<AIModel>('/advanced-ai/models', data);
  },

  updateModel: (id: string, data: Partial<AIModel>) => {
    return apiClient.patch<AIModel>(`/advanced-ai/models/${id}`, data);
  },

  // Predictions
  createPrediction: (data: {
    modelId: string;
    inputData: unknown;
    widgetId?: string;
    portalId?: string;
  }) => {
    return apiClient.post<AIPrediction>('/advanced-ai/predictions', data);
  },

  getPredictions: (filters?: { modelId?: string; portalId?: string; widgetId?: string }) => {
    return apiClient.get<AIPrediction[]>('/advanced-ai/predictions', { params: filters });
  },

  // Natural Language Queries
  processQuery: (query: string, portalId?: string) => {
    return apiClient.post<AIQuery>('/advanced-ai/query', { query, portalId });
  },

  generateSQL: (query: string) => {
    return apiClient.post<AIQuery>('/advanced-ai/sql-generation', { query });
  },

  getQueries: () => {
    return apiClient.get<AIQuery[]>('/advanced-ai/queries');
  },

  // Forecasting
  forecastTimeSeries: (data: {
    widgetId: string;
    historicalData: Array<{ timestamp: Date; value: number }>;
    forecastPeriods: number;
  }) => {
    return apiClient.post<AIPrediction>('/advanced-ai/forecast', data);
  },

  // Anomaly Detection
  detectAnomalies: (data: {
    widgetId?: string;
    portalId?: string;
    timeSeries: Array<{ timestamp: Date; value: number }>;
  }) => {
    return apiClient.post('/advanced-ai/anomalies', data);
  },

  // Recommendations
  getRecommendations: (portalId: string) => {
    return apiClient.get(`/advanced-ai/recommendations/${portalId}`);
  },
};

// ========================================
// API MARKETPLACE
// ========================================

export const apiMarketplaceApi = {
  // Connectors
  getConnectors: (filters?: { category?: string; connectorType?: APIConnectorType }) => {
    return apiClient.get<APIConnector[]>('/api-marketplace/connectors', { params: filters });
  },

  getConnector: (id: string) => {
    return apiClient.get<APIConnector>(`/api-marketplace/connectors/${id}`);
  },

  createConnector: (data: {
    name: string;
    description?: string;
    connectorType: APIConnectorType;
    category: string;
    authType: string;
    configSchema: Record<string, unknown>;
    baseUrl?: string;
    iconUrl?: string;
    isPublic?: boolean;
  }) => {
    return apiClient.post<APIConnector>('/api-marketplace/connectors', data);
  },

  updateConnector: (id: string, data: Partial<APIConnector>) => {
    return apiClient.patch<APIConnector>(`/api-marketplace/connectors/${id}`, data);
  },

  deleteConnector: (id: string) => {
    return apiClient.delete(`/api-marketplace/connectors/${id}`);
  },

  // Installations
  installConnector: (connectorId: string, config: Record<string, unknown>, credentials: Record<string, unknown>) => {
    return apiClient.post<APIConnectorInstallation>('/api-marketplace/installations', {
      connectorId,
      config,
      credentials,
    });
  },

  getInstallations: () => {
    return apiClient.get<APIConnectorInstallation[]>('/api-marketplace/installations');
  },

  getInstallation: (id: string) => {
    return apiClient.get<APIConnectorInstallation>(`/api-marketplace/installations/${id}`);
  },

  updateInstallation: (
    id: string,
    data: { config?: Record<string, unknown>; credentials?: Record<string, unknown>; isActive?: boolean }
  ) => {
    return apiClient.patch<APIConnectorInstallation>(
      `/api-marketplace/installations/${id}`,
      data
    );
  },

  uninstallConnector: (id: string) => {
    return apiClient.delete(`/api-marketplace/installations/${id}`);
  },

  // Usage
  getUsageLogs: (installationId: string) => {
    return apiClient.get<APIUsageLog[]>(
      `/api-marketplace/installations/${installationId}/usage`
    );
  },

  getUsageStats: (installationId: string) => {
    return apiClient.get(`/api-marketplace/installations/${installationId}/stats`);
  },

  // Reviews
  createReview: (connectorId: string, rating: number, review?: string) => {
    return apiClient.post(`/api-marketplace/connectors/${connectorId}/reviews`, {
      rating,
      review,
    });
  },
};

// ========================================
// AR VISUALIZATION
// ========================================

export const arVisualizationApi = {
  // Scenes
  getScenes: () => {
    return apiClient.get<ARScene[]>('/ar-visualization/scenes');
  },

  getScene: (id: string) => {
    return apiClient.get<ARScene>(`/ar-visualization/scenes/${id}`);
  },

  createScene: (data: {
    name: string;
    description?: string;
    portalId?: string;
    sceneData: Record<string, unknown>;
    modelUrls: string[];
  }) => {
    return apiClient.post<ARScene>('/ar-visualization/scenes', data);
  },

  updateScene: (id: string, data: Partial<ARScene>) => {
    return apiClient.patch<ARScene>(`/ar-visualization/scenes/${id}`, data);
  },

  deleteScene: (id: string) => {
    return apiClient.delete(`/ar-visualization/scenes/${id}`);
  },

  // Sessions
  getSessions: (sceneId: string) => {
    return apiClient.get<ARSession[]>(`/ar-visualization/scenes/${sceneId}/sessions`);
  },
  getAllSessions: () => {
    return apiClient.get<ARSession[]>(`/ar-visualization/sessions`);
  },

  createSession: (sceneId: string, data: { deviceType: string }) => {
    return apiClient.post<ARSession>(`/ar-visualization/scenes/${sceneId}/sessions`, data);
  },
  startSession: (sceneId: string, deviceType: string) => {
    return apiClient.post<ARSession>(`/ar-visualization/scenes/${sceneId}/sessions`, { deviceType });
  },

  endSession: (sessionId: string, data?: { duration: number; interactions?: Record<string, unknown> }) => {
    return apiClient.patch(`/ar-visualization/sessions/${sessionId}/end`, data || {});
  },

  // Markers
  getMarkers: (sceneId?: string) => {
    const url = sceneId ? `/ar/markers?sceneId=${sceneId}` : '/ar/markers';
    return apiClient.get<ARMarker[]>(url);
  },

  createMarker: (sceneId: string, data: {
    type: 'qr' | 'image' | 'location';
    location?: { lat: number; lng: number; radius: number };
  }) => {
    return apiClient.post<ARMarker>(`/ar/scenes/${sceneId}/markers`, data);
  },

  deleteMarker: (markerId: string) => {
    return apiClient.delete(`/ar/markers/${markerId}`);
  },

  // QR Code generation
  getSceneQRCode: (sceneId: string, baseUrl?: string) => {
    const params = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : '';
    return apiClient.get<{ qrCode: string }>(`/ar/scenes/${sceneId}/qr${params}`);
  },

  // 3D Conversion
  convertTo3D: (widgetType: string, widgetData: unknown) => {
    return apiClient.post('/ar/convert', { widgetType, widgetData });
  },

  // Scene export
  exportToAFrame: (sceneDefinition: unknown) => {
    return apiClient.post<{ html: string }>('/ar/export/aframe', { sceneDefinition });
  },

  exportToThreeJS: (sceneDefinition: unknown) => {
    return apiClient.post('/ar/export/threejs', { sceneDefinition });
  },
};

// ========================================
// WORKFLOW AUTOMATION
// ========================================

export const workflowApi = {
  // Workflows
  getWorkflows: () => {
    return apiClient.get<Workflow[]>('/workflow-automation/workflows');
  },

  getWorkflow: (id: string) => {
    return apiClient.get<Workflow>(`/workflow-automation/workflows/${id}`);
  },

  createWorkflow: (data: {
    name: string;
    description?: string;
    trigger: Record<string, unknown>;
    actions: Record<string, unknown>;
    conditions?: Record<string, unknown>;
    nodes: Record<string, unknown>;
    edges: Record<string, unknown>;
  }) => {
    return apiClient.post<Workflow>('/workflow-automation/workflows', data);
  },

  updateWorkflow: (id: string, data: Partial<Workflow>) => {
    return apiClient.patch<Workflow>(`/workflow-automation/workflows/${id}`, data);
  },

  deleteWorkflow: (id: string) => {
    return apiClient.delete(`/workflow-automation/workflows/${id}`);
  },

  toggleWorkflow: (id: string, isActive: boolean) => {
    return apiClient.patch(`/workflow-automation/workflows/${id}/toggle`, { isActive });
  },

  // Execution
  executeWorkflow: (id: string, triggerData: Record<string, unknown>) => {
    return apiClient.post<WorkflowExecution>(`/workflow-automation/workflows/${id}/execute`, {
      triggerData,
    });
  },

  getExecutions: (workflowId: string) => {
    return apiClient.get<WorkflowExecution[]>(
      `/workflow-automation/workflows/${workflowId}/executions`
    );
  },

  getExecution: (id: string) => {
    return apiClient.get<WorkflowExecution>(`/workflow-automation/executions/${id}`);
  },

  retryExecution: (id: string) => {
    return apiClient.post<WorkflowExecution>(`/workflow-automation/executions/${id}/retry`);
  },

  // Templates
  getWorkflowTemplates: (category?: string) => {
    return apiClient.get<WorkflowTemplate[]>('/workflow-automation/templates', {
      params: { category },
    });
  },

  getWorkflowTemplate: (id: string) => {
    return apiClient.get<WorkflowTemplate>(`/workflow-automation/templates/${id}`);
  },

  createFromTemplate: (templateId: string, customizations?: Record<string, unknown>) => {
    return apiClient.post<Workflow>(`/workflow-automation/templates/${templateId}/create`, {
      customizations,
    });
  },
};

// ========================================
// ENHANCED COMPLIANCE
// ========================================

export const complianceApi = {
  // Frameworks
  getFrameworks: () => {
    return apiClient.get<ComplianceFramework[]>('/enhanced-compliance/frameworks');
  },

  getFramework: (id: string) => {
    return apiClient.get<ComplianceFramework>(`/enhanced-compliance/frameworks/${id}`);
  },

  createFramework: (data: {
    name: string;
    description?: string;
    requirements: Record<string, unknown>;
    controls: Record<string, unknown>;
    auditSchedule?: string;
  }) => {
    return apiClient.post<ComplianceFramework>('/enhanced-compliance/frameworks', data);
  },

  // Assessments
  createAssessment: (frameworkId: string) => {
    return apiClient.post<ComplianceAssessment>('/enhanced-compliance/assessments', {
      frameworkId,
    });
  },

  getAssessments: (frameworkId?: string) => {
    return apiClient.get<ComplianceAssessment[]>('/enhanced-compliance/assessments', {
      params: { frameworkId },
    });
  },

  getAssessment: (id: string) => {
    return apiClient.get<ComplianceAssessment>(`/enhanced-compliance/assessments/${id}`);
  },

  updateRemediationPlan: (id: string, remediationPlan: Record<string, unknown>, remediationStatus: string) => {
    return apiClient.patch<ComplianceAssessment>(
      `/enhanced-compliance/assessments/${id}/remediation`,
      { remediationPlan, remediationStatus }
    );
  },

  // Data Mapping
  createDataMapping: (data: {
    dataType: string;
    location: string;
    fields: Record<string, unknown>;
    sensitivity: DataSensitivity;
    category: string;
    processingPurpose: string;
    legalBasis?: string;
    retentionPeriod?: string;
  }) => {
    return apiClient.post<DataMapping>('/enhanced-compliance/data-mappings', data);
  },

  getDataMappings: (sensitivity?: DataSensitivity) => {
    return apiClient.get<DataMapping[]>('/enhanced-compliance/data-mappings', {
      params: { sensitivity },
    });
  },

  getDataMapping: (id: string) => {
    return apiClient.get<DataMapping>(`/enhanced-compliance/data-mappings/${id}`);
  },

  updateDataMapping: (id: string, data: Partial<DataMapping>) => {
    return apiClient.patch<DataMapping>(`/enhanced-compliance/data-mappings/${id}`, data);
  },

  deleteDataMapping: (id: string) => {
    return apiClient.delete(`/enhanced-compliance/data-mappings/${id}`);
  },

  // Security Incidents
  createIncident: (data: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    affectedSystems?: string[];
    affectedUsers?: string[];
    assignedTo?: string;
  }) => {
    return apiClient.post<SecurityIncident>('/enhanced-compliance/incidents', data);
  },

  getIncidents: (filters?: {
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    category?: IncidentCategory;
  }) => {
    return apiClient.get<SecurityIncident[]>('/enhanced-compliance/incidents', {
      params: filters,
    });
  },

  getIncident: (id: string) => {
    return apiClient.get<SecurityIncident>(`/enhanced-compliance/incidents/${id}`);
  },

  updateIncident: (id: string, data: Partial<SecurityIncident>) => {
    return apiClient.patch<SecurityIncident>(`/enhanced-compliance/incidents/${id}`, data);
  },

  // Dashboard
  getDashboard: () => {
    return apiClient.get<ComplianceDashboard>('/enhanced-compliance/dashboard');
  },
};
