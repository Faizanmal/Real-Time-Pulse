import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export interface MarketplaceConnector {
  id: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  version: string;
  icon?: string;
  authType: 'none' | 'api_key' | 'oauth2' | 'basic';
  baseUrl?: string;
  endpoints: ConnectorEndpoint[];
  configSchema: Record<string, any>;
  rating: number;
  downloads: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description?: string;
  parameters: EndpointParameter[];
  responseSchema?: Record<string, any>;
}

export interface EndpointParameter {
  name: string;
  type: 'path' | 'query' | 'header' | 'body';
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: any;
  description?: string;
}

export interface InstalledConnector {
  id: string;
  workspaceId: string;
  connectorId: string;
  connector: MarketplaceConnector;
  config: Record<string, any>;
  credentials?: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  installedAt: Date;
  lastUsed?: Date;
}

@Injectable()
export class ApiMarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(ApiMarketplaceService.name);

  constructor(private readonly cache: CacheService) {}

  async onModuleInit() {
    await this.initializeBuiltInConnectors();
  }

  /**
   * Initialize built-in marketplace connectors
   */
  private async initializeBuiltInConnectors() {
    const builtInConnectors: MarketplaceConnector[] = [
      {
        id: 'stripe',
        name: 'Stripe',
        description: 'Payment processing and billing data',
        category: 'Payments',
        publisher: 'Real-Time Pulse',
        version: '1.0.0',
        icon: 'stripe-icon',
        authType: 'api_key',
        baseUrl: 'https://api.stripe.com/v1',
        endpoints: [
          {
            id: 'list-charges',
            name: 'List Charges',
            method: 'GET',
            path: '/charges',
            parameters: [
              {
                name: 'limit',
                type: 'query',
                dataType: 'number',
                required: false,
                default: 10,
              },
              {
                name: 'starting_after',
                type: 'query',
                dataType: 'string',
                required: false,
              },
            ],
          },
          {
            id: 'list-customers',
            name: 'List Customers',
            method: 'GET',
            path: '/customers',
            parameters: [
              {
                name: 'limit',
                type: 'query',
                dataType: 'number',
                required: false,
                default: 10,
              },
            ],
          },
          {
            id: 'get-balance',
            name: 'Get Balance',
            method: 'GET',
            path: '/balance',
            parameters: [],
          },
        ],
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', format: 'password' },
          },
          required: ['apiKey'],
        },
        rating: 4.8,
        downloads: 15000,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'salesforce',
        name: 'Salesforce',
        description: 'CRM data and sales analytics',
        category: 'CRM',
        publisher: 'Real-Time Pulse',
        version: '1.0.0',
        icon: 'salesforce-icon',
        authType: 'oauth2',
        endpoints: [
          {
            id: 'query',
            name: 'SOQL Query',
            method: 'GET',
            path: '/services/data/v57.0/query',
            parameters: [
              {
                name: 'q',
                type: 'query',
                dataType: 'string',
                required: true,
                description: 'SOQL query',
              },
            ],
          },
          {
            id: 'get-account',
            name: 'Get Account',
            method: 'GET',
            path: '/services/data/v57.0/sobjects/Account/{id}',
            parameters: [{ name: 'id', type: 'path', dataType: 'string', required: true }],
          },
        ],
        configSchema: {
          type: 'object',
          properties: {
            instanceUrl: { type: 'string', title: 'Instance URL' },
            clientId: { type: 'string', title: 'Client ID' },
            clientSecret: {
              type: 'string',
              title: 'Client Secret',
              format: 'password',
            },
          },
          required: ['instanceUrl', 'clientId', 'clientSecret'],
        },
        rating: 4.6,
        downloads: 12000,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'google-analytics',
        name: 'Google Analytics',
        description: 'Web analytics and user behavior data',
        category: 'Analytics',
        publisher: 'Real-Time Pulse',
        version: '1.0.0',
        icon: 'ga-icon',
        authType: 'oauth2',
        endpoints: [
          {
            id: 'run-report',
            name: 'Run Report',
            method: 'POST',
            path: '/v1beta/{property}:runReport',
            parameters: [
              {
                name: 'property',
                type: 'path',
                dataType: 'string',
                required: true,
              },
              {
                name: 'dateRanges',
                type: 'body',
                dataType: 'array',
                required: true,
              },
              {
                name: 'dimensions',
                type: 'body',
                dataType: 'array',
                required: false,
              },
              {
                name: 'metrics',
                type: 'body',
                dataType: 'array',
                required: true,
              },
            ],
          },
        ],
        configSchema: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', title: 'Property ID' },
            serviceAccountKey: { type: 'object', title: 'Service Account Key' },
          },
          required: ['propertyId'],
        },
        rating: 4.7,
        downloads: 18000,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Team communication and notifications',
        category: 'Communication',
        publisher: 'Real-Time Pulse',
        version: '1.0.0',
        icon: 'slack-icon',
        authType: 'oauth2',
        baseUrl: 'https://slack.com/api',
        endpoints: [
          {
            id: 'post-message',
            name: 'Post Message',
            method: 'POST',
            path: '/chat.postMessage',
            parameters: [
              {
                name: 'channel',
                type: 'body',
                dataType: 'string',
                required: true,
              },
              {
                name: 'text',
                type: 'body',
                dataType: 'string',
                required: true,
              },
            ],
          },
          {
            id: 'list-channels',
            name: 'List Channels',
            method: 'GET',
            path: '/conversations.list',
            parameters: [],
          },
        ],
        configSchema: {
          type: 'object',
          properties: {
            botToken: {
              type: 'string',
              title: 'Bot Token',
              format: 'password',
            },
          },
          required: ['botToken'],
        },
        rating: 4.5,
        downloads: 20000,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Repository and development metrics',
        category: 'Development',
        publisher: 'Real-Time Pulse',
        version: '1.0.0',
        icon: 'github-icon',
        authType: 'api_key',
        baseUrl: 'https://api.github.com',
        endpoints: [
          {
            id: 'list-repos',
            name: 'List Repositories',
            method: 'GET',
            path: '/user/repos',
            parameters: [
              {
                name: 'sort',
                type: 'query',
                dataType: 'string',
                required: false,
              },
              {
                name: 'per_page',
                type: 'query',
                dataType: 'number',
                required: false,
              },
            ],
          },
          {
            id: 'get-repo-stats',
            name: 'Get Repository Stats',
            method: 'GET',
            path: '/repos/{owner}/{repo}/stats/contributors',
            parameters: [
              {
                name: 'owner',
                type: 'path',
                dataType: 'string',
                required: true,
              },
              {
                name: 'repo',
                type: 'path',
                dataType: 'string',
                required: true,
              },
            ],
          },
        ],
        configSchema: {
          type: 'object',
          properties: {
            personalAccessToken: {
              type: 'string',
              title: 'Personal Access Token',
              format: 'password',
            },
          },
          required: ['personalAccessToken'],
        },
        rating: 4.9,
        downloads: 25000,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'jira',
        name: 'Jira',
        description: 'Project management and issue tracking',
        category: 'Project Management',
        publisher: 'Real-Time Pulse',
        version: '1.0.0',
        icon: 'jira-icon',
        authType: 'basic',
        endpoints: [
          {
            id: 'search-issues',
            name: 'Search Issues',
            method: 'POST',
            path: '/rest/api/3/search',
            parameters: [
              { name: 'jql', type: 'body', dataType: 'string', required: true },
              {
                name: 'maxResults',
                type: 'body',
                dataType: 'number',
                required: false,
              },
            ],
          },
          {
            id: 'get-project',
            name: 'Get Project',
            method: 'GET',
            path: '/rest/api/3/project/{projectIdOrKey}',
            parameters: [
              {
                name: 'projectIdOrKey',
                type: 'path',
                dataType: 'string',
                required: true,
              },
            ],
          },
        ],
        configSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', title: 'Jira Domain' },
            email: { type: 'string', title: 'Email' },
            apiToken: {
              type: 'string',
              title: 'API Token',
              format: 'password',
            },
          },
          required: ['domain', 'email', 'apiToken'],
        },
        rating: 4.4,
        downloads: 14000,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Save built-in connectors
    await this.cache.set('marketplace:connectors', JSON.stringify(builtInConnectors), 86400 * 365);
  }

  /**
   * Get all marketplace connectors
   */
  async getMarketplaceConnectors(options?: {
    category?: string;
    search?: string;
    verified?: boolean;
  }): Promise<MarketplaceConnector[]> {
    const connectorsJson = await this.cache.get('marketplace:connectors');
    let connectors: MarketplaceConnector[] = connectorsJson ? JSON.parse(connectorsJson) : [];

    if (options?.category) {
      connectors = connectors.filter((c) => c.category === options.category);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      connectors = connectors.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower),
      );
    }

    if (options?.verified !== undefined) {
      connectors = connectors.filter((c) => c.verified === options.verified);
    }

    return connectors;
  }

  /**
   * Get connector by ID
   */
  async getConnector(connectorId: string): Promise<MarketplaceConnector | null> {
    const connectors = await this.getMarketplaceConnectors();
    return connectors.find((c) => c.id === connectorId) || null;
  }

  /**
   * Install connector to workspace
   */
  async installConnector(
    workspaceId: string,
    connectorId: string,
    config: Record<string, any>,
    credentials?: Record<string, any>,
  ): Promise<InstalledConnector> {
    const connector = await this.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    const installed: InstalledConnector = {
      id: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      connectorId,
      connector,
      config,
      credentials,
      status: 'active',
      installedAt: new Date(),
    };

    // Save installed connector
    const key = `installed_connectors:${workspaceId}`;
    const installedJson = await this.cache.get(key);
    const installedList: InstalledConnector[] = installedJson ? JSON.parse(installedJson) : [];
    installedList.push(installed);

    await this.cache.set(key, JSON.stringify(installedList), 86400 * 365);

    // Increment download count
    await this.incrementDownloads(connectorId);

    return installed;
  }

  /**
   * Get installed connectors for workspace
   */
  async getInstalledConnectors(workspaceId: string): Promise<InstalledConnector[]> {
    const key = `installed_connectors:${workspaceId}`;
    const installedJson = await this.cache.get(key);
    return installedJson ? JSON.parse(installedJson) : [];
  }

  /**
   * Uninstall connector
   */
  async uninstallConnector(workspaceId: string, installationId: string): Promise<void> {
    const key = `installed_connectors:${workspaceId}`;
    const installedJson = await this.cache.get(key);
    const installedList: InstalledConnector[] = installedJson ? JSON.parse(installedJson) : [];

    const filtered = installedList.filter((i) => i.id !== installationId);
    await this.cache.set(key, JSON.stringify(filtered), 86400 * 365);
  }

  /**
   * Update connector configuration
   */
  async updateConnectorConfig(
    workspaceId: string,
    installationId: string,
    config: Record<string, any>,
  ): Promise<InstalledConnector | null> {
    const key = `installed_connectors:${workspaceId}`;
    const installedJson = await this.cache.get(key);
    const installedList: InstalledConnector[] = installedJson ? JSON.parse(installedJson) : [];

    const index = installedList.findIndex((i) => i.id === installationId);
    if (index === -1) return null;

    installedList[index].config = { ...installedList[index].config, ...config };
    await this.cache.set(key, JSON.stringify(installedList), 86400 * 365);

    return installedList[index];
  }

  /**
   * Get marketplace categories
   */
  async getCategories(): Promise<string[]> {
    const connectors = await this.getMarketplaceConnectors();
    const categories = [...new Set(connectors.map((c) => c.category))];
    return categories.sort();
  }

  /**
   * Publish custom connector to marketplace
   */
  async publishConnector(
    connector: Omit<
      MarketplaceConnector,
      'id' | 'rating' | 'downloads' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<MarketplaceConnector> {
    const newConnector: MarketplaceConnector = {
      ...connector,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rating: 0,
      downloads: 0,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const connectorsJson = await this.cache.get('marketplace:connectors');
    const connectors: MarketplaceConnector[] = connectorsJson ? JSON.parse(connectorsJson) : [];
    connectors.push(newConnector);

    await this.cache.set('marketplace:connectors', JSON.stringify(connectors), 86400 * 365);

    return newConnector;
  }

  private async incrementDownloads(connectorId: string): Promise<void> {
    const connectorsJson = await this.cache.get('marketplace:connectors');
    const connectors: MarketplaceConnector[] = connectorsJson ? JSON.parse(connectorsJson) : [];

    const index = connectors.findIndex((c) => c.id === connectorId);
    if (index !== -1) {
      connectors[index].downloads++;
      await this.cache.set('marketplace:connectors', JSON.stringify(connectors), 86400 * 365);
    }
  }
}
