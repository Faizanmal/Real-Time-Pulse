/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);
  private readonly baseUrl = 'https://api.atlassian.com/ex/jira';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const cloudId = integration.settings?.cloudId;
      if (!cloudId) {
        this.logger.error('Jira cloud ID not configured');
        return false;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${cloudId}/rest/api/3/myself`, {
          headers: {
            Authorization: `Bearer ${integration.accessToken as string}`,
            Accept: 'application/json',
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Jira connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: Integration,
    dataType: string,
    params?: unknown,
  ): Promise<unknown> {
    const cloudId = integration.settings?.cloudId;
    if (!cloudId) {
      throw new Error('Jira cloud ID not configured');
    }

    const headers = {
      Authorization: `Bearer ${integration.accessToken as string}`,
      Accept: 'application/json',
    };

    switch (dataType) {
      case 'projects':
        return this.fetchProjects(cloudId, headers);

      case 'issues':
        return this.fetchIssues(cloudId, headers, params);

      case 'sprints':
        return this.fetchSprints(cloudId, headers, params);

      case 'boards':
        return this.fetchBoards(cloudId, headers);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchProjects(cloudId: string, headers: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${cloudId}/rest/api/3/project/search`,
          { headers },
        ),
      );
      return response.data.values;
    } catch (error) {
      this.logger.error('Failed to fetch Jira projects', error);
      throw error;
    }
  }

  private async fetchIssues(
    cloudId: string,
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const projectKey = (params as { projectKey?: string })?.projectKey;
      const jql = projectKey
        ? `project = ${projectKey} ORDER BY updated DESC`
        : 'ORDER BY updated DESC';

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${cloudId}/rest/api/3/search`, {
          headers,
          params: {
            jql,
            maxResults: 50,
            fields: 'summary,status,assignee,priority,created,updated',
          },
        }),
      );
      return response.data.issues;
    } catch (error) {
      this.logger.error('Failed to fetch Jira issues', error);
      throw error;
    }
  }

  private async fetchSprints(
    cloudId: string,
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const boardId = (params as { boardId?: string })?.boardId;
      if (!boardId) {
        throw new Error('Board ID required for sprints');
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0/board/${boardId}/sprint`,
          { headers },
        ),
      );
      return response.data.values;
    } catch (error) {
      this.logger.error('Failed to fetch Jira sprints', error);
      throw error;
    }
  }

  private async fetchBoards(cloudId: string, headers: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0/board`,
          { headers },
        ),
      );
      return response.data.values;
    } catch (error) {
      this.logger.error('Failed to fetch Jira boards', error);
      throw error;
    }
  }
}
