// Advanced Features Types

// Industry-Specific Solutions
export enum IndustryType {
  HEALTHCARE = 'HEALTHCARE',
  FINANCE = 'FINANCE',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  EDUCATION = 'EDUCATION',
  REAL_ESTATE = 'REAL_ESTATE',
  LOGISTICS = 'LOGISTICS',
  HOSPITALITY = 'HOSPITALITY',
  TECHNOLOGY = 'TECHNOLOGY',
  GOVERNMENT = 'GOVERNMENT',
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string | null;
  industry: IndustryType;
  config: any;
  thumbnail: string | null;
  isActive: boolean;
  usageCount: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface IndustryDeployment {
  id: string;
  workspaceId: string;
  templateId: string;
  portalId: string;
  complianceStatus: any;
  lastComplianceCheck: string | null;
  customizations: any;
  createdAt: string;
  updatedAt: string;
  template?: IndustryTemplate;
  portal?: any;
}

// Advanced AI/ML
export enum AIModelType {
  FORECASTING = 'FORECASTING',
  CLASSIFICATION = 'CLASSIFICATION',
  CLUSTERING = 'CLUSTERING',
  ANOMALY_DETECTION = 'ANOMALY_DETECTION',
  NLP = 'NLP',
  COMPUTER_VISION = 'COMPUTER_VISION',
  RECOMMENDATION = 'RECOMMENDATION',
}

export enum AIProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GOOGLE = 'GOOGLE',
  CUSTOM = 'CUSTOM',
  HUGGINGFACE = 'HUGGINGFACE',
}

export interface AIModel {
  id: string;
  name: string;
  description: string | null;
  modelType: AIModelType;
  provider: AIProvider;
  modelId: string;
  config: any;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  isActive: boolean;
  isPublic: boolean;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIPrediction {
  id: string;
  modelId: string;
  workspaceId: string;
  inputData: any;
  prediction: any;
  confidence: number;
  widgetId: string | null;
  portalId: string | null;
  executionTime: number;
  createdAt: string;
  model?: AIModel;
}

export enum AIQueryType {
  NATURAL_LANGUAGE = 'NATURAL_LANGUAGE',
  SQL_GENERATION = 'SQL_GENERATION',
  DATA_ANALYSIS = 'DATA_ANALYSIS',
  INSIGHT_GENERATION = 'INSIGHT_GENERATION',
}

export interface AIQuery {
  id: string;
  workspaceId: string;
  userId: string;
  modelId: string | null;
  query: string;
  queryType: AIQueryType;
  response: any;
  sqlGenerated: string | null;
  portalId: string | null;
  createdAt: string;
  model?: AIModel;
}

// API Marketplace
export enum APIConnectorType {
  REST = 'REST',
  GRAPHQL = 'GRAPHQL',
  SOAP = 'SOAP',
  WEBHOOK = 'WEBHOOK',
  WEBSOCKET = 'WEBSOCKET',
  DATABASE = 'DATABASE',
  FILE = 'FILE',
}

export enum APIAuthType {
  API_KEY = 'API_KEY',
  OAUTH2 = 'OAUTH2',
  BASIC_AUTH = 'BASIC_AUTH',
  BEARER_TOKEN = 'BEARER_TOKEN',
  JWT = 'JWT',
  CUSTOM = 'CUSTOM',
}

export interface APIConnector {
  id: string;
  name: string;
  description: string | null;
  connectorType: APIConnectorType;
  category: string;
  authType: APIAuthType;
  baseUrl: string | null;
  apiVersion: string | null;
  configSchema: any;
  iconUrl: string | null;
  logoUrl: string | null;
  publisherId: string | null;
  publisherName: string | null;
  workspaceId: string | null;
  isPublic: boolean;
  price: number;
  rating: number;
  downloads: number;
  usageCount: number;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface APIConnectorInstallation {
  id: string;
  connectorId: string;
  workspaceId: string;
  config: any;
  credentials: any;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
  installedAt: string;
  updatedAt: string;
  connector?: APIConnector;
}

export interface APIUsageLog {
  id: string;
  installationId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  dataSize: number;
  errorMessage: string | null;
  timestamp: string;
}

// AR Visualization
export interface ARScene {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  portalId: string | null;
  sceneData: any;
  arMarkers: any;
  modelUrls: any;
  textureUrls: any;
  interactions: any;
  scale: number;
  lighting: any;
  sceneType?: string;
  type?: string;
  config?: any;
  objects?: any[];
  dataSources?: any[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ARSession {
  id: string;
  sceneId: string;
  userId: string;
  deviceType: string;
  duration: number;
  interactions: any;
  fps: number | null;
  latency: number | null;
  status?: string;
  deviceInfo?: { type: string };
  startTime?: string;
  startedAt: string;
  endedAt: string | null;
}

export interface ARMarker {
  id: string;
  sceneId: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  data: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Workflow Automation
export enum WorkflowExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  trigger: any;
  actions: any;
  conditions: any;
  nodes: any;
  edges: any;
  isActive: boolean;
  version: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt: string | null;
  averageExecutionTime: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggerData: any;
  status: WorkflowExecutionStatus;
  steps: any;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  errorStep: string | null;
  retryCount: number;
  workflow?: Workflow;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  template: any;
  thumbnail: string | null;
  isPublic: boolean;
  rating: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTrigger {
  type: string;
  config: any;
  conditions?: any;
}

export interface WorkflowAction {
  type: string;
  config: any;
  order: number;
}

export interface WorkflowCondition {
  type: string;
  config: any;
  operator: string;
  value: any;
}

// Enhanced Compliance
export enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  PARTIALLY_COMPLIANT = 'PARTIALLY_COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  NOT_ASSESSED = 'NOT_ASSESSED',
}

export interface ComplianceFramework {
  id: string;
  name: string;
  description: string | null;
  requirements: any;
  controls: any;
  auditSchedule: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceAssessment {
  id: string;
  workspaceId: string;
  frameworkId: string;
  status: ComplianceStatus;
  score: number;
  findings: any;
  gaps: any;
  recommendations: any;
  remediationPlan: any;
  remediationStatus: string | null;
  assessedAt: string;
  assessedBy: string | null;
  nextAssessmentDue: string | null;
  reportUrl: string | null;
  framework?: ComplianceFramework;
}

export enum DataSensitivity {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

export interface DataMapping {
  id: string;
  workspaceId: string;
  dataType: string;
  location: string;
  fields: any;
  sensitivity: DataSensitivity;
  category: string;
  processingPurpose: string;
  legalBasis: string | null;
  retentionPeriod: string | null;
  encryptionMethod: string | null;
  accessControls: any;
  createdAt: string;
  updatedAt: string;
}

export enum IncidentSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum IncidentCategory {
  DATA_BREACH = 'DATA_BREACH',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  MALWARE = 'MALWARE',
  PHISHING = 'PHISHING',
  DOS_ATTACK = 'DOS_ATTACK',
  INSIDER_THREAT = 'INSIDER_THREAT',
  MISCONFIGURATION = 'MISCONFIGURATION',
  OTHER = 'OTHER',
}

export enum IncidentStatus {
  DETECTED = 'DETECTED',
  INVESTIGATING = 'INVESTIGATING',
  CONTAINED = 'CONTAINED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface SecurityIncident {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  detectedAt: string;
  reportedAt: string | null;
  resolvedAt: string | null;
  affectedSystems: any;
  affectedUsers: any;
  rootCause: string | null;
  responseActions: any;
  status: IncidentStatus;
  assignedTo: string | null;
  lessonsLearned: string | null;
  preventiveMeasures: any;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceDashboard {
  overview: {
    complianceScore: number;
    complianceStatus: ComplianceStatus;
    lastAssessment: string | null;
    nextAssessment: string | null;
  };
  incidents: {
    total: number;
    open: number;
    critical: number;
    recent: SecurityIncident[];
  };
  dataInventory: {
    total: number;
    sensitive: number;
    byCategory: Record<string, number>;
    bySensitivity: Record<string, number>;
  };
  frameworks: ComplianceFramework[];
}
