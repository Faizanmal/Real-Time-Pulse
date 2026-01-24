import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface AWSCloudWatchIntegration {
  accessToken: string; // AWS Access Key ID
  refreshToken: string; // AWS Secret Access Key
  settings: {
    region: string;
    sessionToken?: string;
  };
}

@Injectable()
export class AWSCloudWatchService {
  private readonly logger = new Logger(AWSCloudWatchService.name);

  constructor(private readonly httpService: HttpService) {}

  private getEndpoint(integration: AWSCloudWatchIntegration, service: string): string {
    return `https://${service}.${integration.settings.region}.amazonaws.com`;
  }

  private async signRequest(
    integration: AWSCloudWatchIntegration,
    service: string,
    method: string,
    path: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<Record<string, string>> {
    // AWS Signature V4 signing - simplified implementation
    // In production, use @aws-sdk/signature-v4 or aws-sdk
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

    const signedHeaders: Record<string, string> = {
      ...headers,
      'x-amz-date': timestamp,
      host: `${service}.${integration.settings.region}.amazonaws.com`,
    };

    if (integration.settings.sessionToken) {
      signedHeaders['x-amz-security-token'] = integration.settings.sessionToken;
    }

    // Note: This is a simplified version. For production, use proper AWS SDK
    return signedHeaders;
  }

  async testConnection(integration: AWSCloudWatchIntegration): Promise<boolean> {
    try {
      // Use AWS SDK or make a simple API call to verify credentials
      const endpoint = this.getEndpoint(integration, 'monitoring');
      const headers = await this.signRequest(integration, 'monitoring', 'POST', '/', '', {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const response = await firstValueFrom(
        this.httpService.post(endpoint, 'Action=DescribeAlarms&Version=2010-08-01&MaxRecords=1', {
          headers,
        }),
      );

      return response.status === 200;
    } catch (error) {
      this.logger.error('AWS CloudWatch connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: AWSCloudWatchIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'metrics':
        return this.fetchMetrics(integration, params);
      case 'alarms':
        return this.fetchAlarms(integration, params);
      case 'logs':
        return this.fetchLogs(integration, params);
      case 'dashboards':
        return this.fetchDashboards(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'insights':
        return this.fetchInsights(integration, params);
      default:
        throw new Error(`Unsupported AWS CloudWatch data type: ${dataType}`);
    }
  }

  private async fetchMetrics(
    integration: AWSCloudWatchIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const namespace = params?.namespace as string;
      const metricName = params?.metricName as string;
      const dimensions = params?.dimensions as Record<string, string>;
      const period = (params?.period as number) || 300;
      const startTime =
        (params?.startTime as string) || new Date(Date.now() - 3600000).toISOString();
      const endTime = (params?.endTime as string) || new Date().toISOString();
      const statistics = (params?.statistics as string[]) || [
        'Average',
        'Sum',
        'Maximum',
        'Minimum',
      ];

      const queryParams: Record<string, unknown> = {
        Action: 'GetMetricStatistics',
        Version: '2010-08-01',
        Namespace: namespace || 'AWS/EC2',
        MetricName: metricName || 'CPUUtilization',
        StartTime: startTime,
        EndTime: endTime,
        Period: period,
      };

      statistics.forEach((stat, index) => {
        queryParams[`Statistics.member.${index + 1}`] = stat;
      });

      if (dimensions) {
        Object.entries(dimensions).forEach(([key, value], index) => {
          queryParams[`Dimensions.member.${index + 1}.Name`] = key;
          queryParams[`Dimensions.member.${index + 1}.Value`] = value;
        });
      }

      const queryString = new URLSearchParams(queryParams as any).toString();
      const endpoint = this.getEndpoint(integration, 'monitoring');
      const headers = await this.signRequest(integration, 'monitoring', 'POST', '/', queryString, {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const response = await firstValueFrom(
        this.httpService.post(endpoint, queryString, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch AWS CloudWatch metrics', error);
      throw error;
    }
  }

  private async fetchAlarms(
    integration: AWSCloudWatchIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const stateValue = params?.stateValue as string;
      const maxRecords = (params?.limit as number) || 50;

      const queryParams: Record<string, unknown> = {
        Action: 'DescribeAlarms',
        Version: '2010-08-01',
        MaxRecords: maxRecords,
      };

      if (stateValue) {
        queryParams.StateValue = stateValue;
      }

      const queryString = new URLSearchParams(queryParams as any).toString();
      const endpoint = this.getEndpoint(integration, 'monitoring');
      const headers = await this.signRequest(integration, 'monitoring', 'POST', '/', queryString, {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const response = await firstValueFrom(
        this.httpService.post(endpoint, queryString, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch AWS CloudWatch alarms', error);
      throw error;
    }
  }

  private async fetchLogs(
    integration: AWSCloudWatchIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const logGroupName = params?.logGroupName as string;
      const logStreamName = params?.logStreamName as string;
      const limit = (params?.limit as number) || 100;
      const startTime = (params?.startTime as number) || Date.now() - 3600000;
      const endTime = (params?.endTime as number) || Date.now();

      if (!logGroupName) {
        throw new Error('Log group name is required');
      }

      const requestBody = {
        logGroupName,
        limit,
        startTime,
        endTime,
        ...(logStreamName && { logStreamName }),
      };

      const endpoint = this.getEndpoint(integration, 'logs');
      const headers = await this.signRequest(
        integration,
        'logs',
        'POST',
        '/',
        JSON.stringify(requestBody),
        {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'Logs_20140328.FilterLogEvents',
        },
      );

      const response = await firstValueFrom(
        this.httpService.post(endpoint, requestBody, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch AWS CloudWatch logs', error);
      throw error;
    }
  }

  private async fetchDashboards(
    integration: AWSCloudWatchIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const queryParams = {
        Action: 'ListDashboards',
        Version: '2010-08-01',
      };

      const queryString = new URLSearchParams(queryParams).toString();
      const endpoint = this.getEndpoint(integration, 'monitoring');
      const headers = await this.signRequest(integration, 'monitoring', 'POST', '/', queryString, {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const response = await firstValueFrom(
        this.httpService.post(endpoint, queryString, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch AWS CloudWatch dashboards', error);
      throw error;
    }
  }

  private async fetchInsights(
    integration: AWSCloudWatchIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const logGroupName = params?.logGroupName as string;
      const queryString = params?.queryString as string;
      const startTime = (params?.startTime as number) || Date.now() - 3600000;
      const endTime = (params?.endTime as number) || Date.now();

      if (!logGroupName || !queryString) {
        throw new Error('Log group name and query string are required');
      }

      const requestBody = {
        logGroupName,
        queryString,
        startTime: Math.floor(startTime / 1000),
        endTime: Math.floor(endTime / 1000),
      };

      const endpoint = this.getEndpoint(integration, 'logs');
      const headers = await this.signRequest(
        integration,
        'logs',
        'POST',
        '/',
        JSON.stringify(requestBody),
        {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'Logs_20140328.StartQuery',
        },
      );

      const response = await firstValueFrom(
        this.httpService.post(endpoint, requestBody, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to start AWS CloudWatch Insights query', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: AWSCloudWatchIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [alarms, dashboards] = await Promise.all([
        this.fetchAlarms(integration, { limit: 100 }),
        this.fetchDashboards(integration, params),
      ]);

      const alarmsData = alarms as any;
      const dashboardsData = dashboards as any;

      // Parse alarms
      const alarmList =
        alarmsData?.DescribeAlarmsResponse?.DescribeAlarmsResult?.MetricAlarms || [];
      const dashboardList =
        dashboardsData?.ListDashboardsResponse?.ListDashboardsResult?.DashboardEntries || [];

      const alarmsByState: Record<string, number> = {};
      alarmList.forEach((alarm: any) => {
        const state = alarm.StateValue || 'UNKNOWN';
        alarmsByState[state] = (alarmsByState[state] || 0) + 1;
      });

      return {
        summary: {
          totalAlarms: alarmList.length,
          alarmsInAlarm: alarmsByState['ALARM'] || 0,
          alarmsOk: alarmsByState['OK'] || 0,
          alarmsInsufficientData: alarmsByState['INSUFFICIENT_DATA'] || 0,
          totalDashboards: dashboardList.length,
        },
        alarmsByState,
        recentAlarms: alarmList.slice(0, 10).map((a: any) => ({
          name: a.AlarmName,
          state: a.StateValue,
          metric: a.MetricName,
          namespace: a.Namespace,
        })),
        dashboards: dashboardList.map((d: any) => ({
          name: d.DashboardName,
          lastModified: d.LastModified,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS CloudWatch analytics', error);
      throw error;
    }
  }
}
