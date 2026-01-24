import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface NewRelicIntegration {
  accessToken: string; // API Key (User API Key or REST API Key)
  settings: {
    accountId: string;
    region?: 'us' | 'eu'; // Default: us
    applicationId?: string;
  };
}

@Injectable()
export class NewRelicService {
  private readonly logger = new Logger(NewRelicService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: NewRelicIntegration): string {
    const region = integration.settings.region || 'us';
    return region === 'eu' ? 'https://api.eu.newrelic.com' : 'https://api.newrelic.com';
  }

  private getGraphQLUrl(integration: NewRelicIntegration): string {
    const region = integration.settings.region || 'us';
    return region === 'eu'
      ? 'https://api.eu.newrelic.com/graphql'
      : 'https://api.newrelic.com/graphql';
  }

  private getHeaders(integration: NewRelicIntegration): Record<string, string> {
    return {
      'Api-Key': integration.accessToken,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: NewRelicIntegration): Promise<boolean> {
    try {
      const query = `{
        actor {
          user {
            email
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.status === 200 && !response.data.errors;
    } catch (error) {
      this.logger.error('New Relic connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: NewRelicIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'applications':
        return this.fetchApplications(integration, params);
      case 'apmMetrics':
        return this.fetchApmMetrics(integration, params);
      case 'alerts':
        return this.fetchAlerts(integration, params);
      case 'synthetics':
        return this.fetchSynthetics(integration, params);
      case 'infrastructure':
        return this.fetchInfrastructure(integration, params);
      case 'nrql':
        return this.executeNrql(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'errorAnalytics':
        return this.fetchErrorAnalytics(integration, params);
      default:
        throw new Error(`Unsupported New Relic data type: ${dataType}`);
    }
  }

  private async fetchApplications(
    integration: NewRelicIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/v2/applications.json`, {
          headers: this.getHeaders(integration),
          params: {
            'filter[name]': params?.name,
          },
        }),
      );

      return response.data.applications || [];
    } catch (error) {
      this.logger.error('Failed to fetch New Relic applications', error);
      throw error;
    }
  }

  private async fetchApmMetrics(
    integration: NewRelicIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const appId = (params?.applicationId as string) || integration.settings.applicationId;
      if (!appId) {
        throw new Error('Application ID is required');
      }

      const from = (params?.from as string) || new Date(Date.now() - 3600000).toISOString();
      const to = (params?.to as string) || new Date().toISOString();

      const query = `{
        actor {
          account(id: ${integration.settings.accountId}) {
            nrql(query: "SELECT average(duration), percentile(duration, 95), count(*) FROM Transaction WHERE appId = ${appId} SINCE '${from}' UNTIL '${to}' FACET transactionType TIMESERIES AUTO") {
              results
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data?.actor?.account?.nrql?.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch New Relic APM metrics', error);
      throw error;
    }
  }

  private async fetchAlerts(
    integration: NewRelicIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const query = `{
        actor {
          account(id: ${integration.settings.accountId}) {
            alerts {
              incidentsSearch(searchCriteria: {}) {
                incidents {
                  incidentId
                  title
                  priority
                  state
                  createdAt
                  closedAt
                  violationUrl
                  policyName
                  conditionName
                }
                totalCount
              }
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return (
        response.data.data?.actor?.account?.alerts?.incidentsSearch || {
          incidents: [],
          totalCount: 0,
        }
      );
    } catch (error) {
      this.logger.error('Failed to fetch New Relic alerts', error);
      throw error;
    }
  }

  private async fetchSynthetics(
    integration: NewRelicIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const query = `{
        actor {
          entitySearch(query: "domain = 'SYNTH' AND accountId = ${integration.settings.accountId}") {
            results {
              entities {
                ... on SyntheticMonitorEntityOutline {
                  name
                  guid
                  monitorType
                  monitoredUrl
                  period
                  monitorSummary {
                    status
                    successRate
                    locationsFailing
                    locationsRunning
                  }
                }
              }
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data?.actor?.entitySearch?.results?.entities || [];
    } catch (error) {
      this.logger.error('Failed to fetch New Relic synthetics', error);
      throw error;
    }
  }

  private async fetchInfrastructure(
    integration: NewRelicIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const query = `{
        actor {
          account(id: ${integration.settings.accountId}) {
            nrql(query: "SELECT average(cpuPercent), average(memoryUsedPercent), average(diskUsedPercent) FROM SystemSample FACET hostname SINCE 1 hour ago LIMIT 50") {
              results
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data?.actor?.account?.nrql?.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch New Relic infrastructure', error);
      throw error;
    }
  }

  private async executeNrql(
    integration: NewRelicIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const nrqlQuery = params?.query as string;
      if (!nrqlQuery) {
        throw new Error('NRQL query is required');
      }

      const query = `{
        actor {
          account(id: ${integration.settings.accountId}) {
            nrql(query: "${nrqlQuery.replace(/"/g, '\\"')}") {
              results
              nrql
              totalResult
              metadata {
                facets
                eventTypes
                messages
              }
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data?.actor?.account?.nrql || {};
    } catch (error) {
      this.logger.error('Failed to execute NRQL query', error);
      throw error;
    }
  }

  private async fetchErrorAnalytics(
    integration: NewRelicIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const appId = (params?.applicationId as string) || integration.settings.applicationId;
      const since = (params?.since as string) || '1 day ago';

      const query = `{
        actor {
          account(id: ${integration.settings.accountId}) {
            errors: nrql(query: "SELECT count(*) FROM TransactionError ${appId ? `WHERE appId = ${appId}` : ''} FACET error.class, error.message SINCE ${since} LIMIT 20") {
              results
            }
            errorRate: nrql(query: "SELECT percentage(count(*), WHERE error IS true) as 'Error Rate' FROM Transaction ${appId ? `WHERE appId = ${appId}` : ''} TIMESERIES AUTO SINCE ${since}") {
              results
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return {
        errors: response.data.data?.actor?.account?.errors?.results || [],
        errorRate: response.data.data?.actor?.account?.errorRate?.results || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch New Relic error analytics', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: NewRelicIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const since = (params?.since as string) || '1 day ago';

      const query = `{
        actor {
          account(id: ${integration.settings.accountId}) {
            transactionCount: nrql(query: "SELECT count(*) FROM Transaction SINCE ${since}") {
              results
            }
            avgDuration: nrql(query: "SELECT average(duration) FROM Transaction SINCE ${since}") {
              results
            }
            errorRate: nrql(query: "SELECT percentage(count(*), WHERE error IS true) FROM Transaction SINCE ${since}") {
              results
            }
            throughput: nrql(query: "SELECT rate(count(*), 1 minute) FROM Transaction SINCE ${since} TIMESERIES AUTO") {
              results
            }
            apdex: nrql(query: "SELECT apdex(duration, t: 0.5) FROM Transaction SINCE ${since}") {
              results
            }
            topTransactions: nrql(query: "SELECT count(*), average(duration) FROM Transaction FACET name SINCE ${since} LIMIT 10") {
              results
            }
          }
        }
      }`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      const data = response.data.data?.actor?.account || {};

      return {
        summary: {
          totalTransactions: data.transactionCount?.results?.[0]?.count || 0,
          averageDuration: data.avgDuration?.results?.[0]?.['average.duration'] || 0,
          errorRate: data.errorRate?.results?.[0]?.result || 0,
          apdexScore: data.apdex?.results?.[0]?.apdex || 0,
          period: since,
        },
        throughputTimeSeries: data.throughput?.results || [],
        topTransactions: data.topTransactions?.results || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch New Relic analytics', error);
      throw error;
    }
  }

  // Create alert condition
  async createAlertCondition(
    integration: NewRelicIntegration,
    data: {
      policyId: string;
      name: string;
      type: string;
      nrqlQuery: string;
      threshold: number;
      operator: 'ABOVE' | 'BELOW' | 'EQUALS';
    },
  ): Promise<unknown> {
    try {
      const mutation = `
        mutation {
          alertsNrqlConditionStaticCreate(
            accountId: ${integration.settings.accountId}
            policyId: "${data.policyId}"
            condition: {
              name: "${data.name}"
              enabled: true
              nrql: {
                query: "${data.nrqlQuery.replace(/"/g, '\\"')}"
              }
              signal: {
                aggregationMethod: EVENT_FLOW
                aggregationWindow: 60
              }
              terms: [{
                threshold: ${data.threshold}
                thresholdDuration: 300
                thresholdOccurrences: AT_LEAST_ONCE
                operator: ${data.operator}
                priority: CRITICAL
              }]
            }
          ) {
            id
            name
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post(
          this.getGraphQLUrl(integration),
          { query: mutation },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data?.alertsNrqlConditionStaticCreate;
    } catch (error) {
      this.logger.error('Failed to create New Relic alert condition', error);
      throw error;
    }
  }
}
