import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface FreshdeskIntegration {
  accessToken: string; // API key
  settings: {
    domain: string; // e.g., 'yourcompany' for yourcompany.freshdesk.com
  };
}

@Injectable()
export class FreshdeskService {
  private readonly logger = new Logger(FreshdeskService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: FreshdeskIntegration): string {
    return `https://${integration.settings.domain}.freshdesk.com/api/v2`;
  }

  private getHeaders(integration: FreshdeskIntegration): Record<string, string> {
    const credentials = Buffer.from(`${integration.accessToken}:X`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: FreshdeskIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/agents/me`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Freshdesk connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: FreshdeskIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'tickets':
        return this.fetchTickets(integration, params);
      case 'contacts':
        return this.fetchContacts(integration, params);
      case 'companies':
        return this.fetchCompanies(integration, params);
      case 'agents':
        return this.fetchAgents(integration, params);
      case 'groups':
        return this.fetchGroups(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'satisfaction':
        return this.fetchSatisfactionRatings(integration, params);
      default:
        throw new Error(`Unsupported Freshdesk data type: ${dataType}`);
    }
  }

  private async fetchTickets(
    integration: FreshdeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;
      const status = params?.status as number;
      const priority = params?.priority as number;
      const orderBy = (params?.orderBy as string) || 'created_at';
      const orderType = (params?.orderType as string) || 'desc';

      const queryParams: Record<string, unknown> = {
        per_page: perPage,
        order_by: orderBy,
        order_type: orderType,
        ...(status && { status }),
        ...(priority && { priority }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/tickets`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk tickets', error);
      throw error;
    }
  }

  private async fetchContacts(
    integration: FreshdeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/contacts`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk contacts', error);
      throw error;
    }
  }

  private async fetchCompanies(
    integration: FreshdeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/companies`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk companies', error);
      throw error;
    }
  }

  private async fetchAgents(
    integration: FreshdeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/agents`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk agents', error);
      throw error;
    }
  }

  private async fetchGroups(
    integration: FreshdeskIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/groups`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk groups', error);
      throw error;
    }
  }

  private async fetchSatisfactionRatings(
    integration: FreshdeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const createdSince = params?.createdSince as string;

      const queryParams: Record<string, unknown> = {};
      if (createdSince) {
        queryParams.created_since = createdSince;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/surveys/satisfaction_ratings`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk satisfaction ratings', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: FreshdeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;

      // Fetch all tickets
      const tickets = (await this.fetchTickets(integration, {
        limit: 100,
      })) as any[];

      // Freshdesk status mapping
      const statusMap: Record<number, string> = {
        2: 'open',
        3: 'pending',
        4: 'resolved',
        5: 'closed',
      };

      // Freshdesk priority mapping
      const priorityMap: Record<number, string> = {
        1: 'low',
        2: 'medium',
        3: 'high',
        4: 'urgent',
      };

      // Calculate metrics
      const statusBreakdown: Record<string, number> = {};
      const priorityBreakdown: Record<string, number> = {};
      let totalResponseTime = 0;
      let responseCount = 0;

      tickets.forEach((ticket: any) => {
        const status = statusMap[ticket.status] || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

        const priority = priorityMap[ticket.priority] || 'normal';
        priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

        if (ticket.fr_escalated === false && ticket.created_at && ticket.updated_at) {
          const created = new Date(ticket.created_at).getTime();
          const updated = new Date(ticket.updated_at).getTime();
          totalResponseTime += (updated - created) / 1000 / 60;
          responseCount++;
        }
      });

      const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      return {
        summary: {
          totalTickets: tickets.length,
          openTickets: statusBreakdown['open'] || 0,
          pendingTickets: statusBreakdown['pending'] || 0,
          resolvedTickets: statusBreakdown['resolved'] || 0,
          closedTickets: statusBreakdown['closed'] || 0,
          averageResponseTimeMinutes: Math.round(avgResponseTime),
          period: `${days} days`,
        },
        statusBreakdown,
        priorityBreakdown,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Freshdesk analytics', error);
      throw error;
    }
  }

  // Search functionality
  async searchTickets(integration: FreshdeskIntegration, query: string): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/search/tickets`, {
          headers: this.getHeaders(integration),
          params: { query: `"${query}"` },
        }),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to search Freshdesk tickets', error);
      throw error;
    }
  }
}
