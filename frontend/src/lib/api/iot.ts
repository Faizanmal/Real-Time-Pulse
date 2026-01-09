'use client';

import { apiClient } from './client';

export interface IoTDevice {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  metadata: Record<string, unknown>;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  location?: string;
  battery?: number;
  signalStrength?: number;
}

export interface IoTMetric {
  deviceId: string;
  metric: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
}

export interface IoTAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  type: 'warning' | 'error' | 'critical';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface EdgeNode {
  id: string;
  name: string;
  location?: string;
  status: 'online' | 'offline' | 'syncing';
  lastSync?: string;
  deviceCount: number;
  cpuUsage: number;
  memoryUsage: number;
  connectedDevices: number;
  rules: EdgeRule[];
}

export interface EdgeRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
}

export const iotApi = {
  // Devices
  registerDevice: async (data: {
    name: string;
    type: string;
    metadata?: Record<string, unknown>;
    location?: string;
  }): Promise<IoTDevice> => {
    const response = await apiClient.post('/iot/devices', data);
    return response as IoTDevice;
  },

  getDevices: async (params?: {
    type?: string;
    status?: string;
    limit?: number;
  }): Promise<IoTDevice[]> => {
    const response = await apiClient.get<IoTDevice[]>('/iot/devices', { params });
    return response as IoTDevice[];
  },

  getDevice: async (id: string): Promise<IoTDevice> => {
    const response = await apiClient.get<IoTDevice>(`/iot/devices/${id}`);
    return response as IoTDevice;
  },

  deleteDevice: async (deviceId: string): Promise<void> => {
    await apiClient.delete(`/iot/devices/${deviceId}`);
  },

  sendCommand: async (deviceId: string, command: {
    action: string;
    parameters?: Record<string, unknown>;
  }): Promise<{ success: boolean; response?: unknown }> => {
    const response = await apiClient.post(`/iot/devices/${deviceId}/command`, command);
    return response as { success: boolean; response?: unknown };
  },

  getDeviceMetrics: async (
    deviceId: string,
    params?: {
      metric?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<IoTMetric[]> => {
    const response = await apiClient.get<IoTMetric[]>(`/iot/devices/${deviceId}/metrics`, { params });
    return response as IoTMetric[];
  },

  // Alerts
  getAlerts: async (params?: {
    deviceId?: string;
    type?: string;
    acknowledged?: boolean;
  }): Promise<IoTAlert[]> => {
    const response = await apiClient.get<IoTAlert[]>('/iot/alerts', { params });
    return response as IoTAlert[];
  },

  acknowledgeAlert: async (alertId: string): Promise<IoTAlert> => {
    const response = await apiClient.post(`/iot/alerts/${alertId}/acknowledge`);
    return response as IoTAlert;
  },

  // Edge Nodes
  registerEdgeNode: async (data: {
    name: string;
    location?: string;
  }): Promise<EdgeNode> => {
    const response = await apiClient.post('/iot/edge/nodes', data);
    return response as EdgeNode;
  },

  getEdgeNodes: async (): Promise<EdgeNode[]> => {
    const response = await apiClient.get<EdgeNode[]>('/iot/edge/nodes');
    return response as EdgeNode[];
  },

  getEdgeNodeStatus: async (nodeId: string): Promise<EdgeNode> => {
    const response = await apiClient.get<EdgeNode>(`/iot/edge/nodes/${nodeId}/status`);
    return response as EdgeNode;
  },

  getAllEdgeNodeStatuses: async (): Promise<EdgeNode[]> => {
    const response = await apiClient.get<EdgeNode[]>('/iot/edge/nodes/status');
    return response as EdgeNode[];
  },

  deployRules: async (nodeId: string, rules: EdgeRule[]): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/iot/edge/nodes/${nodeId}/deploy`, { rules });
    return response as { success: boolean };
  },

  setMaintenanceMode: async (
    nodeId: string,
    enabled: boolean
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/iot/edge/nodes/${nodeId}/maintenance`, { enabled });
    return response as { success: boolean };
  },
};

