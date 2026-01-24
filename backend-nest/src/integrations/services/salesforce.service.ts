import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SalesforceIntegration {
  accessToken: string;
  refreshToken?: string;
  settings: {
    instanceUrl: string;
    apiVersion?: string;
  };
}

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);

  constructor(private readonly httpService: HttpService) {}

  private getApiUrl(integration: SalesforceIntegration): string {
    const version = integration.settings.apiVersion || 'v59.0';
    return `${integration.settings.instanceUrl}/services/data/${version}`;
  }

  private getHeaders(integration: SalesforceIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: SalesforceIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getApiUrl(integration)}/sobjects`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Salesforce connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: SalesforceIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'accounts':
        return this.fetchAccounts(integration, params);
      case 'contacts':
        return this.fetchContacts(integration, params);
      case 'leads':
        return this.fetchLeads(integration, params);
      case 'opportunities':
        return this.fetchOpportunities(integration, params);
      case 'cases':
        return this.fetchCases(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'reports':
        return this.fetchReports(integration, params);
      case 'dashboards':
        return this.fetchDashboards(integration, params);
      case 'query':
        return this.executeQuery(integration, params);
      default:
        throw new Error(`Unsupported Salesforce data type: ${dataType}`);
    }
  }

  private async fetchAccounts(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const query = `
        SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, 
               BillingCity, BillingState, BillingCountry, Website, CreatedDate, LastModifiedDate
        FROM Account
        ORDER BY LastModifiedDate DESC
        LIMIT ${limit}
      `;

      return this.executeSOQL(integration, query);
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce accounts', error);
      throw error;
    }
  }

  private async fetchContacts(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const accountId = params?.accountId as string;
      const accountFilter = accountId ? `WHERE AccountId = '${accountId}'` : '';

      const query = `
        SELECT Id, FirstName, LastName, Email, Phone, Title, Department,
               Account.Name, MailingCity, MailingState, CreatedDate, LastModifiedDate
        FROM Contact
        ${accountFilter}
        ORDER BY LastModifiedDate DESC
        LIMIT ${limit}
      `;

      return this.executeSOQL(integration, query);
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce contacts', error);
      throw error;
    }
  }

  private async fetchLeads(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = params?.status as string;
      const statusFilter = status ? `WHERE Status = '${status}'` : '';

      const query = `
        SELECT Id, FirstName, LastName, Email, Company, Title, Status, LeadSource,
               Industry, AnnualRevenue, NumberOfEmployees, Rating, CreatedDate, LastModifiedDate
        FROM Lead
        ${statusFilter}
        ORDER BY LastModifiedDate DESC
        LIMIT ${limit}
      `;

      return this.executeSOQL(integration, query);
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce leads', error);
      throw error;
    }
  }

  private async fetchOpportunities(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const stage = params?.stage as string;
      const stageFilter = stage ? `WHERE StageName = '${stage}'` : '';

      const query = `
        SELECT Id, Name, StageName, Amount, Probability, CloseDate, Type,
               Account.Name, LeadSource, IsClosed, IsWon, ExpectedRevenue, CreatedDate
        FROM Opportunity
        ${stageFilter}
        ORDER BY CloseDate DESC
        LIMIT ${limit}
      `;

      return this.executeSOQL(integration, query);
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce opportunities', error);
      throw error;
    }
  }

  private async fetchCases(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = params?.status as string;
      const statusFilter = status ? `WHERE Status = '${status}'` : '';

      const query = `
        SELECT Id, CaseNumber, Subject, Status, Priority, Origin, Type,
               Account.Name, Contact.Name, CreatedDate, ClosedDate, IsClosed
        FROM Case
        ${statusFilter}
        ORDER BY CreatedDate DESC
        LIMIT ${limit}
      `;

      return this.executeSOQL(integration, query);
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce cases', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const dateFilter = `CreatedDate >= ${startDate.toISOString().split('T')[0]}`;

      // Fetch multiple metrics in parallel
      const [leads, opportunities, cases, closedWonOpps] = await Promise.all([
        this.executeSOQL(integration, `SELECT COUNT() totalCount FROM Lead WHERE ${dateFilter}`),
        this.executeSOQL(
          integration,
          `SELECT COUNT() totalCount, SUM(Amount) totalAmount FROM Opportunity WHERE ${dateFilter}`,
        ),
        this.executeSOQL(integration, `SELECT COUNT() totalCount FROM Case WHERE ${dateFilter}`),
        this.executeSOQL(
          integration,
          `SELECT COUNT() totalCount, SUM(Amount) totalAmount FROM Opportunity WHERE IsWon = true AND CloseDate >= ${startDate.toISOString().split('T')[0]}`,
        ),
      ]);

      const leadsData = (leads as any)?.records?.[0] || {};
      const oppsData = (opportunities as any)?.records?.[0] || {};
      const casesData = (cases as any)?.records?.[0] || {};
      const wonData = (closedWonOpps as any)?.records?.[0] || {};

      return {
        summary: {
          newLeads: leadsData.totalCount || 0,
          newOpportunities: oppsData.totalCount || 0,
          pipelineValue: oppsData.totalAmount || 0,
          newCases: casesData.totalCount || 0,
          closedWonDeals: wonData.totalCount || 0,
          closedWonValue: wonData.totalAmount || 0,
          period: `${days} days`,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce analytics', error);
      throw error;
    }
  }

  private async fetchReports(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const reportId = params?.reportId as string;

      if (reportId) {
        // Fetch specific report
        const response = await firstValueFrom(
          this.httpService.get(`${this.getApiUrl(integration)}/analytics/reports/${reportId}`, {
            headers: this.getHeaders(integration),
          }),
        );
        return response.data;
      } else {
        // List all reports
        const query = 'SELECT Id, Name, Description, FolderName, Format FROM Report LIMIT 50';
        return this.executeSOQL(integration, query);
      }
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce reports', error);
      throw error;
    }
  }

  private async fetchDashboards(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const dashboardId = params?.dashboardId as string;

      if (dashboardId) {
        const response = await firstValueFrom(
          this.httpService.get(
            `${this.getApiUrl(integration)}/analytics/dashboards/${dashboardId}`,
            { headers: this.getHeaders(integration) },
          ),
        );
        return response.data;
      } else {
        const query = 'SELECT Id, Title, Description, FolderName FROM Dashboard LIMIT 50';
        return this.executeSOQL(integration, query);
      }
    } catch (error) {
      this.logger.error('Failed to fetch Salesforce dashboards', error);
      throw error;
    }
  }

  private async executeQuery(
    integration: SalesforceIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const query = params?.query as string;
    if (!query) {
      throw new Error('Query parameter is required');
    }
    return this.executeSOQL(integration, query);
  }

  private async executeSOQL(integration: SalesforceIntegration, query: string): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getApiUrl(integration)}/query`, {
          headers: this.getHeaders(integration),
          params: { q: query },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to execute Salesforce SOQL', error);
      throw error;
    }
  }

  // Bulk API for large data operations
  async createBulkJob(
    integration: SalesforceIntegration,
    objectName: string,
    operation: 'insert' | 'update' | 'upsert' | 'delete' | 'query',
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.getApiUrl(integration)}/jobs/ingest`,
          {
            object: objectName,
            operation,
            contentType: 'CSV',
          },
          { headers: this.getHeaders(integration) },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Salesforce bulk job', error);
      throw error;
    }
  }
}
