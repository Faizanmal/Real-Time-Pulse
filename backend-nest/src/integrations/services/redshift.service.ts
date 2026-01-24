import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

export interface RedshiftIntegration {
  accessToken: string; // AWS Access Key ID
  refreshToken: string; // AWS Secret Access Key
  settings: {
    clusterIdentifier: string;
    database: string;
    workgroupName?: string; // For Serverless
    region?: string; // AWS region
    dbUser?: string;
  };
}

@Injectable()
export class RedshiftService {
  private readonly logger = new Logger(RedshiftService.name);

  constructor(private readonly httpService: HttpService) {}

  private getRedshiftDataApiUrl(integration: RedshiftIntegration): string {
    const region = integration.settings.region || 'us-east-1';
    return `https://redshift-data.${region}.amazonaws.com`;
  }

  private getRedshiftApiUrl(integration: RedshiftIntegration): string {
    const region = integration.settings.region || 'us-east-1';
    return `https://redshift.${region}.amazonaws.com`;
  }

  private async signRequest(
    integration: RedshiftIntegration,
    method: string,
    url: string,
    body: string,
    service: string,
  ): Promise<Record<string, string>> {
    const region = integration.settings.region || 'us-east-1';
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = datetime.substring(0, 8);

    const host = new URL(url).host;
    const canonicalHeaders = `host:${host}\nx-amz-date:${datetime}\n`;
    const signedHeaders = 'host;x-amz-date';

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [method, '/', '', canonicalHeaders, signedHeaders, payloadHash].join(
      '\n',
    );

    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      datetime,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const kDate = crypto
      .createHmac('sha256', `AWS4${integration.refreshToken}`)
      .update(date)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization = [
      `AWS4-HMAC-SHA256 Credential=${integration.accessToken}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    return {
      Authorization: authorization,
      'X-Amz-Date': datetime,
      'Content-Type': 'application/x-amz-json-1.1',
      Host: host,
    };
  }

  async testConnection(integration: RedshiftIntegration): Promise<boolean> {
    try {
      const result = await this.executeStatement(integration, 'SELECT 1');
      return !!result;
    } catch (error) {
      this.logger.error('Redshift connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: RedshiftIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'query':
        return this.executeStatement(integration, params?.query as string, params);
      case 'schemas':
        return this.fetchSchemas(integration);
      case 'tables':
        return this.fetchTables(integration, params);
      case 'tableColumns':
        return this.fetchTableColumns(integration, params);
      case 'clusterInfo':
        return this.fetchClusterInfo(integration);
      case 'queryHistory':
        return this.fetchQueryHistory(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported Redshift data type: ${dataType}`);
    }
  }

  async executeStatement(
    integration: RedshiftIntegration,
    sql: string,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = this.getRedshiftDataApiUrl(integration);

      const requestBody: Record<string, unknown> = {
        ClusterIdentifier: integration.settings.clusterIdentifier,
        Database: integration.settings.database,
        Sql: sql,
      };

      if (integration.settings.dbUser) {
        requestBody.DbUser = integration.settings.dbUser;
      }

      if (integration.settings.workgroupName) {
        delete requestBody.ClusterIdentifier;
        requestBody.WorkgroupName = integration.settings.workgroupName;
      }

      const body = JSON.stringify(requestBody);
      const headers = await this.signRequest(integration, 'POST', url, body, 'redshift-data');
      headers['X-Amz-Target'] = 'RedshiftData.ExecuteStatement';

      const response = await firstValueFrom(this.httpService.post(url, body, { headers }));

      const statementId = response.data.Id;

      // Wait for statement completion
      return this.waitForStatementResult(integration, statementId);
    } catch (error) {
      this.logger.error('Failed to execute Redshift statement', error);
      throw error;
    }
  }

  private async waitForStatementResult(
    integration: RedshiftIntegration,
    statementId: string,
    maxRetries = 60,
  ): Promise<unknown> {
    const url = this.getRedshiftDataApiUrl(integration);

    for (let i = 0; i < maxRetries; i++) {
      const describeBody = JSON.stringify({ Id: statementId });
      const describeHeaders = await this.signRequest(
        integration,
        'POST',
        url,
        describeBody,
        'redshift-data',
      );
      describeHeaders['X-Amz-Target'] = 'RedshiftData.DescribeStatement';

      const statusResponse = await firstValueFrom(
        this.httpService.post(url, describeBody, { headers: describeHeaders }),
      );

      const status = statusResponse.data.Status;

      if (status === 'FINISHED') {
        // Get results
        const resultBody = JSON.stringify({ Id: statementId });
        const resultHeaders = await this.signRequest(
          integration,
          'POST',
          url,
          resultBody,
          'redshift-data',
        );
        resultHeaders['X-Amz-Target'] = 'RedshiftData.GetStatementResult';

        const resultResponse = await firstValueFrom(
          this.httpService.post(url, resultBody, { headers: resultHeaders }),
        );

        return this.formatQueryResult(resultResponse.data);
      } else if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(statusResponse.data.Error || `Query ${status.toLowerCase()}`);
      }

      // Wait 1 second before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Query timeout');
  }

  private formatQueryResult(data: any): unknown {
    const columns =
      data.ColumnMetadata?.map((col: any) => ({
        name: col.name,
        type: col.typeName,
        nullable: col.nullable,
        length: col.length,
        precision: col.precision,
        scale: col.scale,
      })) || [];

    const rows =
      data.Records?.map((row: any[]) =>
        row.reduce((obj: Record<string, unknown>, cell: any, index: number) => {
          const columnName = columns[index]?.name || `column_${index}`;
          // Extract value from cell (can be stringValue, longValue, doubleValue, etc.)
          obj[columnName] =
            cell.stringValue ??
            cell.longValue ??
            cell.doubleValue ??
            cell.booleanValue ??
            cell.blobValue ??
            null;
          return obj;
        }, {}),
      ) || [];

    return {
      columns,
      rows,
      totalRows: data.TotalNumRows || rows.length,
    };
  }

  private async fetchSchemas(integration: RedshiftIntegration): Promise<unknown> {
    return this.executeStatement(
      integration,
      `SELECT schema_name, schema_owner, schema_type
       FROM svv_all_schemas
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
       ORDER BY schema_name`,
    );
  }

  private async fetchTables(
    integration: RedshiftIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const schemaName = (params?.schemaName as string) || 'public';

    return this.executeStatement(
      integration,
      `SELECT table_name, table_type, table_schema
       FROM svv_tables
       WHERE table_schema = '${schemaName}'
       ORDER BY table_name`,
    );
  }

  private async fetchTableColumns(
    integration: RedshiftIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const schemaName = (params?.schemaName as string) || 'public';
    const tableName = params?.tableName as string;

    if (!tableName) {
      throw new Error('Table name is required');
    }

    return this.executeStatement(
      integration,
      `SELECT column_name, data_type, is_nullable, column_default, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = '${schemaName}' AND table_name = '${tableName}'
       ORDER BY ordinal_position`,
    );
  }

  private async fetchClusterInfo(integration: RedshiftIntegration): Promise<unknown> {
    const url = this.getRedshiftApiUrl(integration);

    const requestBody = {
      ClusterIdentifier: integration.settings.clusterIdentifier,
    };

    const body = JSON.stringify(requestBody);
    const headers = await this.signRequest(integration, 'POST', url, body, 'redshift');
    headers['X-Amz-Target'] = 'RedshiftServiceVersion20121201.DescribeClusters';

    try {
      const response = await firstValueFrom(this.httpService.post(url, body, { headers }));

      const cluster = response.data.Clusters?.[0];
      if (!cluster) {
        return null;
      }

      return {
        clusterIdentifier: cluster.ClusterIdentifier,
        nodeType: cluster.NodeType,
        numberOfNodes: cluster.NumberOfNodes,
        clusterStatus: cluster.ClusterStatus,
        masterUsername: cluster.MasterUsername,
        dbName: cluster.DBName,
        endpoint: cluster.Endpoint,
        clusterCreatedAt: cluster.ClusterCreateTime,
        clusterVersion: cluster.ClusterVersion,
        encrypted: cluster.Encrypted,
        vpcId: cluster.VpcId,
        availabilityZone: cluster.AvailabilityZone,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Redshift cluster info', error);
      throw error;
    }
  }

  private async fetchQueryHistory(
    integration: RedshiftIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const limit = (params?.limit as number) || 50;

    return this.executeStatement(
      integration,
      `SELECT query, querytxt, starttime, endtime, elapsed, aborted, database, userid
       FROM stl_query
       WHERE userid > 1
       ORDER BY starttime DESC
       LIMIT ${limit}`,
    );
  }

  private async fetchAnalytics(
    integration: RedshiftIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [tableStats, diskUsage, queryStats, clusterInfo] = await Promise.all([
        this.executeStatement(
          integration,
          `SELECT COUNT(*) as table_count,
                  SUM(tbl_rows) as total_rows,
                  SUM(size) as total_size_mb
           FROM svv_table_info`,
        ),
        this.executeStatement(
          integration,
          `SELECT SUM(used) as used_mb,
                  SUM(capacity) as capacity_mb,
                  ROUND(100.0 * SUM(used) / SUM(capacity), 2) as pct_used
           FROM stv_partitions
           WHERE part_begin = 0`,
        ),
        this.executeStatement(
          integration,
          `SELECT COUNT(*) as total_queries,
                  AVG(elapsed) / 1000000.0 as avg_duration_sec,
                  COUNT(CASE WHEN aborted = 1 THEN 1 END) as aborted_queries
           FROM stl_query
           WHERE starttime >= CURRENT_DATE - 1
             AND userid > 1`,
        ),
        this.fetchClusterInfo(integration),
      ]);

      const tableStatsRow = ((tableStats as any).rows || [])[0] || {};
      const diskUsageRow = ((diskUsage as any).rows || [])[0] || {};
      const queryStatsRow = ((queryStats as any).rows || [])[0] || {};

      return {
        summary: {
          tableCount: tableStatsRow.table_count || 0,
          totalRows: tableStatsRow.total_rows || 0,
          totalSizeMB: tableStatsRow.total_size_mb || 0,
          diskUsedMB: diskUsageRow.used_mb || 0,
          diskCapacityMB: diskUsageRow.capacity_mb || 0,
          diskUsedPercent: diskUsageRow.pct_used || 0,
          queriesLast24h: queryStatsRow.total_queries || 0,
          avgQueryDurationSec: queryStatsRow.avg_duration_sec || 0,
          abortedQueries: queryStatsRow.aborted_queries || 0,
        },
        clusterInfo: clusterInfo || {},
      };
    } catch (error) {
      this.logger.error('Failed to fetch Redshift analytics', error);
      throw error;
    }
  }

  // Create table
  async createTable(
    integration: RedshiftIntegration,
    data: {
      tableName: string;
      schemaName?: string;
      columns: {
        name: string;
        type: string;
        nullable?: boolean;
        default?: string;
      }[];
      sortKey?: string[];
      distKey?: string;
    },
  ): Promise<unknown> {
    const schemaName = data.schemaName || 'public';
    const columnDefs = data.columns
      .map((col) => {
        let def = `${col.name} ${col.type}`;
        if (col.nullable === false) def += ' NOT NULL';
        if (col.default) def += ` DEFAULT ${col.default}`;
        return def;
      })
      .join(', ');

    let sql = `CREATE TABLE ${schemaName}.${data.tableName} (${columnDefs})`;

    if (data.distKey) {
      sql += ` DISTKEY(${data.distKey})`;
    }
    if (data.sortKey && data.sortKey.length > 0) {
      sql += ` SORTKEY(${data.sortKey.join(', ')})`;
    }

    return this.executeStatement(integration, sql);
  }

  // Copy data from S3
  async copyFromS3(
    integration: RedshiftIntegration,
    data: {
      tableName: string;
      schemaName?: string;
      s3Path: string;
      iamRole: string;
      format?: 'CSV' | 'JSON' | 'PARQUET' | 'ORC' | 'AVRO';
      delimiter?: string;
      ignoreHeader?: number;
    },
  ): Promise<unknown> {
    const schemaName = data.schemaName || 'public';
    let sql = `COPY ${schemaName}.${data.tableName}
               FROM '${data.s3Path}'
               IAM_ROLE '${data.iamRole}'`;

    switch (data.format) {
      case 'JSON':
        sql += ` FORMAT AS JSON 'auto'`;
        break;
      case 'PARQUET':
        sql += ` FORMAT AS PARQUET`;
        break;
      case 'ORC':
        sql += ` FORMAT AS ORC`;
        break;
      case 'AVRO':
        sql += ` FORMAT AS AVRO 'auto'`;
        break;
      default:
        if (data.delimiter) {
          sql += ` DELIMITER '${data.delimiter}'`;
        }
        if (data.ignoreHeader) {
          sql += ` IGNOREHEADER ${data.ignoreHeader}`;
        }
    }

    return this.executeStatement(integration, sql);
  }
}
