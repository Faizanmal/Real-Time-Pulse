import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SnowflakeIntegration {
  accessToken: string; // JWT Token or Key Pair Token
  refreshToken?: string;
  settings: {
    account: string; // Account identifier (e.g., xy12345.us-east-1)
    warehouse?: string;
    database?: string;
    schema?: string;
    role?: string;
  };
}

@Injectable()
export class SnowflakeService {
  private readonly logger = new Logger(SnowflakeService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: SnowflakeIntegration): string {
    return `https://${integration.settings.account}.snowflakecomputing.com/api/v2`;
  }

  private getHeaders(
    integration: SnowflakeIntegration,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
      'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
    };
  }

  async testConnection(integration: SnowflakeIntegration): Promise<boolean> {
    try {
      // Test with a simple query
      const result = await this.executeQuery(
        integration,
        'SELECT CURRENT_VERSION()',
      );
      return !!result;
    } catch (error) {
      this.logger.error('Snowflake connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: SnowflakeIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'query':
        return this.executeQuery(integration, params?.query as string, params);
      case 'databases':
        return this.fetchDatabases(integration);
      case 'schemas':
        return this.fetchSchemas(integration, params);
      case 'tables':
        return this.fetchTables(integration, params);
      case 'warehouses':
        return this.fetchWarehouses(integration);
      case 'queryHistory':
        return this.fetchQueryHistory(integration, params);
      case 'storageUsage':
        return this.fetchStorageUsage(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported Snowflake data type: ${dataType}`);
    }
  }

  async executeQuery(
    integration: SnowflakeIntegration,
    query: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const warehouse =
        (params?.warehouse as string) || integration.settings.warehouse;
      const database =
        (params?.database as string) || integration.settings.database;
      const schema = (params?.schema as string) || integration.settings.schema;
      const role = (params?.role as string) || integration.settings.role;

      const requestBody: Record<string, unknown> = {
        statement: query,
        timeout: (params?.timeout as number) || 60,
        resultSetMetaData: {
          format: 'json',
        },
      };

      if (warehouse) requestBody.warehouse = warehouse;
      if (database) requestBody.database = database;
      if (schema) requestBody.schema = schema;
      if (role) requestBody.role = role;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl(integration)}/statements`,
          requestBody,
          { headers: this.getHeaders(integration) },
        ),
      );

      // Handle async queries
      if (response.data.statementHandle) {
        return this.waitForQueryResult(
          integration,
          response.data.statementHandle,
        );
      }

      return this.formatQueryResult(response.data);
    } catch (error) {
      this.logger.error('Failed to execute Snowflake query', error);
      throw error;
    }
  }

  private async waitForQueryResult(
    integration: SnowflakeIntegration,
    statementHandle: string,
    maxRetries: number = 60,
  ): Promise<unknown> {
    for (let i = 0; i < maxRetries; i++) {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/statements/${statementHandle}`,
          { headers: this.getHeaders(integration) },
        ),
      );

      const status = response.data.statementStatusUrl ? 'running' : 'complete';

      if (status === 'complete') {
        return this.formatQueryResult(response.data);
      }

      // Wait 1 second before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Query timeout');
  }

  private formatQueryResult(data: any): unknown {
    if (!data.data) {
      return { columns: [], rows: [], rowCount: 0 };
    }

    const columns =
      data.resultSetMetaData?.rowType?.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
      })) || [];

    return {
      columns,
      rows: data.data,
      rowCount: data.data.length,
      statementHandle: data.statementHandle,
    };
  }

  private async fetchDatabases(
    integration: SnowflakeIntegration,
  ): Promise<unknown> {
    return this.executeQuery(integration, 'SHOW DATABASES');
  }

  private async fetchSchemas(
    integration: SnowflakeIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const database =
      (params?.database as string) || integration.settings.database;
    const query = database
      ? `SHOW SCHEMAS IN DATABASE ${database}`
      : 'SHOW SCHEMAS';
    return this.executeQuery(integration, query);
  }

  private async fetchTables(
    integration: SnowflakeIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const database =
      (params?.database as string) || integration.settings.database;
    const schema = (params?.schema as string) || integration.settings.schema;

    let query = 'SHOW TABLES';
    if (schema && database) {
      query = `SHOW TABLES IN ${database}.${schema}`;
    } else if (database) {
      query = `SHOW TABLES IN DATABASE ${database}`;
    }

    return this.executeQuery(integration, query);
  }

  private async fetchWarehouses(
    integration: SnowflakeIntegration,
  ): Promise<unknown> {
    return this.executeQuery(integration, 'SHOW WAREHOUSES');
  }

  private async fetchQueryHistory(
    integration: SnowflakeIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const limit = (params?.limit as number) || 100;
    const hours = (params?.hours as number) || 24;

    return this.executeQuery(
      integration,
      `
      SELECT 
        QUERY_ID,
        QUERY_TEXT,
        DATABASE_NAME,
        SCHEMA_NAME,
        QUERY_TYPE,
        SESSION_ID,
        USER_NAME,
        WAREHOUSE_NAME,
        WAREHOUSE_SIZE,
        START_TIME,
        END_TIME,
        TOTAL_ELAPSED_TIME,
        BYTES_SCANNED,
        ROWS_PRODUCED,
        EXECUTION_STATUS,
        ERROR_CODE,
        ERROR_MESSAGE
      FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
      WHERE START_TIME >= DATEADD(HOUR, -${hours}, CURRENT_TIMESTAMP())
      ORDER BY START_TIME DESC
      LIMIT ${limit}
      `,
    );
  }

  private async fetchStorageUsage(
    integration: SnowflakeIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const days = (params?.days as number) || 30;

    return this.executeQuery(
      integration,
      `
      SELECT 
        USAGE_DATE,
        DATABASE_NAME,
        AVERAGE_DATABASE_BYTES,
        AVERAGE_FAILSAFE_BYTES
      FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY
      WHERE USAGE_DATE >= DATEADD(DAY, -${days}, CURRENT_DATE())
      ORDER BY USAGE_DATE DESC
      `,
    );
  }

  private async fetchAnalytics(
    integration: SnowflakeIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 7;

      const [queryStats, warehouseUsage, storageUsage, userActivity] =
        await Promise.all([
          this.executeQuery(
            integration,
            `
          SELECT 
            COUNT(*) as total_queries,
            AVG(TOTAL_ELAPSED_TIME) as avg_execution_time,
            SUM(BYTES_SCANNED) as total_bytes_scanned,
            SUM(ROWS_PRODUCED) as total_rows_produced,
            COUNT(CASE WHEN EXECUTION_STATUS = 'SUCCESS' THEN 1 END) as successful_queries,
            COUNT(CASE WHEN EXECUTION_STATUS = 'FAIL' THEN 1 END) as failed_queries
          FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
          WHERE START_TIME >= DATEADD(DAY, -${days}, CURRENT_TIMESTAMP())
          `,
          ),
          this.executeQuery(
            integration,
            `
          SELECT 
            WAREHOUSE_NAME,
            SUM(CREDITS_USED) as credits_used,
            AVG(AVG_RUNNING) as avg_running_queries
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
          WHERE START_TIME >= DATEADD(DAY, -${days}, CURRENT_TIMESTAMP())
          GROUP BY WAREHOUSE_NAME
          ORDER BY credits_used DESC
          `,
          ),
          this.executeQuery(
            integration,
            `
          SELECT 
            SUM(AVERAGE_DATABASE_BYTES) / 1024 / 1024 / 1024 as total_storage_gb,
            SUM(AVERAGE_FAILSAFE_BYTES) / 1024 / 1024 / 1024 as failsafe_storage_gb
          FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY
          WHERE USAGE_DATE = CURRENT_DATE()
          `,
          ),
          this.executeQuery(
            integration,
            `
          SELECT 
            USER_NAME,
            COUNT(*) as query_count,
            SUM(TOTAL_ELAPSED_TIME) as total_execution_time
          FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
          WHERE START_TIME >= DATEADD(DAY, -${days}, CURRENT_TIMESTAMP())
          GROUP BY USER_NAME
          ORDER BY query_count DESC
          LIMIT 10
          `,
          ),
        ]);

      const queryStatsData = (queryStats as any).rows?.[0] || {};
      const storageData = (storageUsage as any).rows?.[0] || {};

      return {
        summary: {
          totalQueries: queryStatsData[0] || 0,
          avgExecutionTimeMs: queryStatsData[1] || 0,
          totalBytesScanned: queryStatsData[2] || 0,
          totalRowsProduced: queryStatsData[3] || 0,
          successfulQueries: queryStatsData[4] || 0,
          failedQueries: queryStatsData[5] || 0,
          successRate:
            queryStatsData[0] > 0
              ? ((queryStatsData[4] / queryStatsData[0]) * 100).toFixed(2)
              : '0',
          totalStorageGB: storageData[0] || 0,
          failsafeStorageGB: storageData[1] || 0,
          period: `${days} days`,
        },
        warehouseUsage: (warehouseUsage as any).rows || [],
        topUsers: (userActivity as any).rows || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch Snowflake analytics', error);
      throw error;
    }
  }

  // Create a stage for data loading
  async createStage(
    integration: SnowflakeIntegration,
    data: {
      stageName: string;
      stageType?: 'internal' | 's3' | 'azure' | 'gcs';
      url?: string;
      credentials?: Record<string, string>;
    },
  ): Promise<unknown> {
    let query = `CREATE OR REPLACE STAGE ${data.stageName}`;

    if (data.stageType === 's3' && data.url) {
      query += ` URL='${data.url}'`;
      if (data.credentials?.aws_key_id) {
        query += ` CREDENTIALS=(AWS_KEY_ID='${data.credentials.aws_key_id}' AWS_SECRET_KEY='${data.credentials.aws_secret_key}')`;
      }
    } else if (data.stageType === 'azure' && data.url) {
      query += ` URL='${data.url}'`;
      if (data.credentials?.azure_sas_token) {
        query += ` CREDENTIALS=(AZURE_SAS_TOKEN='${data.credentials.azure_sas_token}')`;
      }
    } else if (data.stageType === 'gcs' && data.url) {
      query += ` URL='${data.url}'`;
    }

    return this.executeQuery(integration, query);
  }
}
