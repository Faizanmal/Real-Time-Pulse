export interface PipelineNode {
  id: string;
  type: 'source' | 'transform' | 'destination' | 'filter' | 'join' | 'aggregate';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Pipeline {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  schedule?: string;
  timezone?: string;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'failed' | 'running';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePipelineDto {
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  schedule?: string;
  timezone?: string;
}

export interface UpdatePipelineDto {
  name?: string;
  description?: string;
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
  schedule?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface ExecutionContext {
  data: Map<string, any[]>;
  errors: string[];
  stats: {
    rowsProcessed: number;
    rowsFiltered: number;
    rowsOutput: number;
    startTime: number;
    endTime?: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  stats: ExecutionContext['stats'];
  errors: string[];
  outputData?: any[];
}
