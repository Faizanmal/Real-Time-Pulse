import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface PagerDutyIntegration {
  accessToken: string; // API Token
  settings: {
    serviceId?: string;
    escalationPolicyId?: string;
  };
}

@Injectable()
export class PagerDutyService {
  private readonly logger = new Logger(PagerDutyService.name);
  private readonly baseUrl = 'https://api.pagerduty.com';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: PagerDutyIntegration): Record<string, string> {
    return {
      Authorization: `Token token=${integration.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.pagerduty+json;version=2',
    };
  }

  async testConnection(integration: PagerDutyIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/abilities`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('PagerDuty connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: PagerDutyIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'incidents':
        return this.fetchIncidents(integration, params);
      case 'services':
        return this.fetchServices(integration, params);
      case 'users':
        return this.fetchUsers(integration, params);
      case 'teams':
        return this.fetchTeams(integration, params);
      case 'escalationPolicies':
        return this.fetchEscalationPolicies(integration, params);
      case 'oncalls':
        return this.fetchOnCalls(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'alerts':
        return this.fetchAlerts(integration, params);
      default:
        throw new Error(`Unsupported PagerDuty data type: ${dataType}`);
    }
  }

  private async fetchIncidents(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const statuses = (params?.statuses as string[]) || ['triggered', 'acknowledged'];
      const since = (params?.since as string) || new Date(Date.now() - 7 * 86400000).toISOString();
      const until = (params?.until as string) || new Date().toISOString();
      const serviceId = (params?.serviceId as string) || integration.settings.serviceId;

      const queryParams: Record<string, unknown> = {
        limit,
        'statuses[]': statuses,
        since,
        until,
        sort_by: 'created_at:desc',
      };

      if (serviceId) {
        queryParams['service_ids[]'] = serviceId;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/incidents`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.incidents || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty incidents', error);
      throw error;
    }
  }

  private async fetchServices(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const query = params?.query as string;

      const queryParams: Record<string, unknown> = {
        limit,
        include: ['integrations', 'escalation_policies'],
      };

      if (query) {
        queryParams.query = query;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/services`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.services || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty services', error);
      throw error;
    }
  }

  private async fetchUsers(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users`, {
          headers: this.getHeaders(integration),
          params: { limit },
        }),
      );

      return response.data.users || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty users', error);
      throw error;
    }
  }

  private async fetchTeams(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/teams`, {
          headers: this.getHeaders(integration),
          params: { limit },
        }),
      );

      return response.data.teams || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty teams', error);
      throw error;
    }
  }

  private async fetchEscalationPolicies(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/escalation_policies`, {
          headers: this.getHeaders(integration),
          params: { limit },
        }),
      );

      return response.data.escalation_policies || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty escalation policies', error);
      throw error;
    }
  }

  private async fetchOnCalls(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const escalationPolicyId =
        (params?.escalationPolicyId as string) ||
        integration.settings.escalationPolicyId;

      const queryParams: Record<string, unknown> = {
        include: ['users', 'escalation_policies'],
      };

      if (escalationPolicyId) {
        queryParams['escalation_policy_ids[]'] = escalationPolicyId;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/oncalls`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.oncalls || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty on-calls', error);
      throw error;
    }
  }

  private async fetchAlerts(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const incidentId = params?.incidentId as string;

      if (!incidentId) {
        throw new Error('Incident ID is required to fetch alerts');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/incidents/${incidentId}/alerts`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data.alerts || [];
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty alerts', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: PagerDutyIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [triggeredIncidents, acknowledgedIncidents, resolvedIncidents, services, oncalls] =
        await Promise.all([
          this.fetchIncidents(integration, { statuses: ['triggered'], limit: 100 }),
          this.fetchIncidents(integration, { statuses: ['acknowledged'], limit: 100 }),
          this.fetchIncidents(integration, { statuses: ['resolved'], limit: 100 }),
          this.fetchServices(integration, { limit: 100 }),
          this.fetchOnCalls(integration, params),
        ]);

      const triggeredArray = triggeredIncidents as any[];
      const acknowledgedArray = acknowledgedIncidents as any[];
      const resolvedArray = resolvedIncidents as any[];
      const servicesArray = services as any[];
      const oncallsArray = oncalls as any[];

      // Calculate urgency breakdown
      const urgencyBreakdown: Record<string, number> = { high: 0, low: 0 };
      [...triggeredArray, ...acknowledgedArray].forEach((incident: any) => {
        const urgency = incident.urgency || 'low';
        urgencyBreakdown[urgency]++;
      });

      // Service health
      const serviceHealth: Record<string, { incidents: number; status: string }> = {};
      servicesArray.forEach((service: any) => {
        serviceHealth[service.name] = {
          incidents: 0,
          status: service.status || 'active',
        };
      });

      [...triggeredArray, ...acknowledgedArray].forEach((incident: any) => {
        const serviceName = incident.service?.summary || 'Unknown';
        if (serviceHealth[serviceName]) {
          serviceHealth[serviceName].incidents++;
        }
      });

      // Calculate MTTR (Mean Time To Resolution)
      let totalResolutionTime = 0;
      let resolutionCount = 0;
      resolvedArray.forEach((incident: any) => {
        if (incident.created_at && incident.last_status_change_at) {
          const created = new Date(incident.created_at).getTime();
          const resolved = new Date(incident.last_status_change_at).getTime();
          totalResolutionTime += resolved - created;
          resolutionCount++;
        }
      });
      const mttr = resolutionCount > 0 ? totalResolutionTime / resolutionCount / 1000 / 60 : 0;

      return {
        summary: {
          triggeredIncidents: triggeredArray.length,
          acknowledgedIncidents: acknowledgedArray.length,
          resolvedIncidents: resolvedArray.length,
          highUrgency: urgencyBreakdown.high,
          lowUrgency: urgencyBreakdown.low,
          totalServices: servicesArray.length,
          currentlyOnCall: oncallsArray.length,
          meanTimeToResolutionMinutes: Math.round(mttr),
          period: '7 days',
        },
        urgencyBreakdown,
        recentIncidents: [...triggeredArray, ...acknowledgedArray]
          .slice(0, 5)
          .map((incident: any) => ({
            id: incident.id,
            title: incident.title,
            status: incident.status,
            urgency: incident.urgency,
            service: incident.service?.summary,
            createdAt: incident.created_at,
          })),
        serviceHealth: Object.entries(serviceHealth).map(([name, data]) => ({
          name,
          ...data,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch PagerDuty analytics', error);
      throw error;
    }
  }

  // Create incident
  async createIncident(
    integration: PagerDutyIntegration,
    data: {
      title: string;
      serviceId: string;
      urgency?: 'high' | 'low';
      body?: string;
    },
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/incidents`,
          {
            incident: {
              type: 'incident',
              title: data.title,
              service: {
                id: data.serviceId,
                type: 'service_reference',
              },
              urgency: data.urgency || 'high',
              body: data.body ? { type: 'incident_body', details: data.body } : undefined,
            },
          },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.incident;
    } catch (error) {
      this.logger.error('Failed to create PagerDuty incident', error);
      throw error;
    }
  }
}
