import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Integration interface for Harvest service
 */
interface HarvestIntegration {
  id: string;
  accessToken: string;
  refreshToken?: string;
  settings?: {
    accountId?: string;
    [key: string]: unknown;
  };
}

interface HarvestHeaders {
  Authorization: string;
  'Harvest-Account-ID': string;
  [key: string]: string;
}

interface TimeEntryParams {
  from?: string;
  to?: string;
  projectId?: string;
}

interface HarvestTimeEntry {
  id: number;
  hours: number;
  notes: string;
  created_at: string;
  updated_at: string;
  project: { id: number; name: string };
  user: { id: number; name: string };
}

interface HarvestProject {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  client: { id: number; name: string };
}

interface HarvestClient {
  id: number;
  name: string;
  is_active: boolean;
}

@Injectable()
export class HarvestService {
  private readonly logger = new Logger(HarvestService.name);
  private readonly baseUrl = 'https://api.harvestapp.com/v2';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: HarvestIntegration): Promise<boolean> {
    try {
      const headers = this.buildHeaders(integration);
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, { headers }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Harvest connection test failed', error);
      return false;
    }
  }

  private buildHeaders(integration: HarvestIntegration): HarvestHeaders {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Harvest-Account-ID': integration.settings?.accountId || '',
    };
  }

  async fetchData(
    integration: HarvestIntegration,
    dataType: string,
    params?: TimeEntryParams,
  ): Promise<
    HarvestTimeEntry[] | HarvestProject[] | HarvestClient[] | unknown
  > {
    const headers = this.buildHeaders(integration);

    switch (dataType) {
      case 'time_entries':
        return this.fetchTimeEntries(headers, params);

      case 'projects':
        return this.fetchProjects(headers);

      case 'clients':
        return this.fetchClients(headers);

      case 'reports':
        return this.fetchReports(headers, params);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchTimeEntries(
    headers: HarvestHeaders,
    params?: TimeEntryParams,
  ): Promise<HarvestTimeEntry[]> {
    try {
      const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const defaultTo = new Date().toISOString().split('T')[0];

      const response = await firstValueFrom(
        this.httpService.get<{ time_entries: HarvestTimeEntry[] }>(
          `${this.baseUrl}/time_entries`,
          {
            headers,
            params: {
              from: params?.from || defaultFrom,
              to: params?.to || defaultTo,
              project_id: params?.projectId,
            },
          },
        ),
      );

      return response.data.time_entries;
    } catch (error) {
      this.logger.error('Failed to fetch Harvest time entries', error);
      throw error;
    }
  }

  private async fetchProjects(
    headers: HarvestHeaders,
  ): Promise<HarvestProject[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/projects`, {
          headers,
          params: { is_active: true },
        }),
      );

      return response.data.projects;
    } catch (error) {
      this.logger.error('Failed to fetch Harvest projects', error);
      throw error;
    }
  }

  private async fetchClients(
    headers: HarvestHeaders,
  ): Promise<HarvestClient[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ clients: HarvestClient[] }>(
          `${this.baseUrl}/clients`,
          {
            headers,
            params: { is_active: true },
          },
        ),
      );

      return response.data.clients;
    } catch (error) {
      this.logger.error('Failed to fetch Harvest clients', error);
      throw error;
    }
  }

  private async fetchReports(
    headers: HarvestHeaders,
    params?: TimeEntryParams,
  ): Promise<unknown> {
    try {
      const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const defaultTo = new Date().toISOString().split('T')[0];

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/reports/time/projects`, {
          headers,
          params: {
            from: params?.from || defaultFrom,
            to: params?.to || defaultTo,
          },
        }),
      );

      return response.data.results;
    } catch (error) {
      this.logger.error('Failed to fetch Harvest reports', error);
      throw error;
    }
  }
}
