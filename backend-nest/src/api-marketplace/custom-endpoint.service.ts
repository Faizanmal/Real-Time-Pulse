import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import {
  InstalledConnector,
  ConnectorEndpoint,
  EndpointParameter,
} from './api-marketplace.service';

export interface CustomEndpoint {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  authentication: 'none' | 'api_key' | 'bearer' | 'workspace';
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  parameters: EndpointParameter[];
  responseMapping?: Record<string, string>;
  dataSource: {
    type: 'widget' | 'portal' | 'query' | 'connector';
    sourceId: string;
    config?: Record<string, any>;
  };
  caching: {
    enabled: boolean;
    ttlSeconds: number;
  };
  status: 'active' | 'inactive' | 'draft';
  apiKey?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EndpointUsage {
  endpointId: string;
  timestamp: Date;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  clientIp?: string;
}

@Injectable()
export class CustomEndpointService {
  private readonly logger = new Logger(CustomEndpointService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * Create custom API endpoint
   */
  async createEndpoint(
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      method: CustomEndpoint['method'];
      path: string;
      authentication: CustomEndpoint['authentication'];
      parameters?: EndpointParameter[];
      dataSource: CustomEndpoint['dataSource'];
      rateLimit?: { requests: number; windowMs: number };
      caching?: { enabled: boolean; ttlSeconds: number };
    },
  ): Promise<CustomEndpoint> {
    const endpoint: CustomEndpoint = {
      id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      name: data.name,
      description: data.description,
      method: data.method,
      path: this.normalizePath(data.path),
      authentication: data.authentication,
      parameters: data.parameters || [],
      dataSource: data.dataSource,
      rateLimit: data.rateLimit || { requests: 100, windowMs: 60000 },
      caching: data.caching || { enabled: false, ttlSeconds: 60 },
      status: 'draft',
      apiKey:
        data.authentication === 'api_key' ? this.generateApiKey() : undefined,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveEndpoint(workspaceId, endpoint);

    return endpoint;
  }

  /**
   * Get all endpoints for workspace
   */
  async getEndpoints(workspaceId: string): Promise<CustomEndpoint[]> {
    const key = `custom_endpoints:${workspaceId}`;
    const endpointsJson = await this.cache.get(key);
    return endpointsJson ? JSON.parse(endpointsJson) : [];
  }

  /**
   * Get endpoint by ID
   */
  async getEndpoint(
    workspaceId: string,
    endpointId: string,
  ): Promise<CustomEndpoint | null> {
    const endpoints = await this.getEndpoints(workspaceId);
    return endpoints.find((e) => e.id === endpointId) || null;
  }

  /**
   * Update endpoint
   */
  async updateEndpoint(
    workspaceId: string,
    endpointId: string,
    updates: Partial<
      Omit<CustomEndpoint, 'id' | 'workspaceId' | 'createdAt' | 'apiKey'>
    >,
  ): Promise<CustomEndpoint | null> {
    const endpoints = await this.getEndpoints(workspaceId);
    const index = endpoints.findIndex((e) => e.id === endpointId);

    if (index === -1) return null;

    endpoints[index] = {
      ...endpoints[index],
      ...updates,
      updatedAt: new Date(),
    };

    await this.saveEndpoints(workspaceId, endpoints);

    return endpoints[index];
  }

  /**
   * Delete endpoint
   */
  async deleteEndpoint(workspaceId: string, endpointId: string): Promise<void> {
    const endpoints = await this.getEndpoints(workspaceId);
    const filtered = endpoints.filter((e) => e.id !== endpointId);
    await this.saveEndpoints(workspaceId, filtered);
  }

  /**
   * Activate endpoint
   */
  async activateEndpoint(
    workspaceId: string,
    endpointId: string,
  ): Promise<CustomEndpoint | null> {
    return this.updateEndpoint(workspaceId, endpointId, { status: 'active' });
  }

  /**
   * Deactivate endpoint
   */
  async deactivateEndpoint(
    workspaceId: string,
    endpointId: string,
  ): Promise<CustomEndpoint | null> {
    return this.updateEndpoint(workspaceId, endpointId, { status: 'inactive' });
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(
    workspaceId: string,
    endpointId: string,
  ): Promise<string | null> {
    const endpoints = await this.getEndpoints(workspaceId);
    const index = endpoints.findIndex((e) => e.id === endpointId);

    if (index === -1) return null;

    const newApiKey = this.generateApiKey();
    endpoints[index].apiKey = newApiKey;
    endpoints[index].updatedAt = new Date();

    await this.saveEndpoints(workspaceId, endpoints);

    return newApiKey;
  }

  /**
   * Execute custom endpoint
   */
  async executeEndpoint(
    workspaceId: string,
    endpointId: string,
    params: Record<string, any>,
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    cached: boolean;
  }> {
    const endpoint = await this.getEndpoint(workspaceId, endpointId);

    if (!endpoint) {
      return { success: false, error: 'Endpoint not found', cached: false };
    }

    if (endpoint.status !== 'active') {
      return { success: false, error: 'Endpoint is not active', cached: false };
    }

    // Check rate limit
    const rateLimitOk = await this.checkRateLimit(
      endpointId,
      endpoint.rateLimit,
    );
    if (!rateLimitOk) {
      return { success: false, error: 'Rate limit exceeded', cached: false };
    }

    // Check cache
    if (endpoint.caching.enabled) {
      const cacheKey = `endpoint_cache:${endpointId}:${JSON.stringify(params)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        await this.recordUsage(endpointId, 200, 0);
        return { success: true, data: JSON.parse(cached), cached: true };
      }
    }

    const startTime = Date.now();

    try {
      // Fetch data based on source type
      let data: any;

      switch (endpoint.dataSource.type) {
        case 'widget':
          data = await this.fetchWidgetData(
            workspaceId,
            endpoint.dataSource.sourceId,
          );
          break;
        case 'portal':
          data = await this.fetchPortalData(
            workspaceId,
            endpoint.dataSource.sourceId,
          );
          break;
        case 'query':
          data = await this.executeQuery(
            workspaceId,
            endpoint.dataSource.sourceId,
            params,
          );
          break;
        case 'connector':
          data = await this.executeConnector(
            workspaceId,
            endpoint.dataSource.sourceId,
            params,
          );
          break;
        default:
          data = { message: 'Unknown data source type' };
      }

      // Apply response mapping if defined
      if (endpoint.responseMapping) {
        data = this.applyResponseMapping(data, endpoint.responseMapping);
      }

      // Cache result if enabled
      if (endpoint.caching.enabled) {
        const cacheKey = `endpoint_cache:${endpointId}:${JSON.stringify(params)}`;
        await this.cache.set(
          cacheKey,
          JSON.stringify(data),
          endpoint.caching.ttlSeconds,
        );
      }

      // Record usage
      const responseTime = Date.now() - startTime;
      await this.recordUsage(endpointId, 200, responseTime);

      // Increment usage count
      await this.incrementUsageCount(workspaceId, endpointId);

      return { success: true, data, cached: false };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await this.recordUsage(endpointId, 500, responseTime);
      return { success: false, error: error.message, cached: false };
    }
  }

  /**
   * Get endpoint usage statistics
   */
  async getUsageStats(
    workspaceId: string,
    endpointId: string,
    days: number = 7,
  ): Promise<{
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    requestsByDay: Record<string, number>;
  }> {
    const key = `endpoint_usage:${endpointId}`;
    const usageJson = await this.cache.get(key);
    const usages: EndpointUsage[] = usageJson ? JSON.parse(usageJson) : [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentUsages = usages.filter((u) => new Date(u.timestamp) >= cutoff);

    const totalRequests = recentUsages.length;
    const successCount = recentUsages.filter((u) => u.statusCode < 400).length;
    const avgResponseTime =
      totalRequests > 0
        ? recentUsages.reduce((sum, u) => sum + u.responseTimeMs, 0) /
          totalRequests
        : 0;

    const requestsByDay: Record<string, number> = {};
    recentUsages.forEach((u) => {
      const day = new Date(u.timestamp).toISOString().split('T')[0];
      requestsByDay[day] = (requestsByDay[day] || 0) + 1;
    });

    return {
      totalRequests,
      successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
      avgResponseTime: Math.round(avgResponseTime),
      requestsByDay,
    };
  }

  /**
   * Validate endpoint by API key
   */
  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    endpoint?: CustomEndpoint;
    workspaceId?: string;
  }> {
    // Search through all workspaces (in production, use proper indexing)
    const pattern = 'custom_endpoints:*';
    // For demo, return mock validation
    return { valid: false };
  }

  // Private helper methods

  private async saveEndpoint(
    workspaceId: string,
    endpoint: CustomEndpoint,
  ): Promise<void> {
    const endpoints = await this.getEndpoints(workspaceId);
    endpoints.push(endpoint);
    await this.saveEndpoints(workspaceId, endpoints);
  }

  private async saveEndpoints(
    workspaceId: string,
    endpoints: CustomEndpoint[],
  ): Promise<void> {
    const key = `custom_endpoints:${workspaceId}`;
    await this.cache.set(key, JSON.stringify(endpoints), 86400 * 365);
  }

  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return path.replace(/\/+/g, '/').replace(/\/$/, '');
  }

  private generateApiKey(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'rtp_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  private async checkRateLimit(
    endpointId: string,
    limit: { requests: number; windowMs: number },
  ): Promise<boolean> {
    const key = `rate_limit:${endpointId}`;
    const countStr = await this.cache.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    if (count >= limit.requests) {
      return false;
    }

    await this.cache.set(
      key,
      (count + 1).toString(),
      Math.ceil(limit.windowMs / 1000),
    );
    return true;
  }

  private async recordUsage(
    endpointId: string,
    statusCode: number,
    responseTimeMs: number,
  ): Promise<void> {
    const key = `endpoint_usage:${endpointId}`;
    const usageJson = await this.cache.get(key);
    const usages: EndpointUsage[] = usageJson ? JSON.parse(usageJson) : [];

    usages.push({
      endpointId,
      timestamp: new Date(),
      method: 'API',
      statusCode,
      responseTimeMs,
    });

    // Keep only last 1000 records
    const trimmed = usages.slice(-1000);
    await this.cache.set(key, JSON.stringify(trimmed), 86400 * 30);
  }

  private async incrementUsageCount(
    workspaceId: string,
    endpointId: string,
  ): Promise<void> {
    const endpoints = await this.getEndpoints(workspaceId);
    const index = endpoints.findIndex((e) => e.id === endpointId);
    if (index !== -1) {
      endpoints[index].usageCount++;
      await this.saveEndpoints(workspaceId, endpoints);
    }
  }

  private async fetchWidgetData(
    workspaceId: string,
    widgetId: string,
  ): Promise<any> {
    // Mock implementation - in production, fetch from widget service
    return { widgetId, data: { value: 100, label: 'Sample Widget Data' } };
  }

  private async fetchPortalData(
    workspaceId: string,
    portalId: string,
  ): Promise<any> {
    // Mock implementation - in production, fetch from portal service
    return { portalId, widgets: [], metadata: {} };
  }

  private async executeQuery(
    workspaceId: string,
    queryId: string,
    params: Record<string, any>,
  ): Promise<any> {
    // Mock implementation - in production, execute saved query
    return { queryId, results: [], params };
  }

  private async executeConnector(
    workspaceId: string,
    connectorId: string,
    params: Record<string, any>,
  ): Promise<any> {
    // Mock implementation - in production, execute connector request
    return { connectorId, response: {}, params };
  }

  private applyResponseMapping(
    data: any,
    mapping: Record<string, string>,
  ): any {
    const result: Record<string, any> = {};
    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      result[targetKey] = this.getNestedValue(data, sourcePath);
    }
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
