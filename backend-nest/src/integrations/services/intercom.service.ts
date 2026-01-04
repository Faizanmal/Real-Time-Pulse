import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface IntercomIntegration {
  accessToken: string;
  settings: {
    apiVersion?: string;
  };
}

@Injectable()
export class IntercomService {
  private readonly logger = new Logger(IntercomService.name);
  private readonly baseUrl = 'https://api.intercom.io';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: IntercomIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Intercom-Version': integration.settings.apiVersion || '2.10',
    };
  }

  async testConnection(integration: IntercomIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/me`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Intercom connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: IntercomIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'conversations':
        return this.fetchConversations(integration, params);
      case 'contacts':
        return this.fetchContacts(integration, params);
      case 'companies':
        return this.fetchCompanies(integration, params);
      case 'admins':
        return this.fetchAdmins(integration, params);
      case 'teams':
        return this.fetchTeams(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'articles':
        return this.fetchArticles(integration, params);
      default:
        throw new Error(`Unsupported Intercom data type: ${dataType}`);
    }
  }

  private async fetchConversations(
    integration: IntercomIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;
      const state = params?.state as string;

      const queryParams: Record<string, unknown> = {
        per_page: perPage,
        ...(state && { state }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/conversations`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.conversations || [];
    } catch (error) {
      this.logger.error('Failed to fetch Intercom conversations', error);
      throw error;
    }
  }

  private async fetchContacts(
    integration: IntercomIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/contacts`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Intercom contacts', error);
      throw error;
    }
  }

  private async fetchCompanies(
    integration: IntercomIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/companies`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Intercom companies', error);
      throw error;
    }
  }

  private async fetchAdmins(
    integration: IntercomIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/admins`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data.admins || [];
    } catch (error) {
      this.logger.error('Failed to fetch Intercom admins', error);
      throw error;
    }
  }

  private async fetchTeams(
    integration: IntercomIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/teams`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data.teams || [];
    } catch (error) {
      this.logger.error('Failed to fetch Intercom teams', error);
      throw error;
    }
  }

  private async fetchArticles(
    integration: IntercomIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/articles`, {
          headers: this.getHeaders(integration),
          params: { per_page: perPage },
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Intercom articles', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: IntercomIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;

      // Fetch conversations for analysis
      const conversations = (await this.fetchConversations(integration, {
        limit: 100,
      })) as any[];

      // Fetch contacts count
      const contacts = (await this.fetchContacts(integration, {
        limit: 1,
      })) as any[];

      // Calculate metrics
      const stateBreakdown: Record<string, number> = {};
      let totalResponseTime = 0;
      let responseCount = 0;

      conversations.forEach((conv: any) => {
        const state = conv.state || 'unknown';
        stateBreakdown[state] = (stateBreakdown[state] || 0) + 1;

        if (conv.statistics?.first_response_time_seconds) {
          totalResponseTime += conv.statistics.first_response_time_seconds;
          responseCount++;
        }
      });

      const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount / 60 : 0;

      return {
        summary: {
          totalConversations: conversations.length,
          openConversations: stateBreakdown['open'] || 0,
          closedConversations: stateBreakdown['closed'] || 0,
          snoozedConversations: stateBreakdown['snoozed'] || 0,
          averageFirstResponseMinutes: Math.round(avgResponseTime),
          totalContacts: contacts.length,
          period: `${days} days`,
        },
        stateBreakdown,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Intercom analytics', error);
      throw error;
    }
  }

  // Search functionality
  async searchContacts(
    integration: IntercomIntegration,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/contacts/search`,
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to search Intercom contacts', error);
      throw error;
    }
  }
}
