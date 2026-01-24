import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ZendeskIntegration {
  accessToken: string;
  settings: {
    subdomain: string;
  };
}

@Injectable()
export class ZendeskService {
  private readonly logger = new Logger(ZendeskService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: ZendeskIntegration): string {
    return `https://${integration.settings.subdomain}.zendesk.com/api/v2`;
  }

  private getHeaders(integration: ZendeskIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: ZendeskIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/users/me`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Zendesk connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: ZendeskIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'tickets':
        return this.fetchTickets(integration, params);
      case 'users':
        return this.fetchUsers(integration, params);
      case 'organizations':
        return this.fetchOrganizations(integration, params);
      case 'agents':
        return this.fetchAgents(integration, params);
      case 'groups':
        return this.fetchGroups(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'satisfaction':
        return this.fetchSatisfactionRatings(integration, params);
      default:
        throw new Error(`Unsupported Zendesk data type: ${dataType}`);
    }
  }

  private async fetchTickets(
    integration: ZendeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;
      const status = params?.status as string;
      const sortBy = (params?.sortBy as string) || 'created_at';
      const sortOrder = (params?.sortOrder as string) || 'desc';

      let endpoint = `${this.getBaseUrl(integration)}/tickets`;
      if (status) {
        endpoint = `${this.getBaseUrl(integration)}/search?query=type:ticket status:${status}`;
      }

      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          headers: this.getHeaders(integration),
          params: {
            per_page: perPage,
            sort_by: sortBy,
            sort_order: sortOrder,
          },
        }),
      );

      return response.data.tickets || response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk tickets', error);
      throw error;
    }
  }

  private async fetchUsers(
    integration: ZendeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/users`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data.users || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk users', error);
      throw error;
    }
  }

  private async fetchAgents(
    integration: ZendeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/users`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage, role: 'agent' },
        }),
      );

      return response.data.users || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk agents', error);
      throw error;
    }
  }

  private async fetchOrganizations(
    integration: ZendeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/organizations`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data.organizations || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk organizations', error);
      throw error;
    }
  }

  private async fetchGroups(
    integration: ZendeskIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/groups`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data.groups || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk groups', error);
      throw error;
    }
  }

  private async fetchSatisfactionRatings(
    integration: ZendeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/satisfaction_ratings`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data.satisfaction_ratings || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk satisfaction ratings', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: ZendeskIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;

      // Fetch ticket counts by status
      const ticketCounts = await this.fetchTicketCounts(integration);

      // Fetch recent tickets for analysis
      const recentTickets = (await this.fetchTickets(integration, {
        limit: 100,
      })) as any[];

      // Calculate metrics
      const statusBreakdown: Record<string, number> = {};
      const priorityBreakdown: Record<string, number> = {};
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      recentTickets.forEach((ticket: any) => {
        // Status breakdown
        const status = ticket.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

        // Priority breakdown
        const priority = ticket.priority || 'normal';
        priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

        // Response time calculation
        if (ticket.created_at && ticket.updated_at) {
          const created = new Date(ticket.created_at).getTime();
          const updated = new Date(ticket.updated_at).getTime();
          totalResponseTime += (updated - created) / 1000 / 60; // minutes
          responseTimeCount++;
        }
      });

      const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

      return {
        summary: {
          totalTickets: ticketCounts.count || recentTickets.length,
          openTickets: statusBreakdown['open'] || 0,
          pendingTickets: statusBreakdown['pending'] || 0,
          solvedTickets: statusBreakdown['solved'] || 0,
          averageResponseTimeMinutes: Math.round(avgResponseTime),
          period: `${days} days`,
        },
        statusBreakdown,
        priorityBreakdown,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk analytics', error);
      throw error;
    }
  }

  private async fetchTicketCounts(integration: ZendeskIntegration): Promise<{ count: number }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/tickets/count`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data.count || { count: 0 };
    } catch (error) {
      this.logger.error('Failed to fetch Zendesk ticket counts', error);
      return { count: 0 };
    }
  }

  // Search functionality
  async search(
    integration: ZendeskIntegration,
    query: string,
    type: 'ticket' | 'user' | 'organization' = 'ticket',
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/search`, {
          headers: this.getHeaders(integration),
          params: { query: `type:${type} ${query}` },
        }),
      );

      return response.data.results || [];
    } catch (error) {
      this.logger.error('Failed to search Zendesk', error);
      throw error;
    }
  }
}
