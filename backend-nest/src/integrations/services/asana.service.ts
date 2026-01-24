import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class AsanaService {
  private readonly logger = new Logger(AsanaService.name);
  private readonly baseUrl = 'https://app.asana.com/api/1.0';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, {
          headers: {
            Authorization: `Bearer ${integration.accessToken as string}`,
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Asana connection test failed', error);
      return false;
    }
  }

  async fetchData(integration: Integration, dataType: string, params?: unknown): Promise<unknown> {
    const headers = {
      Authorization: `Bearer ${integration.accessToken as string}`,
    };

    switch (dataType) {
      case 'projects':
        return this.fetchProjects(headers, params);

      case 'tasks':
        return this.fetchTasks(headers, params);

      case 'teams':
        return this.fetchTeams(headers);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchProjects(headers: any, params?: unknown): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/projects`, {
          headers,
          params: {
            workspace: (params as { workspaceGid?: string }).workspaceGid,
            archived: false,
          },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Asana projects', error);
      throw error;
    }
  }

  private async fetchTasks(headers: any, params?: unknown): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/tasks`, {
          headers,
          params: {
            project: (params as { projectGid?: string }).projectGid,

            completed_since: (params as { completedSince?: string }).completedSince || 'now',
          },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Asana tasks', error);
      throw error;
    }
  }

  private async fetchTeams(headers: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/teams`, { headers }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Asana teams', error);
      throw error;
    }
  }
}
