import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SentryIntegration {
  accessToken: string; // Auth token
  settings: {
    organization: string;
    project?: string;
  };
}

@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);
  private readonly baseUrl = 'https://sentry.io/api/0';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: SentryIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: SentryIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/organizations/${integration.settings.organization}/`,
          { headers: this.getHeaders(integration) },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Sentry connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: SentryIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'issues':
        return this.fetchIssues(integration, params);
      case 'events':
        return this.fetchEvents(integration, params);
      case 'projects':
        return this.fetchProjects(integration, params);
      case 'releases':
        return this.fetchReleases(integration, params);
      case 'stats':
        return this.fetchStats(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'performance':
        return this.fetchPerformance(integration, params);
      default:
        throw new Error(`Unsupported Sentry data type: ${dataType}`);
    }
  }

  private async fetchIssues(
    integration: SentryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const project = (params?.project as string) || integration.settings.project;
      const query = (params?.query as string) || 'is:unresolved';
      const limit = (params?.limit as number) || 50;
      const statsPeriod = (params?.statsPeriod as string) || '24h';

      let url = `${this.baseUrl}/organizations/${integration.settings.organization}/issues/`;
      if (project) {
        url = `${this.baseUrl}/projects/${integration.settings.organization}/${project}/issues/`;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(integration),
          params: {
            query,
            limit,
            statsPeriod,
          },
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Sentry issues', error);
      throw error;
    }
  }

  private async fetchEvents(
    integration: SentryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const project = (params?.project as string) || integration.settings.project;
      const issueId = params?.issueId as string;

      if (!project) {
        throw new Error('Project is required to fetch events');
      }

      let url: string;
      if (issueId) {
        url = `${this.baseUrl}/issues/${issueId}/events/`;
      } else {
        url = `${this.baseUrl}/projects/${integration.settings.organization}/${project}/events/`;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(integration),
          params: { limit: (params?.limit as number) || 50 },
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Sentry events', error);
      throw error;
    }
  }

  private async fetchProjects(
    integration: SentryIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/organizations/${integration.settings.organization}/projects/`,
          { headers: this.getHeaders(integration) },
        ),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Sentry projects', error);
      throw error;
    }
  }

  private async fetchReleases(
    integration: SentryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const project = params?.project as string;
      const limit = (params?.limit as number) || 20;

      const queryParams: Record<string, unknown> = { per_page: limit };
      if (project) {
        queryParams.project = project;
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/organizations/${integration.settings.organization}/releases/`,
          {
            headers: this.getHeaders(integration),
            params: queryParams,
          },
        ),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Sentry releases', error);
      throw error;
    }
  }

  private async fetchStats(
    integration: SentryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const project = (params?.project as string) || integration.settings.project;
      const stat = (params?.stat as string) || 'received';
      const resolution = (params?.resolution as string) || '1h';
      const since = (params?.since as number) || Math.floor((Date.now() - 86400000) / 1000);
      const until = (params?.until as number) || Math.floor(Date.now() / 1000);

      let url: string;
      if (project) {
        url = `${this.baseUrl}/projects/${integration.settings.organization}/${project}/stats/`;
      } else {
        url = `${this.baseUrl}/organizations/${integration.settings.organization}/stats/`;
      }

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(integration),
          params: { stat, resolution, since, until },
        }),
      );

      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch Sentry stats', error);
      throw error;
    }
  }

  private async fetchPerformance(
    integration: SentryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const project = params?.project as string;
      const statsPeriod = (params?.statsPeriod as string) || '24h';

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/organizations/${integration.settings.organization}/events-trends/`,
          {
            headers: this.getHeaders(integration),
            params: {
              statsPeriod,
              ...(project && { project }),
              field: ['p50()', 'p95()', 'p99()'],
            },
          },
        ),
      );

      return response.data || {};
    } catch (error) {
      this.logger.error('Failed to fetch Sentry performance data', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: SentryIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [issues, projects, releases, stats] = await Promise.all([
        this.fetchIssues(integration, { query: 'is:unresolved', limit: 100 }),
        this.fetchProjects(integration, params),
        this.fetchReleases(integration, { limit: 10 }),
        this.fetchStats(integration, { stat: 'received' }),
      ]);

      const issuesArray = issues as any[];
      const projectsArray = projects as any[];
      const releasesArray = releases as any[];
      const statsArray = stats as any[];

      // Calculate issue severity breakdown
      const severityBreakdown: Record<string, number> = {};
      issuesArray.forEach((issue: any) => {
        const level = issue.level || 'info';
        severityBreakdown[level] = (severityBreakdown[level] || 0) + 1;
      });

      // Calculate total events from stats
      const totalEvents = statsArray.reduce((sum, [, count]) => sum + count, 0);

      return {
        summary: {
          unresolvedIssues: issuesArray.length,
          errorIssues: severityBreakdown['error'] || 0,
          warningIssues: severityBreakdown['warning'] || 0,
          totalProjects: projectsArray.length,
          recentReleases: releasesArray.length,
          totalEvents,
          period: '24h',
        },
        severityBreakdown,
        topIssues: issuesArray.slice(0, 5).map((issue: any) => ({
          id: issue.id,
          title: issue.title,
          level: issue.level,
          count: issue.count,
          userCount: issue.userCount,
          firstSeen: issue.firstSeen,
          lastSeen: issue.lastSeen,
        })),
        recentReleases: releasesArray.map((release: any) => ({
          version: release.version,
          dateCreated: release.dateCreated,
          newGroups: release.newGroups,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Sentry analytics', error);
      throw error;
    }
  }
}
