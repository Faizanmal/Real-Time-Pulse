import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import { ShareLinksService } from './share-links.service';

jest.mock('uuid', () => ({ v4: () => 'synthetic-share-token' }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn(), toString: jest.fn(), toBuffer: jest.fn() }));
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const baseLink = (overrides: Record<string, unknown> = {}) => ({
  id: 'link-a',
  token: 'synthetic-share-token',
  portalId: 'portal-a',
  password: null,
  expiresAt: null,
  maxViews: null,
  currentViews: 0,
  allowExport: false,
  allowComments: false,
  isActive: true,
  portal: {
    id: 'portal-a',
    name: 'Shared client portal',
    description: 'Public summary',
    shareToken: 'portal-share-secret',
    workspaceId: 'agency-a',
    layout: { private: true },
    deletedAt: null,
    clientStatus: 'ON_TRACK',
    clientStatusNote: 'Fictional status',
    latestDeliverable: 'Fictional deliverable',
    pendingDecision: 'Fictional decision',
    clientUpdateAt: new Date('2026-11-26T10:00:00.000Z'),
    widgets: [
      {
        id: 'widget-a',
        name: 'Visible KPI',
        type: 'KPI',
        order: 0,
        config: { secret: 'widget-secret' },
      },
    ],
    workspace: {
      name: 'Northstar Studio',
      logo: null,
      primaryColor: '#123456',
      contactEmail: 'private@northstar.invalid',
    },
  },
  ...overrides,
});

describe('ShareLinksService public access policy', () => {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    invalidatePortal: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => jest.clearAllMocks());

  function serviceWith(
    prismaOverrides: Record<string, unknown>,
    link = baseLink(),
    valueLedger?: { publicClaims: jest.Mock },
  ) {
    const prisma = {
      shareLink: {
        findUnique: jest.fn().mockResolvedValue(link),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        ...prismaOverrides,
      },
    } as unknown as PrismaService;
    return {
      service: new ShareLinksService(
        prisma,
        cache as unknown as CacheService,
        undefined,
        undefined,
        valueLedger as never,
      ),
      prisma,
    };
  }

  it('returns a public field allowlist and records success without storing link or referrer secrets', async () => {
    const valueLedger = {
      publicClaims: jest.fn().mockResolvedValue([{ title: 'Fictional savings', revision: 1 }]),
    };
    const { service } = serviceWith({}, baseLink(), valueLedger);
    const result = await service.accessSharedPortal('synthetic-share-token', undefined, {
      ip: '192.0.2.10',
      referrer: 'https://client.example/share/private-token?access=secret',
    });

    const body = JSON.stringify(result);
    expect(body).not.toContain('portal-share-secret');
    expect(body).not.toContain('workspaceId');
    expect(body).not.toContain('widget-secret');
    expect(body).not.toContain('contactEmail');
    expect(body).not.toContain('layout');
    expect(body).toContain('Fictional deliverable');
    expect(body).toContain('Fictional decision');
    expect(body).toContain('Fictional status');
    expect(body).toContain('NO_DATA');
    expect(body).toContain('Fictional savings');
    expect(body).not.toContain('workspaceId');
    const auditPayload = cache.set.mock.calls[0][1];
    expect(auditPayload).not.toContain('192.0.2.10');
    expect(auditPayload).not.toContain('private-token');
    expect(auditPayload).not.toContain('access=secret');
    expect(auditPayload).toContain('client.example');
  });

  it('does not consume a view when password is missing', async () => {
    const { service, prisma } = serviceWith({}, baseLink({ password: 'bcrypt-hash' }));
    await expect(service.accessSharedPortal('synthetic-share-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.shareLink.updateMany).not.toHaveBeenCalled();
  });

  it('rejects expired and revoked portal links without consuming a view', async () => {
    const expired = serviceWith({}, baseLink({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(
      expired.service.accessSharedPortal('synthetic-share-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(expired.prisma.shareLink.updateMany).not.toHaveBeenCalled();

    const revokedLedger = { publicClaims: jest.fn() };
    const revoked = serviceWith(
      {},
      baseLink({ portal: { ...baseLink().portal, deletedAt: new Date() } }),
      revokedLedger,
    );
    await expect(
      revoked.service.accessSharedPortal('synthetic-share-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(revoked.prisma.shareLink.updateMany).not.toHaveBeenCalled();
    expect(revokedLedger.publicClaims).not.toHaveBeenCalled();
  });

  it('fails closed when a concurrent access consumes the last view', async () => {
    const bounded = baseLink({ maxViews: 1, currentViews: 0 });
    const { service, prisma } = serviceWith(
      { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      bounded,
    );
    await expect(service.accessSharedPortal('synthetic-share-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.shareLink.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currentViews: { lt: 1 } }),
      }),
    );
  });

  it('does not allow comments or exports unless the current link grants that capability', async () => {
    const link = baseLink({ allowComments: false, allowExport: false });
    const prisma = {
      shareLink: { findUnique: jest.fn().mockResolvedValue(link) },
      sharedPortalComment: { findMany: jest.fn(), create: jest.fn() },
    } as unknown as PrismaService;
    const service = new ShareLinksService(prisma, cache as unknown as CacheService);
    await expect(service.listSharedComments(link.token)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getSharedExport(link.token)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.sharedPortalComment.findMany).not.toHaveBeenCalled();
  });

  it('requires an assigned client identity and decision opt-in for decision actions', async () => {
    const assignedLink = baseLink({
      allowDecisions: true,
      assignments: [{
        userId: 'client-a',
        user: { workspaceId: 'agency-a', role: 'MEMBER' },
      }],
    });
    const { service } = serviceWith({}, assignedLink);
    await expect(service.requireDecisionCapability(assignedLink.token, undefined, undefined))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.requireDecisionCapability(assignedLink.token, undefined, 'client-b'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.requireDecisionCapability(assignedLink.token, undefined, 'client-a'))
      .resolves.toMatchObject({ id: 'link-a', allowDecisions: true });

    const disabled = serviceWith({}, baseLink({ ...assignedLink, allowDecisions: false }));
    await expect(disabled.service.requireDecisionCapability(assignedLink.token, undefined, 'client-a'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies decision responses after link expiry or revocation', async () => {
    const assignedLink = baseLink({
      allowDecisions: true,
      assignments: [{ userId: 'client-a', user: { workspaceId: 'agency-a', role: 'MEMBER' } }],
    });
    const expired = serviceWith({}, baseLink({ ...assignedLink, expiresAt: new Date(Date.now() - 1000) }));
    await expect(expired.service.requireDecisionCapability(assignedLink.token, undefined, 'client-a'))
      .rejects.toBeInstanceOf(ForbiddenException);
    const revoked = serviceWith({}, baseLink({ ...assignedLink, isActive: false }));
    await expect(revoked.service.requireDecisionCapability(assignedLink.token, undefined, 'client-a'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks password and link status again for comment/export actions', async () => {
    const { compare } = jest.requireMock('bcryptjs') as { compare: jest.Mock };
    compare.mockResolvedValueOnce(false);
    const secretLink = baseLink({ password: 'bcrypt-hash', allowComments: true });
    const prisma = {
      shareLink: { findUnique: jest.fn().mockResolvedValue(secretLink) },
    } as unknown as PrismaService;
    const service = new ShareLinksService(prisma, cache as unknown as CacheService);
    await expect(service.listSharedComments(secretLink.token, 'wrong')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.shareLink.findUnique = jest.fn().mockResolvedValue({ ...secretLink, isActive: false });
    await expect(service.listSharedComments(secretLink.token, 'right')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deduplicates repeated access requests and keeps them scoped to the link workspace', async () => {
    const link = baseLink();
    const prisma = {
      shareLink: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: link.id, portal: { workspaceId: 'agency-a', deletedAt: null } }),
      },
      shareAccessRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'request-existing' }),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new ShareLinksService(prisma, cache as unknown as CacheService);
    await service.requestAccess(link.token, 'Client@Example.Invalid', 'Please restore access');
    expect(prisma.shareAccessRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shareLinkId: link.id, email: 'client@example.invalid', status: 'PENDING' },
      }),
    );
    expect(prisma.shareAccessRequest.create).not.toHaveBeenCalled();
  });

  it('stores guest comments only under the authorized share-link ID', async () => {
    const link = baseLink({ allowComments: true });
    const prisma = {
      shareLink: { findUnique: jest.fn().mockResolvedValue(link) },
      sharedPortalComment: {
        create: jest.fn().mockResolvedValue({
          id: 'comment-a',
          displayName: 'Client',
          content: 'Looks good',
          createdAt: new Date(),
        }),
      },
    } as unknown as PrismaService;
    const service = new ShareLinksService(prisma, cache as unknown as CacheService);
    const saved = await service.createSharedComment(
      link.token,
      undefined,
      ' Client ',
      ' Looks good ',
    );
    expect(prisma.sharedPortalComment.create).toHaveBeenCalledWith({
      data: { shareLinkId: link.id, displayName: 'Client', content: 'Looks good' },
      select: { id: true, displayName: true, content: true, createdAt: true },
    });
    expect(saved).not.toHaveProperty('authorId');
  });

  it('requires the currently assigned same-workspace client for client-only links', async () => {
    const assigned = baseLink({
      assignments: [{ userId: 'client-a', user: { workspaceId: 'agency-a', role: 'MEMBER' } }],
    });
    const guest = serviceWith({}, assigned);
    await expect(guest.service.accessSharedPortal(assigned.token)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const otherTenant = serviceWith({}, assigned);
    await expect(
      otherTenant.service.accessSharedPortal(assigned.token, undefined, undefined, 'client-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const client = serviceWith({}, assigned);
    const result = await client.service.accessSharedPortal(
      assigned.token,
      undefined,
      undefined,
      'client-a',
    );
    expect(result.portal.id).toBe('portal-a');
  });

  it('denies access-request review by a different tenant user', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      shareAccessRequest: { findFirst: jest.fn(), update: jest.fn() },
    } as unknown as PrismaService;
    const service = new ShareLinksService(prisma, cache as unknown as CacheService);
    await expect(
      service.reviewAccessRequest('request-a', 'agency-b', 'owner-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.shareAccessRequest.findFirst).not.toHaveBeenCalled();
  });

  it('requires assigned-client links to use a private portal', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ role: 'OWNER' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'client-a' }]),
      },
      portal: { findFirst: jest.fn().mockResolvedValue({ id: 'portal-a', isPublic: true }) },
      shareLink: { create: jest.fn() },
    } as unknown as PrismaService;
    const service = new ShareLinksService(prisma, cache as unknown as CacheService);
    await expect(
      service.create('agency-a', 'owner-a', {
        portalId: 'portal-a',
        clientUserIds: ['client-a'],
      } as any),
    ).rejects.toThrow('Set the portal to private');
    expect(prisma.shareLink.create).not.toHaveBeenCalled();
  });
});
