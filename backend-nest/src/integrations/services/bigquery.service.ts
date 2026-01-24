import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface BigQueryIntegration {
  accessToken: string; // OAuth2 access token
  refreshToken?: string;
  settings: {
    projectId: string;
    defaultDataset?: string;
    location?: string; // e.g., 'US', 'EU'
  };
}

@Injectable()
export class BigQueryService {
  private readonly logger = new Logger(BigQueryService.name);
  private readonly baseUrl = 'https://bigquery.googleapis.com/bigquery/v2';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: BigQueryIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: BigQueryIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/datasets`,
          { headers: this.getHeaders(integration) },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('BigQuery connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: BigQueryIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'query':
        return this.executeQuery(integration, params?.query as string, params);
      case 'datasets':
        return this.fetchDatasets(integration);
      case 'tables':
        return this.fetchTables(integration, params);
      case 'tableSchema':
        return this.fetchTableSchema(integration, params);
      case 'jobs':
        return this.fetchJobs(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported BigQuery data type: ${dataType}`);
    }
  }

  async executeQuery(
    integration: BigQueryIntegration,
    query: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const useLegacySql = (params?.useLegacySql as boolean) || false;
      const maxResults = (params?.maxResults as number) || 10000;
      const timeoutMs = (params?.timeoutMs as number) || 60000;
      const dryRun = (params?.dryRun as boolean) || false;

      const requestBody: Record<string, unknown> = {
        query,
        useLegacySql,
        maxResults,
        timeoutMs,
        dryRun,
      };

      if (integration.settings.defaultDataset) {
        requestBody.defaultDataset = {
          projectId: integration.settings.projectId,
          datasetId: integration.settings.defaultDataset,
        };
      }

      if (integration.settings.location) {
        requestBody.location = integration.settings.location;
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/projects/${integration.settings.projectId}/queries`,
          requestBody,
          { headers: this.getHeaders(integration) },
        ),
      );

      const data = response.data;

      // Handle job completion
      if (!data.jobComplete) {
        return this.waitForJob(integration, data.jobReference.jobId);
      }

      return this.formatQueryResult(data);
    } catch (error) {
      this.logger.error('Failed to execute BigQuery query', error);
      throw error;
    }
  }

  private async waitForJob(
    integration: BigQueryIntegration,
    jobId: string,
    maxRetries = 60,
  ): Promise<unknown> {
    for (let i = 0; i < maxRetries; i++) {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/queries/${jobId}`,
          { headers: this.getHeaders(integration) },
        ),
      );

      if (response.data.jobComplete) {
        return this.formatQueryResult(response.data);
      }

      // Wait 1 second before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Query timeout');
  }

  private formatQueryResult(data: any): unknown {
    const schema =
      data.schema?.fields?.map((field: any) => ({
        name: field.name,
        type: field.type,
        mode: field.mode,
        description: field.description,
      })) || [];

    const rows =
      data.rows?.map((row: any) => {
        const obj: Record<string, unknown> = {};
        row.f?.forEach((cell: any, index: number) => {
          const fieldName = schema[index]?.name || `column_${index}`;
          obj[fieldName] = cell.v;
        });
        return obj;
      }) || [];

    return {
      schema,
      rows,
      totalRows: parseInt(data.totalRows || '0'),
      totalBytesProcessed: parseInt(data.totalBytesProcessed || '0'),
      cacheHit: data.cacheHit || false,
      jobReference: data.jobReference,
    };
  }

  private async fetchDatasets(integration: BigQueryIntegration): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/datasets`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return (
        response.data.datasets?.map((ds: any) => ({
          id: ds.datasetReference.datasetId,
          location: ds.location,
          createdAt: ds.creationTime,
          labels: ds.labels,
        })) || []
      );
    } catch (error) {
      this.logger.error('Failed to fetch BigQuery datasets', error);
      throw error;
    }
  }

  private async fetchTables(
    integration: BigQueryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const datasetId = (params?.datasetId as string) || integration.settings.defaultDataset;
      if (!datasetId) {
        throw new Error('Dataset ID is required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/datasets/${datasetId}/tables`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return (
        response.data.tables?.map((table: any) => ({
          id: table.tableReference.tableId,
          type: table.type,
          createdAt: table.creationTime,
          expirationTime: table.expirationTime,
          labels: table.labels,
        })) || []
      );
    } catch (error) {
      this.logger.error('Failed to fetch BigQuery tables', error);
      throw error;
    }
  }

  private async fetchTableSchema(
    integration: BigQueryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const datasetId = (params?.datasetId as string) || integration.settings.defaultDataset;
      const tableId = params?.tableId as string;

      if (!datasetId || !tableId) {
        throw new Error('Dataset ID and Table ID are required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/datasets/${datasetId}/tables/${tableId}`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return {
        tableId: response.data.tableReference.tableId,
        type: response.data.type,
        numRows: response.data.numRows,
        numBytes: response.data.numBytes,
        schema: response.data.schema?.fields || [],
        createdAt: response.data.creationTime,
        lastModified: response.data.lastModifiedTime,
        description: response.data.description,
        partitioning: response.data.timePartitioning,
        clustering: response.data.clustering,
      };
    } catch (error) {
      this.logger.error('Failed to fetch BigQuery table schema', error);
      throw error;
    }
  }

  private async fetchJobs(
    integration: BigQueryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const maxResults = (params?.maxResults as number) || 50;
      const stateFilter = (params?.stateFilter as string) || 'done';

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/projects/${integration.settings.projectId}/jobs`, {
          headers: this.getHeaders(integration),
          params: {
            maxResults,
            stateFilter,
            projection: 'full',
          },
        }),
      );

      return (
        response.data.jobs?.map((job: any) => ({
          jobId: job.jobReference.jobId,
          state: job.state,
          status: job.status,
          statistics: {
            creationTime: job.statistics?.creationTime,
            startTime: job.statistics?.startTime,
            endTime: job.statistics?.endTime,
            totalBytesProcessed: job.statistics?.totalBytesProcessed,
            query: job.statistics?.query,
          },
          configuration: {
            jobType: job.configuration?.jobType,
            query: job.configuration?.query?.query?.substring(0, 200),
          },
        })) || []
      );
    } catch (error) {
      this.logger.error('Failed to fetch BigQuery jobs', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: BigQueryIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [datasets, recentJobs] = await Promise.all([
        this.fetchDatasets(integration),
        this.fetchJobs(integration, { maxResults: 100, stateFilter: 'done' }),
      ]);

      const datasetsArray = datasets as any[];
      const jobsArray = recentJobs as any[];

      // Calculate job statistics
      let totalBytesProcessed = 0;
      const totalJobs = jobsArray.length;
      let successfulJobs = 0;
      let failedJobs = 0;

      jobsArray.forEach((job: any) => {
        totalBytesProcessed += parseInt(job.statistics?.totalBytesProcessed || '0');
        if (job.state === 'DONE' && !job.status?.errorResult) {
          successfulJobs++;
        } else if (job.status?.errorResult) {
          failedJobs++;
        }
      });

      // Get table counts per dataset
      const datasetStats = await Promise.all(
        datasetsArray.slice(0, 5).map(async (ds: any) => {
          try {
            const tables = await this.fetchTables(integration, {
              datasetId: ds.id,
            });
            return {
              dataset: ds.id,
              tableCount: (tables as any[]).length,
              location: ds.location,
            };
          } catch {
            return { dataset: ds.id, tableCount: 0, location: ds.location };
          }
        }),
      );

      return {
        summary: {
          totalDatasets: datasetsArray.length,
          recentJobs: totalJobs,
          successfulJobs,
          failedJobs,
          successRate: totalJobs > 0 ? ((successfulJobs / totalJobs) * 100).toFixed(2) : '0',
          totalBytesProcessed,
          totalGBProcessed: (totalBytesProcessed / 1024 / 1024 / 1024).toFixed(2),
        },
        datasetStats,
        recentQueries: jobsArray.slice(0, 10).map((job: any) => ({
          jobId: job.jobId,
          state: job.state,
          query: job.configuration?.query,
          bytesProcessed: job.statistics?.totalBytesProcessed,
          duration:
            job.statistics?.endTime && job.statistics?.startTime
              ? parseInt(job.statistics.endTime) - parseInt(job.statistics.startTime)
              : null,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch BigQuery analytics', error);
      throw error;
    }
  }

  // Create a dataset
  async createDataset(
    integration: BigQueryIntegration,
    data: {
      datasetId: string;
      description?: string;
      location?: string;
      labels?: Record<string, string>;
    },
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/projects/${integration.settings.projectId}/datasets`,
          {
            datasetReference: {
              projectId: integration.settings.projectId,
              datasetId: data.datasetId,
            },
            description: data.description,
            location: data.location || integration.settings.location || 'US',
            labels: data.labels,
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create BigQuery dataset', error);
      throw error;
    }
  }

  // Load data from Cloud Storage
  async loadFromGCS(
    integration: BigQueryIntegration,
    data: {
      datasetId: string;
      tableId: string;
      sourceUris: string[];
      sourceFormat?: 'CSV' | 'JSON' | 'AVRO' | 'PARQUET' | 'ORC';
      writeDisposition?: 'WRITE_TRUNCATE' | 'WRITE_APPEND' | 'WRITE_EMPTY';
      schema?: { name: string; type: string; mode?: string }[];
    },
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/projects/${integration.settings.projectId}/jobs`,
          {
            configuration: {
              load: {
                destinationTable: {
                  projectId: integration.settings.projectId,
                  datasetId: data.datasetId,
                  tableId: data.tableId,
                },
                sourceUris: data.sourceUris,
                sourceFormat: data.sourceFormat || 'CSV',
                writeDisposition: data.writeDisposition || 'WRITE_APPEND',
                schema: data.schema ? { fields: data.schema } : undefined,
                autodetect: !data.schema,
              },
            },
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to load data from GCS to BigQuery', error);
      throw error;
    }
  }
}
