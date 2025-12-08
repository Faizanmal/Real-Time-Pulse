/**
 * Type definitions for Advanced Features Hooks
 */

// Collaboration Types
export interface CollaborationSession {
  id: string;
  portalId: string;
  createdBy: string;
  createdAt: Date;
}

export interface CollaborationParticipant {
  odId: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string;
  joinedAt?: Date;
  lastActivity?: Date;
}

export interface CollaborationOperation {
  type: string;
  [key: string]: unknown;
}

// Scripting Types
export interface UserScript {
  id?: string;
  name: string;
  description?: string;
  code: string;
  type: 'calculation' | 'transformation' | 'aggregation' | 'visualization';
  version?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ScriptLibrary {
  name: string;
  description: string;
  version?: string;
}

// Pipeline Types
export interface PipelineNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}

export interface Pipeline {
  id: string;
  name: string;
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
  status?: 'draft' | 'active' | 'paused' | 'error' | string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface PipelineExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Role Management Types
export interface RolePermission {
  resourceType: string;
  resourceId?: string;
  actions: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: RolePermission[];
  isSystemRole?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}

// RolePermission already defined above — no need to redeclare here

// Federated Search Types
export interface SearchResult {
  id: string;
  type?: string;
  title: string;
  description?: string;
  url?: string;
  source?: string;
  score?: number;
  highlights?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SearchResponse {
  results: SearchResult[];
  total?: number;
  [key: string]: unknown;
}

export interface SearchSource {
  id: string;
  name: string;
  type: string;
  isEnabled?: boolean;
  [key: string]: unknown;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

// ML Marketplace Types
export interface MLModel {
  id: string;
  name: string;
  description?: string;
  type?: 'timeseries' | 'classification' | 'clustering' | 'regression' | 'anomaly' | string;
  version?: string;
  accuracy?: number;
  rating?: number;
  downloads?: number;
  isPublic?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

export interface MLPredictionResult {
  prediction: unknown;
  confidence?: number;
  [key: string]: unknown;
}

export interface MLTrainingConfig {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  [key: string]: unknown;
}

// Voice Types
export interface Voice {
  id: string;
  name: string;
  gender: string;
  description: string;
}

export interface VoiceCommand {
  id: string;
  phrase: string;
  action: string;
  parameters?: Record<string, unknown>;
  confidence: number;
}

export interface VoiceResult {
  transcript?: string;
  audioUrl?: string;
  [key: string]: unknown;
}

// Duplicate Role declaration removed (was mistakenly declared under Voice Types)
 

// Blockchain Types
export interface IntegrityResult {
  verified: boolean;
  timestamp?: Date;
  hash?: string;
  [key: string]: unknown;
}

export interface AuditEntry {
  id?: string;
  entityType: string;
  entityId: string;
  action: string;
  data?: Record<string, unknown>;
  timestamp?: string | Date;
  userId?: string;
}

export interface AuditTrailResponse {
  entries: AuditEntry[];
  total?: number;
}

export interface ComplianceReport {
  generated: Date;
  status: string;
  [key: string]: unknown;
}

// AR Visualization Types
export interface ARSceneConfig {
  visualizationType: '3d-chart' | 'spatial-data' | 'holographic' | 'overlay' | string;
  dimensions?: { width: number; height: number; depth: number };
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: number;
  animations?: unknown[];
  interactions?: unknown[];
}

export interface ARScene {
  id: string;
  name: string;
  description?: string;
  type?: 'portal' | 'widget' | 'custom' | string;
  targetId?: string;
  config?: ARSceneConfig;
  qrCode?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  widgets?: unknown[];
  [key: string]: unknown;
}

export interface ARSceneInput {
  name: string;
  description?: string;
  type: 'portal' | 'widget' | 'custom' | string;
  targetId?: string;
  config?: Partial<ARSceneConfig>;
  visualizationType?: '3d-chart' | 'spatial-data' | 'holographic' | 'overlay' | string;
}

export interface Conversion3DResult {
  modelUrl: string;
  success: boolean;
  [key: string]: unknown;
}

export interface QRCodeResult {
  url: string;
  data?: string;
}

// API Marketplace Types
export interface APIConnector {
  id: string;
  name: string;
  description?: string;
  category?: string;
  [key: string]: unknown;
}

export interface InstalledConnector extends APIConnector {
  installed: boolean;
  config?: Record<string, unknown>;
}

export interface CustomEndpoint {
  id?: string;
  name: string;
  path: string;
  method: string;
  handler?: string;
  [key: string]: unknown;
}

export interface EndpointCreationInput extends Partial<CustomEndpoint> {
  dataSource: unknown;
}

export interface EndpointCategory {
  name: string;
  description?: string;
}
