import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { DemoConnectorService } from '../integrations/services/demo-connector.service';
import { IntegrationService } from '../integrations/integration.service';
import { PrismaService } from '../prisma/prisma.service';

import { PortalService } from './portal.service';

jest.mock('uuid', () => ({ v4: () => 'test-share-token' }));
jest.mock('../integrations/integration.service', () => ({ IntegrationService: class {} }));

describe('PortalService tenant revocation policy', () => {
  const integration = {} as IntegrationService;
  const demo = new DemoConnectorService();
  const cache = { invalidatePortal: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('soft deletes, privatizes, rotates share token, and invalidates portal and widget caches', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-a', workspaceId: 'agency-a', role: 'OWNER' }) },
      portal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'portal-a', workspaceId: 'agency-a', deletedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      widget: { findMany: jest.fn().mockResolvedValue([{ id: 'widget-a' }, { id: 'widget-b' }]) },
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integration, demo, cache as any);

    await service.remove('portal-a', 'agency-a', 'owner-a');

    const update = (prisma.portal.updateMany as jest.Mock).mock.calls[0][0];
    expect(update.where).toEqual({ id: 'portal-a', workspaceId: 'agency-a', deletedAt: null });
    expect(update.data.deletedAt).toBeInstanceOf(Date);
    expect(update.data.isPublic).toBe(false);
    expect(update.data.shareToken).not.toBe('');
    expect(cache.invalidatePortal).toHaveBeenCalledWith('portal-a', ['widget-a', 'widget-b']);
  });

  it('denies a guessed portal ID from another workspace before mutation', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-b', workspaceId: 'agency-b', role: 'OWNER' }) },
      portal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'portal-a', workspaceId: 'agency-a', deletedAt: null }),
        updateMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integration, demo, cache as any);

    await expect(service.remove('portal-a', 'agency-b', 'owner-b')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.portal.updateMany).not.toHaveBeenCalled();
  });

  it('does not resolve revoked or private portals through the public share route', async () => {
    const prisma = {
      portal: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integration, demo, cache as any);

    await expect(service.findPublicViewByShareToken('old-share-token')).rejects.toBeInstanceOf(NotFoundException);
    expect((prisma.portal.findUnique as jest.Mock).mock.calls[0][0].where).toMatchObject({
      shareToken: 'old-share-token',
      deletedAt: null,
      isPublic: true,
    });
  });

  it('cannot make a portal public while an assigned client link is active', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-a', workspaceId: 'agency-a', role: 'OWNER' }) },
      portal: { findFirst: jest.fn().mockResolvedValue({ id: 'portal-a', workspaceId: 'agency-a', deletedAt: null }), updateMany: jest.fn() },
      shareLink: { findFirst: jest.fn().mockResolvedValue({ id: 'assigned-link' }) },
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integration, demo, cache as any);
    await expect(service.update('portal-a', 'agency-a', 'owner-a', { isPublic: true }))
      .rejects.toThrow('Disable assigned client links');
    expect(prisma.portal.updateMany).not.toHaveBeenCalled();
  });
});
