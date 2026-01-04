import { Injectable, Logger } from '@nestjs/common';
import { EndpointParameter } from './api-marketplace.service';

export interface EndpointDefinition {
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  authentication: 'none' | 'api_key' | 'bearer' | 'workspace';
  parameters: EndpointParameter[];
  dataSource: {
    type: 'widget' | 'portal' | 'query' | 'connector';
    sourceId: string;
    config?: Record<string, any>;
  };
  rateLimit?: { requests: number; windowMs: number };
  caching?: { enabled: boolean; ttlSeconds: number };
  responseMapping?: Record<string, string>;
}

export interface BuilderStep {
  id: string;
  type: 'basic' | 'parameters' | 'data_source' | 'security' | 'response';
  title: string;
  completed: boolean;
  data: Record<string, any>;
}

@Injectable()
export class EndpointBuilderService {
  private readonly logger = new Logger(EndpointBuilderService.name);

  /**
   * Initialize endpoint builder wizard
   */
  initializeBuilder(): BuilderStep[] {
    return [
      {
        id: 'basic',
        type: 'basic',
        title: 'Basic Information',
        completed: false,
        data: {},
      },
      {
        id: 'parameters',
        type: 'parameters',
        title: 'Parameters',
        completed: false,
        data: { parameters: [] },
      },
      {
        id: 'data_source',
        type: 'data_source',
        title: 'Data Source',
        completed: false,
        data: {},
      },
      {
        id: 'security',
        type: 'security',
        title: 'Security & Rate Limiting',
        completed: false,
        data: {},
      },
      {
        id: 'response',
        type: 'response',
        title: 'Response Configuration',
        completed: false,
        data: {},
      },
    ];
  }

  /**
   * Validate builder step
   */
  validateStep(step: BuilderStep): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (step.type) {
      case 'basic':
        if (!step.data.name) errors.push('Name is required');
        if (!step.data.method) errors.push('HTTP method is required');
        if (!step.data.path) errors.push('Path is required');
        if (step.data.path && !step.data.path.startsWith('/')) {
          errors.push('Path must start with /');
        }
        break;

      case 'parameters': {
        const params = step.data.parameters || [];
        params.forEach((param: any, index: number) => {
          if (!param.name)
            errors.push(`Parameter ${index + 1}: Name is required`);
          if (!param.type)
            errors.push(`Parameter ${index + 1}: Type is required`);
          if (!param.dataType)
            errors.push(`Parameter ${index + 1}: Data type is required`);
        });
        break;
      }

      case 'data_source':
        if (!step.data.type) errors.push('Data source type is required');
        if (!step.data.sourceId) errors.push('Source ID is required');
        break;

      case 'security':
        if (!step.data.authentication) {
          step.data.authentication = 'workspace'; // Default
        }
        break;

      case 'response':
        // Response configuration is optional
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build endpoint definition from builder steps
   */
  buildEndpoint(steps: BuilderStep[]): EndpointDefinition {
    const basicStep = steps.find((s) => s.type === 'basic');
    const paramsStep = steps.find((s) => s.type === 'parameters');
    const dataSourceStep = steps.find((s) => s.type === 'data_source');
    const securityStep = steps.find((s) => s.type === 'security');
    const responseStep = steps.find((s) => s.type === 'response');

    return {
      name: basicStep?.data.name || '',
      description: basicStep?.data.description,
      method: basicStep?.data.method || 'GET',
      path: basicStep?.data.path || '/',
      authentication: securityStep?.data.authentication || 'workspace',
      parameters: paramsStep?.data.parameters || [],
      dataSource: {
        type: dataSourceStep?.data.type || 'widget',
        sourceId: dataSourceStep?.data.sourceId || '',
        config: dataSourceStep?.data.config,
      },
      rateLimit: securityStep?.data.rateLimit,
      caching: securityStep?.data.caching,
      responseMapping: responseStep?.data.mapping,
    };
  }

  /**
   * Generate OpenAPI specification for endpoint
   */
  generateOpenAPISpec(endpoint: EndpointDefinition): object {
    const pathParams = endpoint.parameters.filter((p) => p.type === 'path');
    const queryParams = endpoint.parameters.filter((p) => p.type === 'query');
    const headerParams = endpoint.parameters.filter((p) => p.type === 'header');
    const bodyParams = endpoint.parameters.filter((p) => p.type === 'body');

    const parameters = [
      ...pathParams.map((p) => ({
        name: p.name,
        in: 'path',
        required: p.required,
        schema: { type: this.mapDataType(p.dataType) },
        description: p.description,
      })),
      ...queryParams.map((p) => ({
        name: p.name,
        in: 'query',
        required: p.required,
        schema: { type: this.mapDataType(p.dataType) },
        description: p.description,
      })),
      ...headerParams.map((p) => ({
        name: p.name,
        in: 'header',
        required: p.required,
        schema: { type: this.mapDataType(p.dataType) },
        description: p.description,
      })),
    ];

    const requestBody =
      bodyParams.length > 0
        ? {
            required: bodyParams.some((p) => p.required),
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: bodyParams.reduce(
                    (acc, p) => {
                      acc[p.name] = { type: this.mapDataType(p.dataType) };
                      return acc;
                    },
                    {} as Record<string, any>,
                  ),
                  required: bodyParams
                    .filter((p) => p.required)
                    .map((p) => p.name),
                },
              },
            },
          }
        : undefined;

    const security: any[] = [];
    if (endpoint.authentication === 'api_key') {
      security.push({ ApiKeyAuth: [] });
    } else if (endpoint.authentication === 'bearer') {
      security.push({ BearerAuth: [] });
    }

    return {
      openapi: '3.0.3',
      info: {
        title: endpoint.name,
        description: endpoint.description,
        version: '1.0.0',
      },
      paths: {
        [endpoint.path]: {
          [endpoint.method.toLowerCase()]: {
            summary: endpoint.name,
            description: endpoint.description,
            parameters,
            requestBody,
            security: security.length > 0 ? security : undefined,
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              '400': { description: 'Bad request' },
              '401': { description: 'Unauthorized' },
              '429': { description: 'Rate limit exceeded' },
              '500': { description: 'Internal server error' },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    };
  }

  /**
   * Generate code samples for endpoint
   */
  generateCodeSamples(
    endpoint: EndpointDefinition,
    baseUrl: string,
    apiKey?: string,
  ): Record<string, string> {
    const url = `${baseUrl}${endpoint.path}`;

    // JavaScript/Fetch
    const jsFetch = `
const response = await fetch('${url}', {
  method: '${endpoint.method}',
  headers: {
    'Content-Type': 'application/json',
    ${endpoint.authentication === 'api_key' ? `'X-API-Key': '${apiKey || 'YOUR_API_KEY'}',` : ''}
    ${endpoint.authentication === 'bearer' ? `'Authorization': 'Bearer YOUR_TOKEN',` : ''}
  },
  ${endpoint.method !== 'GET' ? `body: JSON.stringify({ /* request body */ }),` : ''}
});

const data = await response.json();
console.log(data);
`.trim();

    // Python/Requests
    const python = `
import requests

response = requests.${endpoint.method.toLowerCase()}(
    '${url}',
    headers={
        'Content-Type': 'application/json',
        ${endpoint.authentication === 'api_key' ? `'X-API-Key': '${apiKey || 'YOUR_API_KEY'}',` : ''}
        ${endpoint.authentication === 'bearer' ? `'Authorization': 'Bearer YOUR_TOKEN',` : ''}
    },
    ${endpoint.method !== 'GET' ? `json={ /* request body */ },` : ''}
)

data = response.json()
print(data)
`.trim();

    // cURL
    const curl = `
curl -X ${endpoint.method} '${url}' \\
  -H 'Content-Type: application/json' \\
  ${endpoint.authentication === 'api_key' ? `-H 'X-API-Key: ${apiKey || 'YOUR_API_KEY'}' \\` : ''}
  ${endpoint.authentication === 'bearer' ? `-H 'Authorization: Bearer YOUR_TOKEN' \\` : ''}
  ${endpoint.method !== 'GET' ? `-d '{ /* request body */ }'` : ''}
`.trim();

    return {
      javascript: jsFetch,
      python,
      curl,
    };
  }

  /**
   * Get available data sources for endpoint
   */
  getAvailableDataSources(): Array<{
    type: string;
    name: string;
    description: string;
    configSchema: Record<string, any>;
  }> {
    return [
      {
        type: 'widget',
        name: 'Widget Data',
        description: 'Expose widget data through API',
        configSchema: {
          type: 'object',
          properties: {
            widgetId: { type: 'string', title: 'Widget ID' },
            format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
          },
          required: ['widgetId'],
        },
      },
      {
        type: 'portal',
        name: 'Portal Data',
        description: 'Expose entire portal data',
        configSchema: {
          type: 'object',
          properties: {
            portalId: { type: 'string', title: 'Portal ID' },
            includeWidgets: { type: 'boolean', default: true },
          },
          required: ['portalId'],
        },
      },
      {
        type: 'query',
        name: 'Saved Query',
        description: 'Execute a saved database query',
        configSchema: {
          type: 'object',
          properties: {
            queryId: { type: 'string', title: 'Query ID' },
            parameterizable: { type: 'boolean', default: true },
          },
          required: ['queryId'],
        },
      },
      {
        type: 'connector',
        name: 'Connector',
        description: 'Proxy request through installed connector',
        configSchema: {
          type: 'object',
          properties: {
            connectorId: { type: 'string', title: 'Connector Installation ID' },
            endpointId: { type: 'string', title: 'Connector Endpoint ID' },
          },
          required: ['connectorId', 'endpointId'],
        },
      },
    ];
  }

  private mapDataType(dataType: string): string {
    const mapping: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      object: 'object',
      array: 'array',
    };
    return mapping[dataType] || 'string';
  }
}
