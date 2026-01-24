import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly baseUrl = 'https://api.github.com';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/user`, {
          headers: {
            Authorization: `Bearer ${integration.accessToken as string}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('GitHub connection test failed', error);
      return false;
    }
  }

  async fetchData(integration: Integration, dataType: string, params?: unknown): Promise<unknown> {
    const headers = {
      Authorization: `Bearer ${integration.accessToken as string}`,
      Accept: 'application/vnd.github.v3+json',
    };

    switch (dataType) {
      case 'repos':
        return this.fetchRepos(headers, params);

      case 'issues':
        return this.fetchIssues(headers, params);

      case 'pulls':
        return this.fetchPullRequests(headers, params);

      case 'commits':
        return this.fetchCommits(headers, params);

      case 'workflows':
        return this.fetchWorkflows(headers, params);

      case 'stats':
        return this.fetchRepoStats(headers, params);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchRepos(headers: any, params?: unknown): Promise<unknown> {
    try {
      const org = (params as { org?: string })?.org;
      const url = org ? `${this.baseUrl}/orgs/${org}/repos` : `${this.baseUrl}/user/repos`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          params: {
            sort: 'updated',
            per_page: 50,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch GitHub repos', error);
      throw error;
    }
  }

  private async fetchIssues(headers: any, params?: unknown): Promise<unknown> {
    try {
      const { owner, repo } = params as { owner: string; repo: string };
      if (!owner || !repo) {
        throw new Error('Owner and repo required');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/issues`, {
          headers,
          params: {
            state: 'all',
            sort: 'updated',
            per_page: 50,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch GitHub issues', error);
      throw error;
    }
  }

  private async fetchPullRequests(headers: any, params?: unknown): Promise<unknown> {
    try {
      const { owner, repo } = params as { owner: string; repo: string };
      if (!owner || !repo) {
        throw new Error('Owner and repo required');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/pulls`, {
          headers,
          params: {
            state: 'all',
            sort: 'updated',
            per_page: 50,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch GitHub pull requests', error);
      throw error;
    }
  }

  private async fetchCommits(headers: any, params?: unknown): Promise<unknown> {
    try {
      const { owner, repo, since } = params as {
        owner: string;
        repo: string;
        since?: string;
      };
      if (!owner || !repo) {
        throw new Error('Owner and repo required');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/commits`, {
          headers,
          params: {
            per_page: 50,
            ...(since && { since }),
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch GitHub commits', error);
      throw error;
    }
  }

  private async fetchWorkflows(headers: any, params?: unknown): Promise<unknown> {
    try {
      const { owner, repo } = params as { owner: string; repo: string };
      if (!owner || !repo) {
        throw new Error('Owner and repo required');
      }

      const [workflows, runs] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/actions/workflows`, {
            headers,
          }),
        ),
        firstValueFrom(
          this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/actions/runs`, {
            headers,
            params: { per_page: 20 },
          }),
        ),
      ]);

      return {
        workflows: workflows.data.workflows,
        recentRuns: runs.data.workflow_runs,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GitHub workflows', error);
      throw error;
    }
  }

  private async fetchRepoStats(headers: any, params?: unknown): Promise<unknown> {
    try {
      const { owner, repo } = params as { owner: string; repo: string };
      if (!owner || !repo) {
        throw new Error('Owner and repo required');
      }

      const [contributors, languages, participation] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/contributors`, {
            headers,
            params: { per_page: 10 },
          }),
        ).catch(() => ({ data: [] })),
        firstValueFrom(
          this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/languages`, { headers }),
        ).catch(() => ({ data: {} })),
        firstValueFrom(
          this.httpService.get(`${this.baseUrl}/repos/${owner}/${repo}/stats/participation`, {
            headers,
          }),
        ).catch(() => ({ data: null })),
      ]);

      return {
        topContributors: contributors.data,
        languages: languages.data,
        weeklyCommits: participation.data,
      };
    } catch (error) {
      this.logger.error('Failed to fetch GitHub stats', error);
      throw error;
    }
  }
}
