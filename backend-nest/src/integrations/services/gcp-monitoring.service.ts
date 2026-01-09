import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GcpMonitoringIntegration {
  accessToken: string; // OAuth2 access token
  refreshToken?: string;
  settings: {
    projectId: string;
  };
}

@Injectable()
export class GcpMonitoringService {
  private readonly logger = new Logger(GcpMonitoringService.name);
  private readonly baseUrl = 'https://monitoring.googleapis.com/v3';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(
    integration: GcpMonitoringIntegration,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(
    integration: GcpMonitoringIntegration,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/metricDescriptors`,
          {
            headers: this.getHeaders(integration),
            params: { pageSize: 1 },
          },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('GCP Monitoring connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: GcpMonitoringIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'timeSeries':
        return this.fetchTimeSeries(integration, params);
      case 'metricDescriptors':
        return this.fetchMetricDescriptors(integration, params);
      case 'monitoredResources':
        return this.fetchMonitoredResources(integration, params);
      case 'alertPolicies':
        return this.fetchAlertPolicies(integration, params);
      case 'notificationChannels':
        return this.fetchNotificationChannels(integration, params);
      case 'uptimeChecks':
        return this.fetchUptimeChecks(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported GCP Monitoring data type: ${dataType}`);
    }
  }

  private async fetchTimeSeries(
    integration: GcpMonitoringIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const filter = params?.filter as string;
      const interval = params?.interval as {
        startTime: string;
        endTime: string;
      };
      const aggregation = params?.aggregation as {
        alignmentPeriod: string;
        perSeriesAligner: string;
        crossSeriesReducer?: string;
        groupByFields?: string[];
      };

      if (!filter) {
        throw new Error('Filter is required for timeSeries query');
      }

      const endTime = interval?.endTime || new Date().toISOString();
      const startTime =
        interval?.startTime || new Date(Date.now() - 3600000).toISOString();

      const queryParams: Record<string, unknown> = {
        filter,
        'interval.startTime': startTime,
        'interval.endTime': endTime,
      };

      if (aggregation) {
        queryParams['aggregation.alignmentPeriod'] =
          aggregation.alignmentPeriod;
        queryParams['aggregation.perSeriesAligner'] =
          aggregation.perSeriesAligner;
        if (aggregation.crossSeriesReducer) {
          queryParams['aggregation.crossSeriesReducer'] =
            aggregation.crossSeriesReducer;
        }
        if (aggregation.groupByFields) {
          aggregation.groupByFields.forEach((field, i) => {
            queryParams[`aggregation.groupByFields[${i}]`] = field;
          });
        }
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/timeSeries`,
          {
            headers: this.getHeaders(integration),
            params: queryParams,
          },
        ),
      );

      return {
        timeSeries:
          response.data.timeSeries?.map((ts: any) => ({
            metric: ts.metric,
            resource: ts.resource,
            metricKind: ts.metricKind,
            valueType: ts.valueType,
            points: ts.points?.map((p: any) => ({
              interval: p.interval,
              value: p.value,
            })),
          })) || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP time series', error);
      throw error;
    }
  }

  private async fetchMetricDescriptors(
    integration: GcpMonitoringIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const filter = params?.filter as string;
      const pageSize = (params?.pageSize as number) || 100;

      const queryParams: Record<string, unknown> = { pageSize };
      if (filter) queryParams.filter = filter;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/metricDescriptors`,
          {
            headers: this.getHeaders(integration),
            params: queryParams,
          },
        ),
      );

      return {
        metricDescriptors:
          response.data.metricDescriptors?.map((md: any) => ({
            name: md.name,
            type: md.type,
            displayName: md.displayName,
            description: md.description,
            metricKind: md.metricKind,
            valueType: md.valueType,
            unit: md.unit,
            labels: md.labels,
          })) || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP metric descriptors', error);
      throw error;
    }
  }

  private async fetchMonitoredResources(
    integration: GcpMonitoringIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const filter = params?.filter as string;
      const pageSize = (params?.pageSize as number) || 100;

      const queryParams: Record<string, unknown> = { pageSize };
      if (filter) queryParams.filter = filter;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/monitoredResourceDescriptors`,
          {
            headers: this.getHeaders(integration),
            params: queryParams,
          },
        ),
      );

      return {
        resourceDescriptors: response.data.resourceDescriptors || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP monitored resources', error);
      throw error;
    }
  }

  private async fetchAlertPolicies(
    integration: GcpMonitoringIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.pageSize as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/alertPolicies`,
          {
            headers: this.getHeaders(integration),
            params: { pageSize },
          },
        ),
      );

      return {
        alertPolicies:
          response.data.alertPolicies?.map((policy: any) => ({
            name: policy.name,
            displayName: policy.displayName,
            enabled: policy.enabled,
            conditions: policy.conditions,
            combiner: policy.combiner,
            notificationChannels: policy.notificationChannels,
            documentation: policy.documentation,
            creationRecord: policy.creationRecord,
          })) || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP alert policies', error);
      throw error;
    }
  }

  private async fetchNotificationChannels(
    integration: GcpMonitoringIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.pageSize as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/notificationChannels`,
          {
            headers: this.getHeaders(integration),
            params: { pageSize },
          },
        ),
      );

      return {
        notificationChannels:
          response.data.notificationChannels?.map((channel: any) => ({
            name: channel.name,
            type: channel.type,
            displayName: channel.displayName,
            enabled: channel.enabled,
            labels: channel.labels,
            verificationStatus: channel.verificationStatus,
          })) || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP notification channels', error);
      throw error;
    }
  }

  private async fetchUptimeChecks(
    integration: GcpMonitoringIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.pageSize as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/projects/${integration.settings.projectId}/uptimeCheckConfigs`,
          {
            headers: this.getHeaders(integration),
            params: { pageSize },
          },
        ),
      );

      return {
        uptimeCheckConfigs:
          response.data.uptimeCheckConfigs?.map((check: any) => ({
            name: check.name,
            displayName: check.displayName,
            monitoredResource: check.monitoredResource,
            httpCheck: check.httpCheck,
            tcpCheck: check.tcpCheck,
            period: check.period,
            timeout: check.timeout,
            isInternal: check.isInternal,
          })) || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP uptime checks', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: GcpMonitoringIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [alertPolicies, channels, uptimeChecks] = await Promise.all([
        this.fetchAlertPolicies(integration, { pageSize: 100 }),
        this.fetchNotificationChannels(integration, { pageSize: 100 }),
        this.fetchUptimeChecks(integration, { pageSize: 100 }),
      ]);

      const policies = (alertPolicies as any).alertPolicies || [];
      const channelsArray = (channels as any).notificationChannels || [];
      const checks = (uptimeChecks as any).uptimeCheckConfigs || [];

      // Try to get CPU utilization for last hour
      let cpuMetrics: any = null;
      try {
        cpuMetrics = await this.fetchTimeSeries(integration, {
          filter:
            'metric.type="compute.googleapis.com/instance/cpu/utilization"',
          aggregation: {
            alignmentPeriod: '300s',
            perSeriesAligner: 'ALIGN_MEAN',
            crossSeriesReducer: 'REDUCE_MEAN',
          },
        });
      } catch {
        // CPU metrics might not be available
      }

      const enabledPolicies = policies.filter((p: any) => p.enabled).length;
      const enabledChannels = channelsArray.filter(
        (c: any) => c.enabled,
      ).length;

      return {
        summary: {
          totalAlertPolicies: policies.length,
          enabledAlertPolicies: enabledPolicies,
          totalNotificationChannels: channelsArray.length,
          enabledNotificationChannels: enabledChannels,
          totalUptimeChecks: checks.length,
          projectId: integration.settings.projectId,
        },
        alertPoliciesSummary: policies.slice(0, 10).map((p: any) => ({
          name: p.displayName,
          enabled: p.enabled,
          conditionsCount: p.conditions?.length || 0,
        })),
        uptimeChecksSummary: checks.slice(0, 10).map((c: any) => ({
          name: c.displayName,
          period: c.period,
          resource: c.monitoredResource?.type,
        })),
        recentCpuMetrics:
          cpuMetrics?.timeSeries?.[0]?.points?.slice(0, 12) || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch GCP Monitoring analytics', error);
      throw error;
    }
  }

  // Create an alert policy
  async createAlertPolicy(
    integration: GcpMonitoringIntegration,
    data: {
      displayName: string;
      conditions: {
        displayName: string;
        conditionThreshold: {
          filter: string;
          comparison: string;
          thresholdValue: number;
          duration: string;
          aggregations?: {
            alignmentPeriod: string;
            perSeriesAligner: string;
          }[];
        };
      }[];
      notificationChannels?: string[];
      documentation?: { content: string; mimeType: string };
    },
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/projects/${integration.settings.projectId}/alertPolicies`,
          {
            displayName: data.displayName,
            conditions: data.conditions,
            combiner: 'OR',
            enabled: true,
            notificationChannels: data.notificationChannels,
            documentation: data.documentation,
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create GCP alert policy', error);
      throw error;
    }
  }
}
