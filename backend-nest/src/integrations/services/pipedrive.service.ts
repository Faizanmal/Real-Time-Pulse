import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface PipedriveIntegration {
  accessToken: string;
  settings: {
    companyDomain?: string;
  };
}

@Injectable()
export class PipedriveService {
  private readonly logger = new Logger(PipedriveService.name);
  private readonly baseUrl = 'https://api.pipedrive.com/v1';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(
    integration: PipedriveIntegration,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: PipedriveIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.data.success === true;
    } catch (error) {
      this.logger.error('Pipedrive connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: PipedriveIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'deals':
        return this.fetchDeals(integration, params);
      case 'persons':
        return this.fetchPersons(integration, params);
      case 'organizations':
        return this.fetchOrganizations(integration, params);
      case 'activities':
        return this.fetchActivities(integration, params);
      case 'pipelines':
        return this.fetchPipelines(integration, params);
      case 'stages':
        return this.fetchStages(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'products':
        return this.fetchProducts(integration, params);
      default:
        throw new Error(`Unsupported Pipedrive data type: ${dataType}`);
    }
  }

  private async fetchDeals(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = params?.status as string;
      const stageId = params?.stageId as number;

      const queryParams: Record<string, unknown> = {
        limit,
        ...(status && { status }),
        ...(stageId && { stage_id: stageId }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/deals`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive deals', error);
      throw error;
    }
  }

  private async fetchPersons(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/persons`, {
          headers: this.getHeaders(integration),
          params: { limit },
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive persons', error);
      throw error;
    }
  }

  private async fetchOrganizations(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/organizations`, {
          headers: this.getHeaders(integration),
          params: { limit },
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive organizations', error);
      throw error;
    }
  }

  private async fetchActivities(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const done = params?.done as number;
      const type = params?.type as string;

      const queryParams: Record<string, unknown> = {
        limit,
        ...(typeof done !== 'undefined' && { done }),
        ...(type && { type }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/activities`, {
          headers: this.getHeaders(integration),
          params: queryParams,
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive activities', error);
      throw error;
    }
  }

  private async fetchPipelines(
    integration: PipedriveIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/pipelines`, {
          headers: this.getHeaders(integration),
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive pipelines', error);
      throw error;
    }
  }

  private async fetchStages(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pipelineId = params?.pipelineId as number;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/stages`, {
          headers: this.getHeaders(integration),
          params: pipelineId ? { pipeline_id: pipelineId } : {},
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive stages', error);
      throw error;
    }
  }

  private async fetchProducts(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/products`, {
          headers: this.getHeaders(integration),
          params: { limit },
        }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive products', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: PipedriveIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;

      // Fetch deals summary
      const dealsResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/deals/summary`, {
          headers: this.getHeaders(integration),
        }),
      );

      // Fetch pipeline statistics
      const pipelinesResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/pipelines`, {
          headers: this.getHeaders(integration),
        }),
      );

      // Fetch activities
      const activitiesResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/activities`, {
          headers: this.getHeaders(integration),
          params: { limit: 100 },
        }),
      );

      const dealsSummary = dealsResponse.data.data || {};
      const pipelines = pipelinesResponse.data.data || [];
      const activities = activitiesResponse.data.data || [];

      // Calculate activity metrics
      const completedActivities = activities.filter((a: any) => a.done).length;
      const pendingActivities = activities.filter((a: any) => !a.done).length;

      return {
        summary: {
          totalDeals: dealsSummary.total_count || 0,
          openDealsValue: dealsSummary.open_deals_count || 0,
          wonDealsValue: dealsSummary.won_deals_count || 0,
          lostDealsValue: dealsSummary.lost_deals_count || 0,
          totalPipelines: pipelines.length,
          completedActivities,
          pendingActivities,
          period: `${days} days`,
        },
        pipelines: pipelines.map((p: any) => ({
          id: p.id,
          name: p.name,
          dealsCount: p.deals_count || 0,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Pipedrive analytics', error);
      throw error;
    }
  }
}
