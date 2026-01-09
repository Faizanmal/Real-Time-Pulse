import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface HelpScoutIntegration {
  accessToken: string;
  settings: {
    mailboxId?: string;
  };
}

@Injectable()
export class HelpScoutService {
  private readonly logger = new Logger(HelpScoutService.name);
  private readonly baseUrl = 'https://api.helpscout.net/v2';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(
    integration: HelpScoutIntegration,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: HelpScoutIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Help Scout connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: HelpScoutIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'conversations':
        return this.fetchConversations(integration, params);
      case 'customers':
        return this.fetchCustomers(integration, params);
      case 'mailboxes':
        return this.fetchMailboxes(integration, params);
      case 'users':
        return this.fetchUsers(integration, params);
      case 'teams':
        return this.fetchTeams(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'reports':
        return this.fetchReports(integration, params);
      default:
        throw new Error(`Unsupported Help Scout data type: ${dataType}`);
    }
  }

  private async fetchConversations(
    integration: HelpScoutIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;
      const status = params?.status as string;
      const mailboxId =
        (params?.mailboxId as string) || integration.settings.mailboxId;

      const queryParams: Record<string, unknown> = {
        pageSize,
        ...(status && { status }),
        ...(mailboxId && { mailbox: mailboxId }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/conversations`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data._embedded?.conversations || [];
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout conversations', error);
      throw error;
    }
  }

  private async fetchCustomers(
    integration: HelpScoutIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/customers`, {
          headers: this.getHeaders(integration),
          params: { pageSize },
        }),
      );

      return response.data._embedded?.customers || [];
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout customers', error);
      throw error;
    }
  }

  private async fetchMailboxes(
    integration: HelpScoutIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/mailboxes`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data._embedded?.mailboxes || [];
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout mailboxes', error);
      throw error;
    }
  }

  private async fetchUsers(
    integration: HelpScoutIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users`, {
          headers: this.getHeaders(integration),
          params: { pageSize },
        }),
      );

      return response.data._embedded?.users || [];
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout users', error);
      throw error;
    }
  }

  private async fetchTeams(
    integration: HelpScoutIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/teams`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data._embedded?.teams || [];
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout teams', error);
      throw error;
    }
  }

  private async fetchReports(
    integration: HelpScoutIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const reportType = (params?.type as string) || 'conversations';
      const start = params?.start as string;
      const end = params?.end as string;
      const mailboxId =
        (params?.mailboxId as string) || integration.settings.mailboxId;

      // Default to last 30 days if no dates provided
      const endDate = end || new Date().toISOString().split('T')[0];
      const startDate =
        start ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

      const queryParams: Record<string, unknown> = {
        start: startDate,
        end: endDate,
        ...(mailboxId && { mailbox: mailboxId }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/reports/${reportType}`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout reports', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: HelpScoutIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;
      const mailboxId =
        (params?.mailboxId as string) || integration.settings.mailboxId;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const reportParams = {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        ...(mailboxId && { mailbox: mailboxId }),
      };

      // Fetch various reports in parallel
      const [conversationsReport, happinessReport] = await Promise.all([
        this.fetchReportsInternal(integration, 'conversations', reportParams),
        this.fetchReportsInternal(integration, 'happiness', reportParams),
      ]);

      const convData = conversationsReport as any;
      const happyData = happinessReport as any;

      return {
        summary: {
          totalConversations: convData.current?.count || 0,
          resolvedConversations: convData.current?.resolved || 0,
          repliesSent: convData.current?.repliesSent || 0,
          firstResponseTime: convData.current?.firstResponseTime || 0,
          resolutionTime: convData.current?.resolutionTime || 0,
          happinessScore: happyData.current?.rating || 0,
          period: `${days} days`,
        },
        trends: {
          conversations: convData.previous
            ? {
                change:
                  ((convData.current?.count - convData.previous?.count) /
                    (convData.previous?.count || 1)) *
                  100,
                direction:
                  convData.current?.count > convData.previous?.count
                    ? 'up'
                    : 'down',
              }
            : null,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch Help Scout analytics', error);
      throw error;
    }
  }

  private async fetchReportsInternal(
    integration: HelpScoutIntegration,
    reportType: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/reports/${reportType}`, {
          headers: this.getHeaders(integration),
          params,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch Help Scout ${reportType} report`,
        error,
      );
      return {};
    }
  }

  // Search conversations
  async searchConversations(
    integration: HelpScoutIntegration,
    query: string,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/conversations`, {
          headers: this.getHeaders(integration),
          params: { query },
        }),
      );

      return response.data._embedded?.conversations || [];
    } catch (error) {
      this.logger.error('Failed to search Help Scout conversations', error);
      throw error;
    }
  }
}
