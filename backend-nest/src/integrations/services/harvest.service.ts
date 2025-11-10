/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class HarvestService {
  private readonly logger = new Logger(HarvestService.name);
  private readonly baseUrl = 'https://api.harvestapp.com/v2';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, {
          headers: {
            Authorization: `Bearer ${integration.accessToken as string}`,

            'Harvest-Account-ID': integration.settings?.accountId as string,
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Harvest connection test failed', error);
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

      'Harvest-Account-ID': integration.settings?.accountId as string,
    };

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
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/time_entries`, {
          headers,
          params: {
            from:
              (params as { from?: string }).from ||
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],

            to:
              (params as { to?: string }).to ||
              new Date().toISOString().split('T')[0],

            project_id: (params as { projectId?: string }).projectId,
          },
        }),
      );

      return response.data.time_entries;
    } catch (error) {
      this.logger.error('Failed to fetch Harvest time entries', error);
      throw error;
    }
  }

  private async fetchProjects(headers: any): Promise<unknown> {
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

  private async fetchClients(headers: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/clients`, {
          headers,
          params: { is_active: true },
        }),
      );

      return response.data.clients;
    } catch (error) {
      this.logger.error('Failed to fetch Harvest clients', error);
      throw error;
    }
  }

  private async fetchReports(headers: any, params?: unknown): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/reports/time/projects`, {
          headers,
          params: {
            from:
              (params as { from?: string }).from ||
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],

            to:
              (params as { to?: string }).to ||
              new Date().toISOString().split('T')[0],
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
