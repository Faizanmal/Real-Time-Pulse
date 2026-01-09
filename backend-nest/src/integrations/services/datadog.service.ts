import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface DatadogIntegration {
  accessToken: string; // API Key
  refreshToken?: string; // Application Key
  settings: {
    site?: string; // e.g., 'datadoghq.com', 'datadoghq.eu'
  };
}

@Injectable()
export class DatadogService {
  private readonly logger = new Logger(DatadogService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: DatadogIntegration): string {
    const site = integration.settings.site || 'datadoghq.com';
    return `https://api.${site}`;
  }

  private getHeaders(integration: DatadogIntegration): Record<string, string> {
    return {
      'DD-API-KEY': integration.accessToken,
      'DD-APPLICATION-KEY': integration.refreshToken || '',
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: DatadogIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/api/v1/validate`,
          {
            headers: this.getHeaders(integration),
          },
        ),
      );
      return response.data.valid === true;
    } catch (error) {
      this.logger.error('Datadog connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: DatadogIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'metrics':
        return this.fetchMetrics(integration, params);
      case 'monitors':
        return this.fetchMonitors(integration, params);
      case 'events':
        return this.fetchEvents(integration, params);
      case 'dashboards':
        return this.fetchDashboards(integration, params);
      case 'hosts':
        return this.fetchHosts(integration, params);
      case 'logs':
        return this.fetchLogs(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'apm':
        return this.fetchAPM(integration, params);
      default:
        throw new Error(`Unsupported Datadog data type: ${dataType}`);
    }
  }

  private async fetchMetrics(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const query = params?.query as string;
      const from =
        (params?.from as number) || Math.floor((Date.now() - 3600000) / 1000);
      const to = (params?.to as number) || Math.floor(Date.now() / 1000);

      if (!query) {
        // List available metrics
        const response = await firstValueFrom(
          this.httpService.get(
            `${this.getBaseUrl(integration)}/api/v1/metrics`,
            {
              headers: this.getHeaders(integration),
              params: { from: from - 3600 },
            },
          ),
        );
        return response.data.metrics || [];
      }

      // Query specific metrics
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/api/v1/query`, {
          headers: this.getHeaders(integration),
          params: { query, from, to },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Datadog metrics', error);
      throw error;
    }
  }

  private async fetchMonitors(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;
      const monitorTags = params?.tags as string;

      const queryParams: Record<string, unknown> = {
        page_size: pageSize,
        ...(monitorTags && { monitor_tags: monitorTags }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/api/v1/monitor`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Datadog monitors', error);
      throw error;
    }
  }

  private async fetchEvents(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const start =
        (params?.start as number) || Math.floor((Date.now() - 86400000) / 1000);
      const end = (params?.end as number) || Math.floor(Date.now() / 1000);
      const priority = params?.priority as string;
      const sources = params?.sources as string;

      const queryParams: Record<string, unknown> = {
        start,
        end,
        ...(priority && { priority }),
        ...(sources && { sources }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/api/v1/events`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.events || [];
    } catch (error) {
      this.logger.error('Failed to fetch Datadog events', error);
      throw error;
    }
  }

  private async fetchDashboards(
    integration: DatadogIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/api/v1/dashboard`,
          {
            headers: this.getHeaders(integration),
          },
        ),
      );

      return response.data.dashboards || [];
    } catch (error) {
      this.logger.error('Failed to fetch Datadog dashboards', error);
      throw error;
    }
  }

  private async fetchHosts(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const count = (params?.limit as number) || 100;
      const filter = params?.filter as string;

      const queryParams: Record<string, unknown> = {
        count,
        ...(filter && { filter }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/api/v1/hosts`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Datadog hosts', error);
      throw error;
    }
  }

  private async fetchLogs(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const query = (params?.query as string) || '*';
      const from =
        (params?.from as string) ||
        new Date(Date.now() - 3600000).toISOString();
      const to = (params?.to as string) || new Date().toISOString();
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl(integration)}/api/v2/logs/events/search`,
          {
            filter: {
              query,
              from,
              to,
            },
            page: {
              limit,
            },
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Datadog logs', error);
      throw error;
    }
  }

  private async fetchAPM(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const env = (params?.env as string) || 'production';
      const service = params?.service as string;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/api/v1/service_dependencies`,
          {
            headers: this.getHeaders(integration),
            params: {
              env,
              ...(service && { service }),
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Datadog APM data', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: DatadogIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [monitors, hosts, dashboards, events] = await Promise.all([
        this.fetchMonitors(integration, { limit: 100 }),
        this.fetchHosts(integration, { limit: 100 }),
        this.fetchDashboards(integration, params),
        this.fetchEvents(integration, { priority: 'normal' }),
      ]);

      const monitorsArray = monitors as any[];
      const hostsData = hosts as any;
      const dashboardsArray = dashboards as any[];
      const eventsArray = events as any[];

      // Monitor status breakdown
      const monitorsByStatus: Record<string, number> = {};
      monitorsArray.forEach((monitor: any) => {
        const status = monitor.overall_state || 'Unknown';
        monitorsByStatus[status] = (monitorsByStatus[status] || 0) + 1;
      });

      return {
        summary: {
          totalMonitors: monitorsArray.length,
          alertingMonitors: monitorsByStatus['Alert'] || 0,
          okMonitors: monitorsByStatus['OK'] || 0,
          warnMonitors: monitorsByStatus['Warn'] || 0,
          totalHosts: hostsData.total_matching || 0,
          upHosts:
            hostsData.host_list?.filter((h: any) => h.is_muted === false)
              .length || 0,
          totalDashboards: dashboardsArray.length,
          recentEvents: eventsArray.length,
        },
        monitorsByStatus,
        recentAlerts: monitorsArray
          .filter((m: any) => m.overall_state === 'Alert')
          .slice(0, 5)
          .map((m: any) => ({
            name: m.name,
            type: m.type,
            message: m.message,
          })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Datadog analytics', error);
      throw error;
    }
  }
}
