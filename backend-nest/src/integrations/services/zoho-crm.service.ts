import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ZohoCRMIntegration {
  accessToken: string;
  refreshToken?: string;
  settings: {
    dataCenterUrl?: string; // e.g., 'https://www.zohoapis.com' or 'https://www.zohoapis.eu'
  };
}

@Injectable()
export class ZohoCRMService {
  private readonly logger = new Logger(ZohoCRMService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: ZohoCRMIntegration): string {
    return integration.settings.dataCenterUrl || 'https://www.zohoapis.com';
  }

  private getHeaders(integration: ZohoCRMIntegration): Record<string, string> {
    return {
      Authorization: `Zoho-oauthtoken ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: ZohoCRMIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/crm/v5/org`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Zoho CRM connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: ZohoCRMIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'leads':
        return this.fetchLeads(integration, params);
      case 'contacts':
        return this.fetchContacts(integration, params);
      case 'accounts':
        return this.fetchAccounts(integration, params);
      case 'deals':
        return this.fetchDeals(integration, params);
      case 'tasks':
        return this.fetchTasks(integration, params);
      case 'calls':
        return this.fetchCalls(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'modules':
        return this.fetchModules(integration, params);
      default:
        throw new Error(`Unsupported Zoho CRM data type: ${dataType}`);
    }
  }

  private async fetchRecords(
    integration: ZohoCRMIntegration,
    module: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const perPage = (params?.limit as number) || 50;
      const page = (params?.page as number) || 1;
      const fields = params?.fields as string;
      const sortBy = params?.sortBy as string;
      const sortOrder = params?.sortOrder as string;

      const queryParams: Record<string, unknown> = {
        per_page: perPage,
        page,
        ...(fields && { fields }),
        ...(sortBy && { sort_by: sortBy }),
        ...(sortOrder && { sort_order: sortOrder }),
      };

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/crm/v5/${module}`,
          {
            headers: this.getHeaders(integration),
            params: queryParams,
          },
        ),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error(`Failed to fetch Zoho CRM ${module}`, error);
      throw error;
    }
  }

  private async fetchLeads(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.fetchRecords(integration, 'Leads', params);
  }

  private async fetchContacts(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.fetchRecords(integration, 'Contacts', params);
  }

  private async fetchAccounts(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.fetchRecords(integration, 'Accounts', params);
  }

  private async fetchDeals(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.fetchRecords(integration, 'Deals', params);
  }

  private async fetchTasks(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.fetchRecords(integration, 'Tasks', params);
  }

  private async fetchCalls(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.fetchRecords(integration, 'Calls', params);
  }

  private async fetchModules(
    integration: ZohoCRMIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/crm/v5/settings/modules`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.modules || [];
    } catch (error) {
      this.logger.error('Failed to fetch Zoho CRM modules', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: ZohoCRMIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;

      // Fetch counts for different modules
      const [leads, contacts, accounts, deals] = await Promise.all([
        this.fetchRecords(integration, 'Leads', { limit: 200 }),
        this.fetchRecords(integration, 'Contacts', { limit: 200 }),
        this.fetchRecords(integration, 'Accounts', { limit: 200 }),
        this.fetchRecords(integration, 'Deals', { limit: 200 }),
      ]);

      const leadsArray = leads as any[];
      const contactsArray = contacts as any[];
      const accountsArray = accounts as any[];
      const dealsArray = deals as any[];

      // Calculate deal metrics
      const totalDealValue = dealsArray.reduce(
        (sum, deal) => sum + (parseFloat(deal.Amount) || 0),
        0,
      );

      const wonDeals = dealsArray.filter(
        (deal) => deal.Stage === 'Closed Won' || deal.Stage === 'Closed-Won',
      );
      const wonDealValue = wonDeals.reduce(
        (sum, deal) => sum + (parseFloat(deal.Amount) || 0),
        0,
      );

      // Stage breakdown
      const stageBreakdown: Record<string, { count: number; value: number }> =
        {};
      dealsArray.forEach((deal) => {
        const stage = deal.Stage || 'Unknown';
        if (!stageBreakdown[stage]) {
          stageBreakdown[stage] = { count: 0, value: 0 };
        }
        stageBreakdown[stage].count++;
        stageBreakdown[stage].value += parseFloat(deal.Amount) || 0;
      });

      return {
        summary: {
          totalLeads: leadsArray.length,
          totalContacts: contactsArray.length,
          totalAccounts: accountsArray.length,
          totalDeals: dealsArray.length,
          totalDealValue,
          wonDeals: wonDeals.length,
          wonDealValue,
          period: `${days} days`,
        },
        stageBreakdown,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Zoho CRM analytics', error);
      throw error;
    }
  }

  // Search functionality
  async search(
    integration: ZohoCRMIntegration,
    module: string,
    criteria: string,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getBaseUrl(integration)}/crm/v5/${module}/search`,
          {
            headers: this.getHeaders(integration),
            params: { criteria },
          },
        ),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to search Zoho CRM', error);
      throw error;
    }
  }

  // COQL (CRM Object Query Language) support
  async executeCoql(
    integration: ZohoCRMIntegration,
    query: string,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getBaseUrl(integration)}/crm/v5/coql`,
          { select_query: query },
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to execute Zoho COQL', error);
      throw error;
    }
  }
}
