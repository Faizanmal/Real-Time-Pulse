/**
 * Workflow Automation API Client
 */
import { apiClient } from './client';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'webhook' | 'manual';
  config: Record<string, unknown>;
}

export interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: string;
  value: unknown;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggerData: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

class WorkflowsApi {
  // Workflow CRUD
  async getWorkflows(): Promise<Workflow[]> {
    return apiClient.get<Workflow[]>('/workflow-automation/workflows');
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return apiClient.get<Workflow>(`/workflow-automation/workflows/${id}`);
  }

  async createWorkflow(data: CreateWorkflowDto): Promise<Workflow> {
    return apiClient.post<Workflow>('/workflow-automation/workflows', data);
  }

  async updateWorkflow(id: string, data: Partial<CreateWorkflowDto>): Promise<Workflow> {
    return apiClient.patch<Workflow>(`/workflow-automation/workflows/${id}`, data);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return apiClient.delete(`/workflow-automation/workflows/${id}`);
  }

  async toggleWorkflow(id: string, isActive: boolean): Promise<Workflow> {
    return apiClient.patch<Workflow>(`/workflow-automation/workflows/${id}/toggle`, { isActive });
  }

  // Execution
  async executeWorkflow(id: string, triggerData: Record<string, unknown>): Promise<WorkflowExecution> {
    return apiClient.post<WorkflowExecution>(`/workflow-automation/workflows/${id}/execute`, { triggerData });
  }

  async getExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    return apiClient.get<WorkflowExecution[]>(`/workflow-automation/workflows/${workflowId}/executions`);
  }

  async getExecution(executionId: string): Promise<WorkflowExecution> {
    return apiClient.get<WorkflowExecution>(`/workflow-automation/executions/${executionId}`);
  }

  async retryExecution(executionId: string): Promise<WorkflowExecution> {
    return apiClient.post<WorkflowExecution>(`/workflow-automation/executions/${executionId}/retry`, {});
  }

  // Templates
  async getTemplates(): Promise<Workflow[]> {
    return apiClient.get<Workflow[]>('/workflow-automation/templates');
  }

  async createFromTemplate(templateId: string, name: string): Promise<Workflow> {
    return apiClient.post<Workflow>(`/workflow-automation/templates/${templateId}/create`, { name });
  }

  // Actions & Triggers
  async getAvailableActions(): Promise<{ type: string; name: string; description: string; schema: object }[]> {
    return apiClient.get<{ type: string; name: string; description: string; schema: object }[]>('/workflow-automation/actions');
  }

  async getAvailableTriggers(): Promise<{ type: string; name: string; description: string; schema: object }[]> {
    return apiClient.get<{ type: string; name: string; description: string; schema: object }[]>('/workflow-automation/triggers');
  }
}

export const workflowsApi = new WorkflowsApi();

