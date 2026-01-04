import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

interface AzureMonitorIntegration {
  accessToken: string; // Azure AD Access Token
  refreshToken?: string;
  settings: {
    subscriptionId: string;
    tenantId: string;
    resourceGroup?: string;
  };
}

@Injectable()
export class AzureMonitorService {
  private readonly logger = new Logger(AzureMonitorService.name);
  private readonly managementUrl = 'https://management.azure.com';
  private readonly monitorUrl = 'https://management.azure.com';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: AzureMonitorIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: AzureMonitorIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.managementUrl}/subscriptions/${integration.settings.subscriptionId}?api-version=2020-01-01`,
          { headers: this.getHeaders(integration) },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Azure Monitor connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: AzureMonitorIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'metrics':
        return this.fetchMetrics(integration, params);
      case 'metricDefinitions':
        return this.fetchMetricDefinitions(integration, params);
      case 'alertRules':
        return this.fetchAlertRules(integration, params);
      case 'actionGroups':
        return this.fetchActionGroups(integration, params);
      case 'activityLog':
        return this.fetchActivityLog(integration, params);
      case 'resources':
        return this.fetchResources(integration, params);
      case 'logQuery':
        return this.queryLogs(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported Azure Monitor data type: ${dataType}`);
    }
  }

  private async fetchMetrics(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const resourceUri = params?.resourceUri as string;
      const metricNames = params?.metricNames as string[];
      const timespan = (params?.timespan as string) || 'PT1H';
      const interval = (params?.interval as string) || 'PT5M';
      const aggregation = (params?.aggregation as string) || 'Average';

      if (!resourceUri) {
        throw new Error('Resource URI is required');
      }

      const queryParams = new URLSearchParams({
        'api-version': '2021-05-01',
        timespan,
        interval,
        aggregation,
      });

      if (metricNames && metricNames.length > 0) {
        queryParams.set('metricnames', metricNames.join(','));
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.monitorUrl}${resourceUri}/providers/Microsoft.Insights/metrics?${queryParams.toString()}`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return {
        metrics:
          response.data.value?.map((metric: any) => ({
            name: metric.name.value,
            displayName: metric.name.localizedValue,
            unit: metric.unit,
            timeseries: metric.timeseries?.map((ts: any) => ({
              metadataValues: ts.metadatavalues,
              data: ts.data?.map((d: any) => ({
                timeStamp: d.timeStamp,
                average: d.average,
                minimum: d.minimum,
                maximum: d.maximum,
                total: d.total,
                count: d.count,
              })),
            })),
          })) || [],
        cost: response.data.cost,
        interval: response.data.interval,
        timespan: response.data.timespan,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure metrics', error);
      throw error;
    }
  }

  private async fetchMetricDefinitions(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const resourceUri = params?.resourceUri as string;

      if (!resourceUri) {
        throw new Error('Resource URI is required');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.monitorUrl}${resourceUri}/providers/Microsoft.Insights/metricDefinitions?api-version=2021-05-01`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return {
        metricDefinitions:
          response.data.value?.map((md: any) => ({
            name: md.name.value,
            displayName: md.name.localizedValue,
            namespace: md.namespace,
            unit: md.unit,
            primaryAggregationType: md.primaryAggregationType,
            supportedAggregationTypes: md.supportedAggregationTypes,
            dimensions: md.dimensions,
          })) || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure metric definitions', error);
      throw error;
    }
  }

  private async fetchAlertRules(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const resourceGroup = (params?.resourceGroup as string) || integration.settings.resourceGroup;

      let url = `${this.managementUrl}/subscriptions/${integration.settings.subscriptionId}`;
      if (resourceGroup) {
        url += `/resourceGroups/${resourceGroup}`;
      }
      url += `/providers/Microsoft.Insights/metricAlerts?api-version=2018-03-01`;

      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.getHeaders(integration) }),
      );

      return {
        alertRules:
          response.data.value?.map((rule: any) => ({
            id: rule.id,
            name: rule.name,
            type: rule.type,
            location: rule.location,
            description: rule.properties.description,
            severity: rule.properties.severity,
            enabled: rule.properties.enabled,
            scopes: rule.properties.scopes,
            evaluationFrequency: rule.properties.evaluationFrequency,
            windowSize: rule.properties.windowSize,
            criteria: rule.properties.criteria,
            actions: rule.properties.actions,
          })) || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure alert rules', error);
      throw error;
    }
  }

  private async fetchActionGroups(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const resourceGroup = (params?.resourceGroup as string) || integration.settings.resourceGroup;

      let url = `${this.managementUrl}/subscriptions/${integration.settings.subscriptionId}`;
      if (resourceGroup) {
        url += `/resourceGroups/${resourceGroup}`;
      }
      url += `/providers/Microsoft.Insights/actionGroups?api-version=2019-06-01`;

      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.getHeaders(integration) }),
      );

      return {
        actionGroups:
          response.data.value?.map((group: any) => ({
            id: group.id,
            name: group.name,
            location: group.location,
            groupShortName: group.properties.groupShortName,
            enabled: group.properties.enabled,
            emailReceivers: group.properties.emailReceivers,
            smsReceivers: group.properties.smsReceivers,
            webhookReceivers: group.properties.webhookReceivers,
            azureFunctionReceivers: group.properties.azureFunctionReceivers,
          })) || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure action groups', error);
      throw error;
    }
  }

  private async fetchActivityLog(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const startTime =
        (params?.startTime as string) || new Date(Date.now() - 86400000).toISOString();
      const endTime = (params?.endTime as string) || new Date().toISOString();

      const filter = `eventTimestamp ge '${startTime}' and eventTimestamp le '${endTime}'`;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.managementUrl}/subscriptions/${integration.settings.subscriptionId}/providers/Microsoft.Insights/eventtypes/management/values?api-version=2015-04-01&$filter=${encodeURIComponent(filter)}`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return {
        events:
          response.data.value?.map((event: any) => ({
            id: event.id,
            level: event.level,
            operationName: event.operationName.value,
            resourceGroupName: event.resourceGroupName,
            resourceType: event.resourceType.value,
            resourceId: event.resourceId,
            status: event.status.value,
            eventTimestamp: event.eventTimestamp,
            caller: event.caller,
            category: event.category.value,
          })) || [],
        nextLink: response.data.nextLink,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure activity log', error);
      throw error;
    }
  }

  private async fetchResources(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const filter = params?.filter as string;

      let url = `${this.managementUrl}/subscriptions/${integration.settings.subscriptionId}/resources?api-version=2021-04-01`;
      if (filter) {
        url += `&$filter=${encodeURIComponent(filter)}`;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.getHeaders(integration) }),
      );

      return {
        resources:
          response.data.value?.map((resource: any) => ({
            id: resource.id,
            name: resource.name,
            type: resource.type,
            location: resource.location,
            resourceGroup: resource.id.split('/')[4],
            tags: resource.tags,
          })) || [],
        nextLink: response.data.nextLink,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure resources', error);
      throw error;
    }
  }

  private async queryLogs(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const workspaceId = params?.workspaceId as string;
      const query = params?.query as string;
      const timespan = (params?.timespan as string) || 'PT1H';

      if (!workspaceId || !query) {
        throw new Error('Workspace ID and query are required');
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `https://api.loganalytics.io/v1/workspaces/${workspaceId}/query`,
          {
            query,
            timespan,
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      const tables = response.data.tables || [];
      const result: Record<string, unknown>[] = [];

      if (tables.length > 0) {
        const columns = tables[0].columns || [];
        const rows = tables[0].rows || [];

        rows.forEach((row: any[]) => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col: any, idx: number) => {
            obj[col.name] = row[idx];
          });
          result.push(obj);
        });
      }

      return { results: result };
    } catch (error) {
      this.logger.error('Failed to query Azure logs', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: AzureMonitorIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [resources, alertRules, actionGroups, activityLog] = await Promise.all([
        this.fetchResources(integration, {}),
        this.fetchAlertRules(integration, {}),
        this.fetchActionGroups(integration, {}),
        this.fetchActivityLog(integration, {}),
      ]);

      const resourcesArray = (resources as any).resources || [];
      const rulesArray = (alertRules as any).alertRules || [];
      const groupsArray = (actionGroups as any).actionGroups || [];
      const eventsArray = (activityLog as any).events || [];

      // Resource type breakdown
      const resourceTypes: Record<string, number> = {};
      resourcesArray.forEach((r: any) => {
        const type = r.type || 'Unknown';
        resourceTypes[type] = (resourceTypes[type] || 0) + 1;
      });

      // Activity by operation
      const operationCounts: Record<string, number> = {};
      eventsArray.forEach((e: any) => {
        const op = e.operationName || 'Unknown';
        operationCounts[op] = (operationCounts[op] || 0) + 1;
      });

      // Alert severity breakdown
      const alertsBySeverity: Record<number, number> = {};
      rulesArray.forEach((rule: any) => {
        const severity = rule.severity ?? 3;
        alertsBySeverity[severity] = (alertsBySeverity[severity] || 0) + 1;
      });

      const enabledAlerts = rulesArray.filter((r: any) => r.enabled).length;

      return {
        summary: {
          totalResources: resourcesArray.length,
          totalAlertRules: rulesArray.length,
          enabledAlertRules: enabledAlerts,
          totalActionGroups: groupsArray.length,
          activityEventsLast24h: eventsArray.length,
          subscriptionId: integration.settings.subscriptionId,
        },
        resourceTypeBreakdown: Object.entries(resourceTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([type, count]) => ({ type, count })),
        alertsBySeverity: Object.entries(alertsBySeverity).map(([severity, count]) => ({
          severity: parseInt(severity),
          count,
        })),
        recentActivity: eventsArray.slice(0, 10).map((e: any) => ({
          operation: e.operationName,
          status: e.status,
          resource: e.resourceId?.split('/').pop(),
          timestamp: e.eventTimestamp,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Azure Monitor analytics', error);
      throw error;
    }
  }

  // Create metric alert rule
  async createMetricAlert(
    integration: AzureMonitorIntegration,
    data: {
      name: string;
      resourceGroup: string;
      description?: string;
      severity: number;
      enabled?: boolean;
      scopes: string[];
      evaluationFrequency: string;
      windowSize: string;
      criteria: {
        metricName: string;
        metricNamespace: string;
        operator: string;
        threshold: number;
        aggregation: string;
      };
      actionGroupIds: string[];
    },
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.managementUrl}/subscriptions/${integration.settings.subscriptionId}/resourceGroups/${data.resourceGroup}/providers/Microsoft.Insights/metricAlerts/${data.name}?api-version=2018-03-01`,
          {
            location: 'global',
            properties: {
              description: data.description || '',
              severity: data.severity,
              enabled: data.enabled ?? true,
              scopes: data.scopes,
              evaluationFrequency: data.evaluationFrequency,
              windowSize: data.windowSize,
              criteria: {
                'odata.type':
                  'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria',
                allOf: [
                  {
                    criterionType: 'StaticThresholdCriterion',
                    name: 'Metric1',
                    metricName: data.criteria.metricName,
                    metricNamespace: data.criteria.metricNamespace,
                    operator: data.criteria.operator,
                    threshold: data.criteria.threshold,
                    timeAggregation: data.criteria.aggregation,
                  },
                ],
              },
              actions: data.actionGroupIds.map((id) => ({ actionGroupId: id })),
            },
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Azure metric alert', error);
      throw error;
    }
  }
}
