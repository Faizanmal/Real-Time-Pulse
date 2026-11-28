import { of, throwError } from 'rxjs';

import { SyncProviderService } from './sync-provider.service';

describe('SyncProviderService GitHub fixed-provider contract', () => {
  it('sends a bounded incremental page request and follows provider Link pagination', async () => {
    const http = { get: jest.fn().mockReturnValue(of({
      data: [{ id: 21, updated_at: '2026-02-01T00:00:00Z' }, { id: 22, updated_at: '2026-02-02T00:00:00Z' }],
      headers: { link: '<https://api.github.com/repos/fictional-org/fictional-repo/issues?page=3>; rel="next", <https://api.github.com/repos/fictional-org/fictional-repo/issues?page=9>; rel="last"' },
    })) };
    const service = new SyncProviderService(http as any);
    const page = await service.fetchGitHubIssues(
      { accessToken: 'fictional-fixture-token', settings: {} },
      { owner: 'fictional-org', repo: 'fictional-repo', page: 2, since: '2026-01-31T23:59:59.999Z', perPage: 2 },
    );
    expect(http.get).toHaveBeenCalledWith(
      'https://api.github.com/repos/fictional-org/fictional-repo/issues',
      expect.objectContaining({ params: expect.objectContaining({ page: 2, per_page: 2, since: '2026-01-31T23:59:59.999Z' }) }),
    );
    expect(page.nextPage).toBe(3);
    expect(page.records).toHaveLength(2);
  });

  it('continues a full page without Link metadata and ends on the short final page', async () => {
    const http = { get: jest.fn()
      .mockReturnValueOnce(of({ data: [{ id: 1 }, { id: 2 }], headers: {} }))
      .mockReturnValueOnce(of({ data: [{ id: 3 }], headers: {} })) };
    const service = new SyncProviderService(http as any);
    await expect(service.fetchGitHubIssues({ accessToken: 'fixture', settings: {} }, { owner: 'fictional-org', repo: 'demo', page: 1, perPage: 2 })).resolves.toMatchObject({ nextPage: 2 });
    await expect(service.fetchGitHubIssues({ accessToken: 'fixture', settings: {} }, { owner: 'fictional-org', repo: 'demo', page: 2, perPage: 2 })).resolves.toMatchObject({ nextPage: null, records: [{ id: 3 }] });
    expect(http.get.mock.calls[1][1].params.page).toBe(2);
  });

  it('propagates page failures and rejects records without stable IDs', async () => {
    const providerError = new Error('fixture 503');
    const http = { get: jest.fn()
      .mockReturnValueOnce(throwError(() => providerError))
      .mockReturnValueOnce(of({ data: [{ updated_at: '2026-02-01T00:00:00Z' }], headers: {} })) };
    const service = new SyncProviderService(http as any);
    const integration = { accessToken: 'fixture', settings: {} };
    const request = { owner: 'fictional-org', repo: 'demo', page: 1, perPage: 10 };
    await expect(service.fetchGitHubIssues(integration, request)).rejects.toBe(providerError);
    await expect(service.fetchGitHubIssues(integration, request)).rejects.toThrow('without an ID');
  });
});
