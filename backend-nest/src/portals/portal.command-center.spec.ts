import { ForbiddenException } from '@nestjs/common';

import type { AuditService } from '../audit/audit.service';
import type { CacheService } from '../cache/cache.service';
import type { IntegrationService } from '../integrations/integration.service';
import { DemoConnectorService } from '../integrations/services/demo-connector.service';
import type { PrismaService } from '../prisma/prisma.service';

import { PortalService } from './portal.service';

jest.mock('uuid', () => ({ v4: () => 'test-share-token' }));
jest.mock('../integrations/integration.service', () => ({ IntegrationService: class {} }));

describe('PortalService command center', () => {
  const owner = {
    id: 'owner-a',
    workspaceId: 'agency-a',
    role: 'OWNER',
    email: 'owner@example.test',
  };

  function setup() {
    let portalPublic = true;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(owner) },
      portal: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'portal-a', name: 'Fictional client', clientStatus: 'BLOCKED' },
          ]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({ isPublic: false }),
        updateMany: jest.fn((args: { where: { id: string; isPublic?: boolean } }) => {
          const { where } = args;
          if (where.id !== 'portal-a' || !portalPublic || where.isPublic !== true)
            return Promise.resolve({ count: 0 });
          portalPublic = false;
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    const cache = { invalidatePortal: jest.fn().mockResolvedValue(undefined) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PortalService(
      prisma as unknown as PrismaService,
      {} as unknown as IntegrationService,
      new DemoConnectorService(),
      cache as unknown as CacheService,
      undefined,
      undefined,
      undefined,
      audit as unknown as AuditService,
    );
    return { service, prisma, cache, audit };
  }

  it('returns only the caller workspace with a bounded, narrow attention page', async () => {
    const { service, prisma } = setup();
    const result = await service.findAttention('agency-a', 'owner-a', 0, 999);
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(prisma.portal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'agency-a', deletedAt: null }),
        take: 20,
        select: expect.not.objectContaining({ shareToken: true, publishedSnapshot: true }),
      }),
    );
    await expect(service.findAttention('agency-b', 'owner-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('keeps the attention query count fixed with a 200-record tenant fixture', async () => {
    const { service, prisma } = setup();
    prisma.portal.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        id: `portal-${index}`,
        name: `Fictional ${index}`,
      })),
    );
    prisma.portal.count.mockResolvedValue(200);
    const result = await service.findAttention('agency-a', 'owner-a', 1, 5);
    expect(result.total).toBe(200);
    expect(result.items).toHaveLength(5);
    expect(prisma.portal.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.portal.count).toHaveBeenCalledTimes(1);
  });

  it('deduplicates bulk IDs, scopes each write, and reports stale or foreign IDs without revealing them', async () => {
    const { service, prisma, cache, audit } = setup();
    const result = await service.bulkUnpublish(
      ['portal-a', 'portal-a', 'other-tenant-id', 'deleted-id'],
      'agency-a',
      'owner-a',
    );
    expect(result).toEqual({
      requestedCount: 3,
      succeededCount: 1,
      unavailableCount: 2,
      succeededPortalIds: ['portal-a'],
    });
    expect(prisma.portal.updateMany).toHaveBeenCalledTimes(3);
    expect(prisma.portal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-tenant-id', workspaceId: 'agency-a', deletedAt: null, isPublic: true },
      }),
    );
    expect(cache.invalidatePortal).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'agency-a',
        action: 'UPDATE',
        entity: 'PortalBulkOperation',
        newValues: {
          operation: 'UNPUBLISH',
          succeededCount: 1,
          requestedCount: 3,
          changedPortalIds: ['portal-a'],
        },
      }),
    );
    expect(JSON.stringify(result)).not.toContain('other-tenant-id');
  });

  it('denies non-admin bulk writes and rejects oversized requests', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...owner, role: 'MEMBER' });
    await expect(service.bulkUnpublish(['portal-a'], 'agency-a', 'owner-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.user.findUnique.mockResolvedValue(owner);
    await expect(
      service.bulkUnpublish(
        Array.from({ length: 51 }, (_, index) => `portal-${index}`),
        'agency-a',
        'owner-a',
      ),
    ).rejects.toThrow('Select between 1 and 50 valid portals.');
    expect(prisma.portal.updateMany).not.toHaveBeenCalled();
  });

  it('does not repeat side effects or audit events when the same unpublish is replayed', async () => {
    const { service, cache, audit } = setup();
    await expect(service.bulkUnpublish(['portal-a'], 'agency-a', 'owner-a')).resolves.toMatchObject(
      { succeededCount: 1 },
    );
    await expect(service.bulkUnpublish(['portal-a'], 'agency-a', 'owner-a')).resolves.toMatchObject(
      { succeededCount: 0, unavailableCount: 1 },
    );
    expect(cache.invalidatePortal).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('makes the single unpublish endpoint idempotent too', async () => {
    const { service, cache, audit } = setup();
    await expect(service.unpublish('portal-a', 'agency-a', 'owner-a')).resolves.toEqual({
      portalId: 'portal-a',
      isPublic: false,
    });
    await expect(service.unpublish('portal-a', 'agency-a', 'owner-a')).resolves.toEqual({
      portalId: 'portal-a',
      isPublic: false,
    });
    expect(cache.invalidatePortal).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });
});
