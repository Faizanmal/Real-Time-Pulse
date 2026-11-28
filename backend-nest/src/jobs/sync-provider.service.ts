import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

export interface SyncPage {
  records: Array<{ id: string | number; updated_at?: string; [key: string]: unknown }>;
  nextPage: number | null;
}

@Injectable()
export class SyncProviderService {
  constructor(private readonly http: HttpService) {}

  async fetchGitHubIssues(
    integration: { accessToken: string; settings: unknown },
    options: { owner?: string; repo?: string; page: number; since?: string; perPage: number },
  ): Promise<SyncPage> {
    const resource = options.owner && options.repo
      ? `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/issues`
      : '/user/issues';
    const response = await firstValueFrom(this.http.get(
      `https://api.github.com${resource}`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        params: {
          state: 'all',
          sort: 'updated',
          direction: 'asc',
          page: options.page,
          per_page: options.perPage,
          ...(options.since ? { since: options.since } : {}),
        },
        timeout: 15000,
      },
    ));
    if (!Array.isArray(response.data)) throw new Error('Provider returned an invalid page');
    const records = response.data as SyncPage['records'];
    if (records.some((record) => record.id === undefined || record.id === null)) {
      throw new Error('Provider page contained a record without an ID');
    }
    const link = String(response.headers?.link ?? '');
    const next = link.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="next"/i);
    return {
      records,
      // A full page without Link metadata is followed by one final empty-page request.
      nextPage: next ? Number(next[1]) : records.length === options.perPage ? options.page + 1 : null,
    };
  }
}
