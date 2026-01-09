import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface MongoDBAtlasIntegration {
  accessToken: string; // Public API key
  refreshToken: string; // Private API key
  settings: {
    projectId: string;
    clusterName?: string;
  };
}

@Injectable()
export class MongoDBAtlasService {
  private readonly logger = new Logger(MongoDBAtlasService.name);
  private readonly baseUrl = 'https://cloud.mongodb.com/api/atlas/v2';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(
    integration: MongoDBAtlasIntegration,
  ): Record<string, string> {
    const credentials = Buffer.from(
      `${integration.accessToken}:${integration.refreshToken}`,
    ).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.atlas.2023-01-01+json',
    };
  }

  async testConnection(integration: MongoDBAtlasIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}`,
          { headers: this.getHeaders(integration) },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('MongoDB Atlas connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: MongoDBAtlasIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'clusters':
        return this.fetchClusters(integration, params);
      case 'databases':
        return this.fetchDatabases(integration, params);
      case 'collections':
        return this.fetchCollections(integration, params);
      case 'metrics':
        return this.fetchMetrics(integration, params);
      case 'alerts':
        return this.fetchAlerts(integration, params);
      case 'logs':
        return this.fetchLogs(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported MongoDB Atlas data type: ${dataType}`);
    }
  }

  private async fetchClusters(
    integration: MongoDBAtlasIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}/clusters`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas clusters', error);
      throw error;
    }
  }

  private async fetchDatabases(
    integration: MongoDBAtlasIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const clusterName =
        (params?.clusterName as string) || integration.settings.clusterName;

      if (!clusterName) {
        throw new Error('Cluster name is required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}/processes/${clusterName}/databases`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas databases', error);
      throw error;
    }
  }

  private async fetchCollections(
    integration: MongoDBAtlasIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const clusterName =
        (params?.clusterName as string) || integration.settings.clusterName;
      const databaseName = params?.databaseName as string;

      if (!clusterName || !databaseName) {
        throw new Error('Cluster name and database name are required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}/processes/${clusterName}/databases/${databaseName}/collections`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas collections', error);
      throw error;
    }
  }

  private async fetchMetrics(
    integration: MongoDBAtlasIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const clusterName =
        (params?.clusterName as string) || integration.settings.clusterName;
      const granularity = (params?.granularity as string) || 'PT1M';
      const period = (params?.period as string) || 'PT1H';

      if (!clusterName) {
        throw new Error('Cluster name is required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}/processes/${clusterName}:27017/measurements`,
          {
            headers: this.getHeaders(integration),
            params: {
              granularity,
              period,
              m: [
                'CONNECTIONS',
                'OPCOUNTER_CMD',
                'OPCOUNTER_QUERY',
                'OPCOUNTER_INSERT',
                'OPCOUNTER_UPDATE',
                'OPCOUNTER_DELETE',
                'SYSTEM_CPU_USER',
                'SYSTEM_MEMORY_USED',
                'DISK_PARTITION_SPACE_USED',
              ].join(','),
            },
          },
        ),
      );

      return response.data.measurements || [];
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas metrics', error);
      throw error;
    }
  }

  private async fetchAlerts(
    integration: MongoDBAtlasIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const status = params?.status as string;
      const pageNum = (params?.page as number) || 1;
      const itemsPerPage = (params?.limit as number) || 50;

      const queryParams: Record<string, unknown> = {
        pageNum,
        itemsPerPage,
        ...(status && { status }),
      };

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}/alerts`,
          {
            headers: this.getHeaders(integration),
            params: queryParams,
          },
        ),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas alerts', error);
      throw error;
    }
  }

  private async fetchLogs(
    integration: MongoDBAtlasIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const clusterName =
        (params?.clusterName as string) || integration.settings.clusterName;
      const logName = (params?.logName as string) || 'mongodb';

      if (!clusterName) {
        throw new Error('Cluster name is required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/groups/${integration.settings.projectId}/clusters/${clusterName}/logs/${logName}.gz`,
          {
            headers: this.getHeaders(integration),
            responseType: 'arraybuffer',
          },
        ),
      );

      return {
        content: response.data,
        contentType: 'application/gzip',
      };
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas logs', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: MongoDBAtlasIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [clusters, alerts, metrics] = await Promise.all([
        this.fetchClusters(integration, params),
        this.fetchAlerts(integration, { status: 'OPEN' }),
        this.fetchMetrics(integration, params),
      ]);

      const clustersArray = clusters as any[];
      const alertsArray = alerts as any[];
      const metricsArray = metrics as any[];

      // Process metrics
      const latestMetrics: Record<string, unknown> = {};
      metricsArray.forEach((metric: any) => {
        if (metric.dataPoints && metric.dataPoints.length > 0) {
          latestMetrics[metric.name] =
            metric.dataPoints[metric.dataPoints.length - 1].value;
        }
      });

      return {
        summary: {
          totalClusters: clustersArray.length,
          activeAlerts: alertsArray.length,
          healthyClusters: clustersArray.filter(
            (c) => c.stateName === 'IDLE' || c.stateName === 'CREATING',
          ).length,
        },
        clusters: clustersArray.map((c: any) => ({
          name: c.name,
          state: c.stateName,
          mongoDBVersion: c.mongoDBVersion,
          clusterType: c.clusterType,
        })),
        metrics: latestMetrics,
        recentAlerts: alertsArray.slice(0, 5),
      };
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB Atlas analytics', error);
      throw error;
    }
  }
}
