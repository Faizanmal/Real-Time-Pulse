'use client';

import { apiClient } from './client';

export interface Script {
  id: string;
  name: string;
  description?: string;
  language: 'javascript' | 'python';
  code: string;
  version: number;
  enabled: boolean;
  trigger?: string;
  schedule?: {
    cron: string;
    timezone: string;
  };
  triggers?: {
    event: string;
    conditions?: Record<string, unknown>;
  }[];
  lastExecutedAt?: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ScriptExecution {
  id: string;
  scriptId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  output?: string;
  error?: string;
  context?: Record<string, unknown>;
}

export interface ScriptVersion {
  version: number;
  code: string;
  createdAt: string;
  createdBy: string;
  comment?: string;
}

export interface LibraryFunction {
  name: string;
  description: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
  returnType: string;
  example: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: { line: number; column: number; message: string }[];
  warnings: { line: number; column: number; message: string }[];
}

export const scriptingApi = {
  create: async (data: {
    name: string;
    description?: string;
    language: Script['language'];
    code: string;
    schedule?: Script['schedule'];
    triggers?: Script['triggers'];
  }): Promise<Script> => {
    const response = await apiClient.post('/scripting/scripts', data);
    return response as Script;
  },

  getAll: async (): Promise<Script[]> => {
    const response = await apiClient.get<Script[]>('/scripting/scripts');
    return response as Script[];
  },

  getById: async (id: string): Promise<Script> => {
    const response = await apiClient.get<Script>(`/scripting/scripts/${id}`);
    return response as Script;
  },

  update: async (id: string, data: Partial<Script>): Promise<Script> => {
    const response = await apiClient.put(`/scripting/scripts/${id}`, data);
    return response as Script;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/scripting/scripts/${id}`);
  },

  execute: async (
    scriptId: string,
    context?: Record<string, unknown>
  ): Promise<ScriptExecution> => {
    const response = await apiClient.post(`/scripting/scripts/${scriptId}/execute`, { context });
    return response as ScriptExecution;
  },

  validate: async (data: {
    language: Script['language'];
    code: string;
  }): Promise<ValidationResult> => {
    const response = await apiClient.post('/scripting/validate', data);
    return response as ValidationResult;
  },

  getVersions: async (scriptId: string): Promise<ScriptVersion[]> => {
    const response = await apiClient.get<ScriptVersion[]>(`/scripting/scripts/${scriptId}/versions`);
    return response;
  },

  rollback: async (scriptId: string, version: number): Promise<Script> => {
    const response = await apiClient.post(`/scripting/scripts/${scriptId}/versions/${version}/rollback`);
    return response as Script;
  },

  getExecutions: async (scriptId: string): Promise<ScriptExecution[]> => {
    const response = await apiClient.get<ScriptExecution[]>(`/scripting/scripts/${scriptId}/executions`);
    return response;
  },

  getLibraryFunctions: async (): Promise<LibraryFunction[]> => {
    const response = await apiClient.get<LibraryFunction[]>('/scripting/libraries');
    return response;
  },
};

