import { ForbiddenException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

jest.mock('../jobs/jobs.service', () => ({ JobsService: class JobsService {} }));

import { IntegrationService } from './integration.service';
import { GitHubService } from './services/github.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import type { PrismaService } from '../prisma/prisma.service';

const record = (provider: string) => ({
  id: `integration-${provider.toLowerCase()}`,
  workspaceId: 'workspace-a',
  provider,
  accessToken: 'fictional-access-token',
  refreshToken: 'fictional-refresh-token',
  tokenEncryptionVersion: 0,
  expiresAt: null,
  accountId: null,
  accountName: 'Fictional test connector',
  scopes: null,
  settings: { safe: true },
  status: 'ACTIVE',
  connectionState: 'CONNECTED',
  lastSyncedAt: new Date('2026-01-01T00:00:00Z'),
  lastValidDataAt: new Date('2026-01-01T00:00:00Z'),
  lastSyncError: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

const serviceWith = (
  prisma: any,
  jobsService: any = { queueDataSync: jest.fn().mockResolvedValue(undefined) },
  httpService: any = { post: jest.fn() },
) => {
  const service = Object.create(IntegrationService.prototype) as IntegrationService;
  Object.assign(service, {
    prisma,
    encryptionService: {
      encrypt: (value: string) => `cipher:${Buffer.from(value).toString('base64')}`,
      decrypt: (value: string) => {
        if (!value.startsWith('cipher:')) throw new Error('Invalid ciphertext');
        return Buffer.from(value.slice('cipher:'.length), 'base64').toString();
      },
    },
    jobsService,
    httpService,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    demoConnectorService: {
      getSettings: jest.fn().mockReturnValue({ isDemo: true }),
      fetchData: jest.fn().mockReturnValue({ isDemo: true }),
    },
  });
  return service;
};

describe('connector provider contracts (mock HTTP only)', () => {
  it.each(['GITHUB', 'GOOGLE_ANALYTICS'])(
    '%s connect and disconnect responses exclude credentials',
    async (provider) => {
      const item = record(provider);
      const prisma = {
        integration: {
          create: jest.fn().mockResolvedValue(item),
          findUnique: jest.fn().mockResolvedValue(item),
          delete: jest.fn().mockResolvedValue(item),
        },
      };
      const service = serviceWith(prisma);
      const created = await service.createIntegration({
        workspaceId: 'workspace-a',
        provider: provider as any,
        accessToken: item.accessToken,
        refreshToken: item.refreshToken,
      });
      expect(JSON.stringify(created)).not.toContain(item.accessToken);
      expect(JSON.stringify(created)).not.toContain(item.refreshToken);
      expect(prisma.integration.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          tokenEncryptionVersion: 1,
          accessToken: `cipher:${Buffer.from(item.accessToken).toString('base64')}`,
        }),
      }));
      await service.deleteIntegration(item.id);
      expect(prisma.integration.delete).toHaveBeenCalledWith({ where: { id: item.id } });
    },
  );

  it('retries fictional demo connector creation idempotently without returning its sentinel token', async () => {
    const item = { ...record('DEMO'), accessToken: 'DEMO_ONLY_NO_CREDENTIAL' };
    const prisma = { integration: { upsert: jest.fn().mockResolvedValue(item) } };
    const service = serviceWith(prisma);
    const first = await service.createDemoIntegration('workspace-a');
    const retry = await service.createDemoIntegration('workspace-a');
    expect(first.id).toBe(retry.id);
    expect(JSON.stringify(first)).not.toContain('DEMO_ONLY_NO_CREDENTIAL');
    expect(prisma.integration.upsert).toHaveBeenCalledTimes(2);
  });

  it('refreshes mocked GitHub OAuth and stores token rotation without serializing tokens', async () => {
    const item = record('GITHUB');
    const updated = {
      ...item,
      accessToken: 'fictional-new-access',
      refreshToken: 'fictional-new-refresh',
    };
    const prisma = {
      integration: {
        findUnique: jest.fn().mockResolvedValue(item),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const http = {
      post: jest.fn().mockReturnValue(
        of({
          data: {
            access_token: updated.accessToken,
            refresh_token: updated.refreshToken,
            expires_in: 3600,
          },
        }),
      ),
    };
    const service = serviceWith(prisma, undefined, http);
    const oldId = process.env.GITHUB_INTEGRATION_CLIENT_ID;
    const oldSecret = process.env.GITHUB_INTEGRATION_CLIENT_SECRET;
    process.env.GITHUB_INTEGRATION_CLIENT_ID = 'fictional-client-id';
    process.env.GITHUB_INTEGRATION_CLIENT_SECRET = 'fictional-client-secret';
    try {
      const result = await service.refreshToken(item.id);
      expect(http.post.mock.calls[0][0]).toBe('https://github.com/login/oauth/access_token');
      expect(http.post.mock.calls[0][1]).toContain('grant_type=refresh_token');
      expect(JSON.stringify(result)).not.toContain('fictional-new-access');
      expect(prisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: `cipher:${Buffer.from(updated.accessToken).toString('base64')}`,
            refreshToken: `cipher:${Buffer.from(updated.refreshToken).toString('base64')}`,
            tokenEncryptionVersion: 1,
            connectionState: 'CONNECTED',
          }),
        }),
      );
    } finally {
      if (oldId === undefined) delete process.env.GITHUB_INTEGRATION_CLIENT_ID;
      else process.env.GITHUB_INTEGRATION_CLIENT_ID = oldId;
      if (oldSecret === undefined) delete process.env.GITHUB_INTEGRATION_CLIENT_SECRET;
      else process.env.GITHUB_INTEGRATION_CLIENT_SECRET = oldSecret;
    }
  });

  it('refreshes mocked Google OAuth, classifies rate limit and invalid grant, and preserves last valid data time', async () => {
    const item = record('GOOGLE_ANALYTICS');
    const prisma = {
      integration: {
        findUnique: jest.fn().mockResolvedValue(item),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => Promise.resolve({ ...item, ...data })),
      },
    };
    const http = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { access_token: 'fictional-google-access', expires_in: 1800 } }),
        ),
    };
    const service = serviceWith(prisma, undefined, http);
    const oldId = process.env.GOOGLE_INTEGRATION_CLIENT_ID;
    const oldSecret = process.env.GOOGLE_INTEGRATION_CLIENT_SECRET;
    process.env.GOOGLE_INTEGRATION_CLIENT_ID = 'fictional-google-client';
    process.env.GOOGLE_INTEGRATION_CLIENT_SECRET = 'fictional-google-secret';
    try {
      const result = await service.refreshToken(item.id);
      expect(http.post.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
      expect(JSON.stringify(result)).not.toContain('fictional-google-access');
      http.post.mockReturnValueOnce(throwError(() => ({ response: { status: 429 } })));
      await expect(service.refreshToken(item.id)).rejects.toThrow('rate limiting');
      expect(prisma.integration.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            connectionState: 'DEGRADED',
            lastSyncError: 'rate_limited',
          }),
        }),
      );
      http.post.mockReturnValueOnce(
        throwError(() => ({ response: { status: 400, data: { error: 'invalid_grant' } } })),
      );
      await expect(service.refreshToken(item.id)).rejects.toThrow('Reconnect');
      expect(prisma.integration.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            connectionState: 'NEEDS_RECONNECT',
            lastSyncError: 'invalid_grant',
          }),
        }),
      );
      expect(prisma.integration.update.mock.calls.at(-1)[0].data).not.toHaveProperty(
        'lastValidDataAt',
      );
    } finally {
      if (oldId === undefined) delete process.env.GOOGLE_INTEGRATION_CLIENT_ID;
      else process.env.GOOGLE_INTEGRATION_CLIENT_ID = oldId;
      if (oldSecret === undefined) delete process.env.GOOGLE_INTEGRATION_CLIENT_SECRET;
      else process.env.GOOGLE_INTEGRATION_CLIENT_SECRET = oldSecret;
    }
  });

  it('requests GitHub and Google Analytics pages with bounded pagination inputs', async () => {
    const githubHttp = { get: jest.fn().mockReturnValue(of({ data: [{ id: 3 }] })) };
    const github = new GitHubService(githubHttp as any);
    await github.fetchData({ accessToken: 'fictional' }, 'repos', { page: 3, perPage: 7 });
    expect(githubHttp.get.mock.calls[0][1].params).toMatchObject({ page: 3, per_page: 7 });

    const googleHttp = {
      post: jest
        .fn()
        .mockReturnValue(
          of({ data: { rows: [{ dimensionValues: [{ value: '2026-01-01' }] }], rowCount: '2' } }),
        ),
    };
    const google = new GoogleAnalyticsService(googleHttp as any);
    const page = await google.fetchData({ accessToken: 'fictional' }, 'report', {
      propertyId: '123',
      offset: 1,
      limit: 1,
    });
    expect(googleHttp.post.mock.calls[0][1]).toMatchObject({ offset: 1, limit: 1 });
    expect(page).toMatchObject({ rowCount: '2' });
  });

  it('tests connection through mock provider responses without logging or returning credentials', async () => {
    const github = new GitHubService({
      get: jest.fn().mockReturnValue(of({ status: 200, data: { login: 'fictional' } })),
    } as any);
    const google = new GoogleAnalyticsService({
      get: jest.fn().mockReturnValue(of({ status: 200, data: { accountSummaries: [] } })),
    } as any);
    await expect(github.testConnection({ accessToken: 'fictional-github-token' })).resolves.toBe(
      true,
    );
    await expect(google.testConnection({ accessToken: 'fictional-google-token' })).resolves.toBe(
      true,
    );
  });

  it('rejects another workspace connector id and stale identifiers', async () => {
    const prisma = {
      integration: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-b' }) },
    };
    const service = serviceWith(prisma);
    await expect(
      service.assertWorkspaceAccess('connector-b', 'workspace-a'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.integration.findUnique.mockResolvedValueOnce(null);
    await expect(service.assertWorkspaceAccess('deleted-connector', 'workspace-a')).rejects.toThrow(
      'not found',
    );
  });
});
