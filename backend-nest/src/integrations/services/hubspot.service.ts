import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private readonly baseUrl = 'https://api.hubapi.com';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/account-info/v3/details`, {
          headers: {
            Authorization: `Bearer ${integration.accessToken as string}`,
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('HubSpot connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: Integration,
    dataType: string,
    params?: unknown,
  ): Promise<unknown> {
    const headers = {
      Authorization: `Bearer ${integration.accessToken as string}`,
      'Content-Type': 'application/json',
    };

    switch (dataType) {
      case 'contacts':
        return this.fetchContacts(headers, params);

      case 'companies':
        return this.fetchCompanies(headers, params);

      case 'deals':
        return this.fetchDeals(headers, params);

      case 'pipeline':
        return this.fetchPipeline(headers, params);

      case 'analytics':
        return this.fetchAnalytics(headers, params);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchContacts(
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const limit = (params as { limit?: number })?.limit || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/crm/v3/objects/contacts`, {
          headers,
          params: {
            limit,
            properties:
              'firstname,lastname,email,phone,company,createdate,hs_lead_status',
          },
        }),
      );
      return response.data.results;
    } catch (error) {
      this.logger.error('Failed to fetch HubSpot contacts', error);
      throw error;
    }
  }

  private async fetchCompanies(
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const limit = (params as { limit?: number })?.limit || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/crm/v3/objects/companies`, {
          headers,
          params: {
            limit,
            properties:
              'name,domain,industry,numberofemployees,annualrevenue,createdate',
          },
        }),
      );
      return response.data.results;
    } catch (error) {
      this.logger.error('Failed to fetch HubSpot companies', error);
      throw error;
    }
  }

  private async fetchDeals(headers: any, params?: unknown): Promise<unknown> {
    try {
      const limit = (params as { limit?: number })?.limit || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/crm/v3/objects/deals`, {
          headers,
          params: {
            limit,
            properties:
              'dealname,amount,dealstage,pipeline,closedate,createdate,hubspot_owner_id',
          },
        }),
      );
      return response.data.results;
    } catch (error) {
      this.logger.error('Failed to fetch HubSpot deals', error);
      throw error;
    }
  }

  private async fetchPipeline(
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const pipelineId = (params as { pipelineId?: string })?.pipelineId;
      const url = pipelineId
        ? `${this.baseUrl}/crm/v3/pipelines/deals/${pipelineId}`
        : `${this.baseUrl}/crm/v3/pipelines/deals`;

      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      // If getting all pipelines, return the results array
      if (!pipelineId) {
        return response.data.results;
      }

      // Get deals for the pipeline
      const deals = await this.fetchDeals(headers, { limit: 100 });
      const stages = response.data.stages;

      // Group deals by stage
      const stageData = stages.map((stage: any) => ({
        ...stage,
        deals: (deals as any[]).filter(
          (deal: any) => deal.properties.dealstage === stage.id,
        ),
        totalValue: (deals as any[])
          .filter((deal: any) => deal.properties.dealstage === stage.id)
          .reduce(
            (sum: number, deal: any) =>
              sum + (parseFloat(deal.properties.amount) || 0),
            0,
          ),
      }));

      return {
        pipeline: response.data,
        stages: stageData,
      };
    } catch (error) {
      this.logger.error('Failed to fetch HubSpot pipeline', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    headers: any,
    _params?: unknown,
  ): Promise<unknown> {
    try {
      // Aggregate analytics from various sources
      const [contacts, companies, deals] = await Promise.all([
        this.fetchContacts(headers, { limit: 100 }),
        this.fetchCompanies(headers, { limit: 100 }),
        this.fetchDeals(headers, { limit: 100 }),
      ]);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const recentContacts = (contacts as any[]).filter(
        (c: any) => new Date(c.properties.createdate) > thirtyDaysAgo,
      ).length;

      const recentDeals = (deals as any[]).filter(
        (d: any) => new Date(d.properties.createdate) > thirtyDaysAgo,
      );

      const totalDealValue = (deals as any[]).reduce(
        (sum: number, d: any) => sum + (parseFloat(d.properties.amount) || 0),
        0,
      );

      const recentDealValue = recentDeals.reduce(
        (sum: number, d: any) => sum + (parseFloat(d.properties.amount) || 0),
        0,
      );

      return {
        overview: {
          totalContacts: (contacts as any[]).length,
          totalCompanies: (companies as any[]).length,
          totalDeals: (deals as any[]).length,
          totalDealValue,
        },
        last30Days: {
          newContacts: recentContacts,
          newDeals: recentDeals.length,
          dealValue: recentDealValue,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch HubSpot analytics', error);
      throw error;
    }
  }
}
