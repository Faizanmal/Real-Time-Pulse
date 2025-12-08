import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosRequestConfig } from 'axios';

export interface OAuth2Config {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string[];
  redirectUri: string;
}

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  servers: Array<{ url: string }>;
  paths: Record<string, any>;
  components?: {
    securitySchemes?: Record<string, any>;
  };
}

export interface DataTransformation {
  id: string;
  sourceField: string;
  targetField: string;
  transformation: 'map' | 'filter' | 'aggregate' | 'calculate';
  config: Record<string, any>;
}

export interface CustomWidget {
  id: string;
  name: string;
  type: string;
  dataSource: string;
  transformations: DataTransformation[];
  visualConfig: Record<string, any>;
}

export interface CustomIntegration {
  id: string;
  name: string;
  description: string;
  authType: 'oauth2' | 'api-key' | 'basic' | 'openapi';
  authConfig: OAuth2Config | Record<string, any>;
  apiSpec?: OpenAPISpec;
  endpoints: Array<{
    id: string;
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    headers?: Record<string, string>;
    params?: Record<string, any>;
  }>;
  transformations: DataTransformation[];
  customWidgets: CustomWidget[];
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class IntegrationBuilderService {
  private readonly logger = new Logger(IntegrationBuilderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new custom integration
   */
  async createIntegration(
    workspaceId: string,
    integration: Omit<CustomIntegration, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CustomIntegration> {
    const id = `custom_int_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const newIntegration: CustomIntegration = {
      ...integration,
      id,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in database
    await this.prisma.$executeRaw`
      INSERT INTO custom_integrations (id, name, description, auth_type, auth_config, 
                                      api_spec, endpoints, transformations, custom_widgets, 
                                      workspace_id, created_at, updated_at)
      VALUES (${id}, ${integration.name}, ${integration.description}, 
              ${integration.authType}, ${JSON.stringify(integration.authConfig)}, 
              ${JSON.stringify(integration.apiSpec)}, ${JSON.stringify(integration.endpoints)}, 
              ${JSON.stringify(integration.transformations)}, ${JSON.stringify(integration.customWidgets)}, 
              ${workspaceId}, ${newIntegration.createdAt}, ${newIntegration.updatedAt})
    `;

    this.logger.log(`Custom integration created: ${id}`);
    return newIntegration;
  }

  /**
   * Import integration from OpenAPI specification
   */
  async importFromOpenAPI(
    workspaceId: string,
    openAPISpec: OpenAPISpec | string,
    name: string,
  ): Promise<CustomIntegration> {
    let spec: OpenAPISpec;

    // If string is provided, fetch or parse it
    if (typeof openAPISpec === 'string') {
      if (openAPISpec.startsWith('http')) {
        const response = await axios.get(openAPISpec);
        spec = response.data;
      } else {
        spec = JSON.parse(openAPISpec);
      }
    } else {
      spec = openAPISpec;
    }

    // Parse endpoints from OpenAPI spec
    const endpoints = this.parseOpenAPIEndpoints(spec);

    // Detect authentication scheme
    const authConfig = this.detectAuthScheme(spec);

    const integration = await this.createIntegration(workspaceId, {
      name: name || spec.info.title,
      description: spec.info.version,
      authType: 'openapi',
      authConfig,
      apiSpec: spec,
      endpoints,
      transformations: [],
      customWidgets: [],
      workspaceId,
    });

    return integration;
  }

  /**
   * Configure OAuth2 authentication
   */
  async setupOAuth2(
    integrationId: string,
    oauth2Config: OAuth2Config,
  ): Promise<string> {
    // Generate authorization URL
    const authParams = new URLSearchParams({
      client_id: oauth2Config.clientId,
      redirect_uri: oauth2Config.redirectUri,
      scope: oauth2Config.scope.join(' '),
      response_type: 'code',
      state: integrationId, // Use integration ID as state for security
    });

    const authUrl = `${oauth2Config.authUrl}?${authParams.toString()}`;

    // Store OAuth config
    await this.prisma.$executeRaw`
      UPDATE custom_integrations 
      SET auth_config = ${JSON.stringify(oauth2Config)}
      WHERE id = ${integrationId}
    `;

    return authUrl;
  }

  /**
   * Handle OAuth2 callback and exchange code for token
   */
  async handleOAuth2Callback(
    integrationId: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    // Get integration config
    const integration = await this.getIntegration(integrationId);
    const oauth2Config = integration.authConfig as OAuth2Config;

    // Exchange code for token
    const tokenResponse = await axios.post(
      oauth2Config.tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: oauth2Config.redirectUri,
        client_id: oauth2Config.clientId,
        client_secret: oauth2Config.clientSecret,
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Store tokens securely (encrypted in production)
    await this.prisma.$executeRaw`
      INSERT INTO integration_tokens (integration_id, access_token, refresh_token, expires_at)
      VALUES (${integrationId}, ${access_token}, ${refresh_token || null}, 
              ${new Date(Date.now() + 3600000)})
      ON CONFLICT (integration_id) 
      DO UPDATE SET access_token = EXCLUDED.access_token, 
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at = EXCLUDED.expires_at
    `;

    return { accessToken: access_token, refreshToken: refresh_token };
  }

  /**
   * Add data transformation rule
   */
  async addTransformation(
    integrationId: string,
    transformation: Omit<DataTransformation, 'id'>,
  ): Promise<DataTransformation> {
    const id = `transform_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newTransformation: DataTransformation = { ...transformation, id };

    const integration = await this.getIntegration(integrationId);
    integration.transformations.push(newTransformation);

    await this.prisma.$executeRaw`
      UPDATE custom_integrations 
      SET transformations = ${JSON.stringify(integration.transformations)},
          updated_at = ${new Date()}
      WHERE id = ${integrationId}
    `;

    return newTransformation;
  }

  /**
   * Create custom widget type
   */
  async createCustomWidget(
    integrationId: string,
    widget: Omit<CustomWidget, 'id'>,
  ): Promise<CustomWidget> {
    const id = `widget_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newWidget: CustomWidget = { ...widget, id };

    const integration = await this.getIntegration(integrationId);
    integration.customWidgets.push(newWidget);

    await this.prisma.$executeRaw`
      UPDATE custom_integrations 
      SET custom_widgets = ${JSON.stringify(integration.customWidgets)},
          updated_at = ${new Date()}
      WHERE id = ${integrationId}
    `;

    return newWidget;
  }

  /**
   * Test custom integration endpoint
   */
  async testEndpoint(
    integrationId: string,
    endpointId: string,
    testData?: Record<string, any>,
  ): Promise<any> {
    const integration = await this.getIntegration(integrationId);
    const endpoint = integration.endpoints.find((e) => e.id === endpointId);

    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    // Get access token
    const token = await this.getAccessToken(integrationId);

    // Build request config
    const baseUrl = integration.apiSpec?.servers[0]?.url || '';
    const config: AxiosRequestConfig = {
      method: endpoint.method,
      url: `${baseUrl}${endpoint.path}`,
      headers: {
        ...endpoint.headers,
        Authorization: `Bearer ${token}`,
      },
      params: endpoint.params,
      data: testData,
    };

    try {
      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Endpoint test failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute custom integration with transformations
   */
  async executeIntegration(
    integrationId: string,
    endpointId: string,
    params?: Record<string, any>,
  ): Promise<any> {
    const integration = await this.getIntegration(integrationId);
    const endpoint = integration.endpoints.find((e) => e.id === endpointId);

    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    // Get access token
    const token = await this.getAccessToken(integrationId);

    // Execute request
    const baseUrl = integration.apiSpec?.servers[0]?.url || '';
    const response = await axios({
      method: endpoint.method,
      url: `${baseUrl}${endpoint.path}`,
      headers: {
        ...endpoint.headers,
        Authorization: `Bearer ${token}`,
      },
      params: { ...endpoint.params, ...params },
    });

    // Apply transformations
    let data = response.data;
    for (const transformation of integration.transformations) {
      data = this.applyTransformation(data, transformation);
    }

    return data;
  }

  /**
   * Get integration details
   */
  async getIntegration(integrationId: string): Promise<CustomIntegration> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM custom_integrations WHERE id = ${integrationId}
    `;

    if (!result || result.length === 0) {
      throw new Error('Integration not found');
    }

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      authType: row.auth_type,
      authConfig: JSON.parse(row.auth_config),
      apiSpec: row.api_spec ? JSON.parse(row.api_spec) : undefined,
      endpoints: JSON.parse(row.endpoints),
      transformations: JSON.parse(row.transformations),
      customWidgets: JSON.parse(row.custom_widgets),
      workspaceId: row.workspace_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all custom integrations for workspace
   */
  async listIntegrations(workspaceId: string): Promise<CustomIntegration[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM custom_integrations WHERE workspace_id = ${workspaceId}
    `;

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      authType: row.auth_type,
      authConfig: JSON.parse(row.auth_config),
      apiSpec: row.api_spec ? JSON.parse(row.api_spec) : undefined,
      endpoints: JSON.parse(row.endpoints),
      transformations: JSON.parse(row.transformations),
      customWidgets: JSON.parse(row.custom_widgets),
      workspaceId: row.workspace_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Parse endpoints from OpenAPI specification
   */
  private parseOpenAPIEndpoints(spec: OpenAPISpec): any[] {
    const endpoints = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          endpoints.push({
            id: `endpoint_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: operation.summary || `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            path,
            headers: {},
            params: operation.parameters || {},
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Detect authentication scheme from OpenAPI spec
   */
  private detectAuthScheme(spec: OpenAPISpec): Record<string, any> {
    if (spec.components?.securitySchemes) {
      const schemes = spec.components.securitySchemes;
      const firstScheme = Object.values(schemes)[0] as any;

      if (firstScheme?.type === 'oauth2') {
        return {
          type: 'oauth2',
          flows: firstScheme.flows,
        };
      } else if (firstScheme?.type === 'apiKey') {
        return {
          type: 'api-key',
          in: firstScheme.in,
          name: firstScheme.name,
        };
      }
    }

    return { type: 'none' };
  }

  /**
   * Get access token for integration
   */
  private async getAccessToken(integrationId: string): Promise<string> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT access_token, refresh_token, expires_at 
      FROM integration_tokens 
      WHERE integration_id = ${integrationId}
    `;

    if (!result || result.length === 0) {
      throw new Error('No access token found');
    }

    const token = result[0];

    // Check if token expired and refresh if needed
    if (new Date(token.expires_at) < new Date() && token.refresh_token) {
      return await this.refreshAccessToken(integrationId, token.refresh_token);
    }

    return token.access_token;
  }

  /**
   * Refresh OAuth2 access token
   */
  private async refreshAccessToken(
    integrationId: string,
    refreshToken: string,
  ): Promise<string> {
    const integration = await this.getIntegration(integrationId);
    const oauth2Config = integration.authConfig as OAuth2Config;

    const tokenResponse = await axios.post(
      oauth2Config.tokenUrl,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: oauth2Config.clientId,
        client_secret: oauth2Config.clientSecret,
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Update tokens
    await this.prisma.$executeRaw`
      UPDATE integration_tokens 
      SET access_token = ${access_token},
          refresh_token = ${refresh_token || refreshToken},
          expires_at = ${new Date(Date.now() + 3600000)}
      WHERE integration_id = ${integrationId}
    `;

    return access_token;
  }

  /**
   * Apply data transformation
   */
  private applyTransformation(data: any, transformation: DataTransformation): any {
    switch (transformation.transformation) {
      case 'map':
        return this.mapTransformation(data, transformation);
      case 'filter':
        return this.filterTransformation(data, transformation);
      case 'aggregate':
        return this.aggregateTransformation(data, transformation);
      case 'calculate':
        return this.calculateTransformation(data, transformation);
      default:
        return data;
    }
  }

  private mapTransformation(data: any, transformation: DataTransformation): any {
    if (Array.isArray(data)) {
      return data.map((item) => ({
        ...item,
        [transformation.targetField]: item[transformation.sourceField],
      }));
    }
    return {
      ...data,
      [transformation.targetField]: data[transformation.sourceField],
    };
  }

  private filterTransformation(data: any, transformation: DataTransformation): any {
    if (!Array.isArray(data)) return data;

    const { condition, value } = transformation.config;
    return data.filter((item) => {
      const fieldValue = item[transformation.sourceField];
      switch (condition) {
        case 'equals':
          return fieldValue === value;
        case 'contains':
          return String(fieldValue).includes(value);
        case 'greaterThan':
          return fieldValue > value;
        case 'lessThan':
          return fieldValue < value;
        default:
          return true;
      }
    });
  }

  private aggregateTransformation(data: any, transformation: DataTransformation): any {
    if (!Array.isArray(data)) return data;

    const { operation } = transformation.config;
    const values = data.map((item) => item[transformation.sourceField]);

    switch (operation) {
      case 'sum':
        return values.reduce((acc, val) => acc + val, 0);
      case 'avg':
        return values.reduce((acc, val) => acc + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return data;
    }
  }

  private calculateTransformation(data: any, transformation: DataTransformation): any {
    const { expression } = transformation.config;
    // Simple expression evaluation (in production, use a proper expression parser)
    try {
      if (Array.isArray(data)) {
        return data.map((item) => ({
          ...item,
          [transformation.targetField]: this.evaluateExpression(expression, item),
        }));
      }
      return {
        ...data,
        [transformation.targetField]: this.evaluateExpression(expression, data),
      };
    } catch (error) {
      this.logger.error('Expression evaluation failed', error);
      return data;
    }
  }

  private evaluateExpression(expression: string, context: any): any {
    // Simple variable replacement (in production, use a safer expression evaluator)
    let result = expression;
    for (const [key, value] of Object.entries(context)) {
      result = result.replace(new RegExp(`\\$${key}`, 'g'), String(value));
    }
    // Evaluate simple arithmetic (use with caution)
    try {
      return eval(result);
    } catch {
      return null;
    }
  }
}
