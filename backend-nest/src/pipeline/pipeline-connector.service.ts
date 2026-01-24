import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ConnectorType =
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'rest_api'
  | 'graphql'
  | 'csv'
  | 'json'
  | 's3'
  | 'gcs'
  | 'bigquery'
  | 'snowflake'
  | 'elasticsearch'
  | 'redis'
  | 'kafka'
  | 'webhook';

interface ConnectorConfig {
  [key: string]: any;
}

@Injectable()
export class PipelineConnectorService {
  private readonly logger = new Logger(PipelineConnectorService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Fetch data from a source
   */
  async fetchData(connectorType: ConnectorType, config: ConnectorConfig): Promise<any[]> {
    this.logger.log(`Fetching data from ${connectorType}`);

    switch (connectorType) {
      case 'rest_api':
        return this.fetchFromRestApi(config);

      case 'json':
        return this.fetchFromJson(config);

      case 'csv':
        return this.fetchFromCsv(config);

      case 'postgresql':
      case 'mysql':
        return this.fetchFromDatabase(connectorType, config);

      case 's3':
        return this.fetchFromS3(config);

      case 'elasticsearch':
        return this.fetchFromElasticsearch(config);

      default:
        throw new BadRequestException(`Unsupported connector type: ${connectorType}`);
    }
  }

  /**
   * Write data to a destination
   */
  async writeData(
    connectorType: ConnectorType,
    config: ConnectorConfig,
    data: any[],
  ): Promise<void> {
    this.logger.log(`Writing ${data.length} rows to ${connectorType}`);

    switch (connectorType) {
      case 'rest_api':
        await this.writeToRestApi(config, data);
        break;

      case 'json':
        await this.writeToJson(config, data);
        break;

      case 'csv':
        await this.writeToCsv(config, data);
        break;

      case 'postgresql':
      case 'mysql':
        await this.writeToDatabase(connectorType, config, data);
        break;

      case 's3':
        await this.writeToS3(config, data);
        break;

      case 'webhook':
        await this.writeToWebhook(config, data);
        break;

      case 'elasticsearch':
        await this.writeToElasticsearch(config, data);
        break;

      default:
        throw new BadRequestException(`Unsupported connector type: ${connectorType}`);
    }
  }

  /**
   * Get sample data for dry run
   */
  getSampleData(_connectorType: ConnectorType, _config: ConnectorConfig): any[] {
    // Return sample data based on connector type
    return [
      { id: 1, name: 'Sample 1', value: 100 },
      { id: 2, name: 'Sample 2', value: 200 },
      { id: 3, name: 'Sample 3', value: 300 },
    ];
  }

  /**
   * Get available connectors with their configurations
   */
  getAvailableConnectors() {
    return [
      {
        type: 'postgresql',
        name: 'PostgreSQL',
        category: 'database',
        configSchema: {
          host: { type: 'string', required: true },
          port: { type: 'number', default: 5432 },
          database: { type: 'string', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: true, secret: true },
          query: { type: 'string', required: true },
        },
      },
      {
        type: 'mysql',
        name: 'MySQL',
        category: 'database',
        configSchema: {
          host: { type: 'string', required: true },
          port: { type: 'number', default: 3306 },
          database: { type: 'string', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: true, secret: true },
          query: { type: 'string', required: true },
        },
      },
      {
        type: 'rest_api',
        name: 'REST API',
        category: 'api',
        configSchema: {
          url: { type: 'string', required: true },
          method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
          headers: { type: 'object' },
          body: { type: 'object' },
          dataPath: { type: 'string', description: 'JSON path to data array' },
          pagination: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['offset', 'cursor', 'page'] },
              pageParam: { type: 'string' },
              limitParam: { type: 'string' },
              limit: { type: 'number' },
            },
          },
        },
      },
      {
        type: 'graphql',
        name: 'GraphQL',
        category: 'api',
        configSchema: {
          url: { type: 'string', required: true },
          query: { type: 'string', required: true },
          variables: { type: 'object' },
          headers: { type: 'object' },
          dataPath: { type: 'string' },
        },
      },
      {
        type: 'csv',
        name: 'CSV File',
        category: 'file',
        configSchema: {
          url: { type: 'string', description: 'URL or file path' },
          content: { type: 'string', description: 'CSV content' },
          delimiter: { type: 'string', default: ',' },
          hasHeader: { type: 'boolean', default: true },
        },
      },
      {
        type: 'json',
        name: 'JSON File',
        category: 'file',
        configSchema: {
          url: { type: 'string', description: 'URL or file path' },
          content: { type: 'string', description: 'JSON content' },
          dataPath: { type: 'string' },
        },
      },
      {
        type: 's3',
        name: 'Amazon S3',
        category: 'cloud',
        configSchema: {
          bucket: { type: 'string', required: true },
          key: { type: 'string', required: true },
          region: { type: 'string', default: 'us-east-1' },
          accessKeyId: { type: 'string', required: true, secret: true },
          secretAccessKey: { type: 'string', required: true, secret: true },
          format: { type: 'string', enum: ['json', 'csv', 'parquet'] },
        },
      },
      {
        type: 'elasticsearch',
        name: 'Elasticsearch',
        category: 'database',
        configSchema: {
          url: { type: 'string', required: true },
          index: { type: 'string', required: true },
          query: { type: 'object' },
          username: { type: 'string' },
          password: { type: 'string', secret: true },
        },
      },
      {
        type: 'webhook',
        name: 'Webhook',
        category: 'api',
        configSchema: {
          url: { type: 'string', required: true },
          method: { type: 'string', enum: ['POST', 'PUT'], default: 'POST' },
          headers: { type: 'object' },
          batchSize: { type: 'number', default: 100 },
        },
      },
    ];
  }

  /**
   * Test a connector configuration
   */
  async testConnection(
    connectorType: ConnectorType,
    config: ConnectorConfig,
  ): Promise<{
    success: boolean;
    message: string;
    sampleData?: any[];
  }> {
    try {
      const sampleData = await this.fetchData(connectorType, {
        ...config,
        limit: 5,
      });
      return {
        success: true,
        message: 'Connection successful',
        sampleData: sampleData.slice(0, 5),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ==================== Source Connectors ====================

  private async fetchFromRestApi(config: ConnectorConfig): Promise<any[]> {
    const { url, method = 'GET', headers = {}, body, dataPath } = config;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract data from path
    if (dataPath) {
      return this.getValueByPath(data, dataPath) || [];
    }

    return Array.isArray(data) ? data : [data];
  }

  private async fetchFromJson(config: ConnectorConfig): Promise<any[]> {
    const { url, content, dataPath } = config;

    let data: any;

    if (content) {
      data = JSON.parse(content);
    } else if (url) {
      const response = await fetch(url);
      data = await response.json();
    } else {
      throw new Error('Either url or content must be provided');
    }

    if (dataPath) {
      return this.getValueByPath(data, dataPath) || [];
    }

    return Array.isArray(data) ? data : [data];
  }

  private async fetchFromCsv(config: ConnectorConfig): Promise<any[]> {
    const { url, content, delimiter = ',', hasHeader = true } = config;

    let csvContent: string;

    if (content) {
      csvContent = content;
    } else if (url) {
      const response = await fetch(url);
      csvContent = await response.text();
    } else {
      throw new Error('Either url or content must be provided');
    }

    return this.parseCsv(csvContent, delimiter, hasHeader);
  }

  private async fetchFromDatabase(
    connectorType: 'postgresql' | 'mysql',
    _config: ConnectorConfig,
  ): Promise<any[]> {
    // In production, use actual database connection
    // For now, return mock data
    this.logger.warn(`Database connector ${connectorType} not fully implemented`);
    return [];
  }

  private async fetchFromS3(_config: ConnectorConfig): Promise<any[]> {
    // In production, use AWS SDK
    this.logger.warn('S3 connector not fully implemented');
    return [];
  }

  private async fetchFromElasticsearch(config: ConnectorConfig): Promise<any[]> {
    const { url, index, query = { match_all: {} }, username, password } = config;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (username && password) {
      headers['Authorization'] =
        `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    const response = await fetch(`${url}/${index}/_search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, size: 10000 }),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.hits?.hits?.map((hit: any) => hit._source) || [];
  }

  // ==================== Destination Connectors ====================

  private async writeToRestApi(config: ConnectorConfig, data: any[]): Promise<void> {
    const { url, method = 'POST', headers = {}, batchSize = 100 } = config;

    // Send data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new Error(`API write failed: ${response.statusText}`);
      }
    }
  }

  private async writeToJson(config: ConnectorConfig, data: any[]): Promise<void> {
    // In production, write to file or storage
    this.logger.log(`Would write JSON: ${JSON.stringify(data).slice(0, 100)}...`);
  }

  private async writeToCsv(config: ConnectorConfig, data: any[]): Promise<void> {
    // In production, write to file or storage
    const csv = this.generateCsv(data, config.delimiter || ',');
    this.logger.log(`Would write CSV: ${csv.slice(0, 100)}...`);
  }

  private async writeToDatabase(
    connectorType: 'postgresql' | 'mysql',
    _config: ConnectorConfig,
    _data: any[],
  ): Promise<void> {
    // In production, use actual database connection
    this.logger.warn(`Database write to ${connectorType} not fully implemented`);
  }

  private async writeToS3(_config: ConnectorConfig, _data: any[]): Promise<void> {
    // In production, use AWS SDK
    this.logger.warn('S3 write not fully implemented');
  }

  private async writeToWebhook(config: ConnectorConfig, data: any[]): Promise<void> {
    const { url, method = 'POST', headers = {}, batchSize = 100 } = config;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          data: batch,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.statusText}`);
      }
    }
  }

  private async writeToElasticsearch(config: ConnectorConfig, data: any[]): Promise<void> {
    const { url, index, username, password } = config;

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-ndjson',
    };

    if (username && password) {
      headers['Authorization'] =
        `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    // Prepare bulk request
    const bulkBody =
      data
        .flatMap((doc) => [JSON.stringify({ index: { _index: index } }), JSON.stringify(doc)])
        .join('\n') + '\n';

    const response = await fetch(`${url}/_bulk`, {
      method: 'POST',
      headers,
      body: bulkBody,
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch bulk write failed: ${response.statusText}`);
    }
  }

  // ==================== Helper Methods ====================

  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  private parseCsv(content: string, delimiter: string, hasHeader: boolean): any[] {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return [];

    const parseRow = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    if (hasHeader) {
      const headers = parseRow(lines[0]);
      return lines.slice(1).map((line) => {
        const values = parseRow(line);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        return row;
      });
    } else {
      return lines.map((line) => parseRow(line));
    }
  }

  private generateCsv(data: any[], delimiter: string): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = [
      headers.join(delimiter),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            const str = String(value);
            return str.includes(delimiter) || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(delimiter),
      ),
    ];

    return rows.join('\n');
  }
}
