import { ForbiddenException } from '@nestjs/common';
import { DemoConnectorService } from '../integrations/services/demo-connector.service';
import { IntegrationService } from '../integrations/integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortalService } from './portal.service';

jest.mock('uuid', () => ({ v4: () => 'test-share-token' }));
jest.mock('../integrations/integration.service', () => ({ IntegrationService: class {} }));

describe('PortalService client-facing updates', () => {
  const buildService = (role: string) => {
    const existing = { id: 'portal-a', workspaceId: 'agency-a', deletedAt: null };
    const response = {
      id: 'portal-a', name: 'Portal', slug: 'portal', description: null, shareToken: 'token', isPublic: false,
      draftMode: true, publishedAt: null, publishRevision: 0, layout: null, workspaceId: 'agency-a',
      createdAt: new Date(), updatedAt: new Date(), clientStatus: 'BLOCKED', clientStatusNote: 'Fixture blocker',
      latestDeliverable: 'Fictional report', pendingDecision: 'Approve fictional change', clientUpdateAt: new Date(),
      workspace: { id: 'agency-a', name: 'Fictional Agency', logo: null, primaryColor: '#123456' }, _count: { widgets: 1 },
    };
    const portalFindFirst = jest.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(response);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-a', workspaceId: 'agency-a', role }) },
      portal: { findFirst: portalFindFirst, updateMany },
    } as unknown as PrismaService;
    const cache = { invalidatePortal: jest.fn().mockResolvedValue(undefined) };
    const service = new PortalService(prisma, {} as IntegrationService, new DemoConnectorService(), cache as any);
    return { service, portalFindFirst, updateMany };
  };

  it('limits status, deliverable, and decision edits to agency owners/admins', async () => {
    const { service, portalFindFirst, updateMany } = buildService('MEMBER');
    await expect(service.update('portal-a', 'agency-a', 'user-a', { pendingDecision: 'private fixture' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(portalFindFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('timestamps agency updates and persists only within the requested workspace', async () => {
    const { service, portalFindFirst, updateMany } = buildService('OWNER');
    await service.update('portal-a', 'agency-a', 'user-a', {
      clientStatus: 'BLOCKED', latestDeliverable: 'Fictional report', pendingDecision: 'Approve fictional change',
    });
    const update = updateMany.mock.calls[0][0];
    expect(update.where).toMatchObject({ id: 'portal-a', workspaceId: 'agency-a', deletedAt: null });
    expect(update.data).toMatchObject({ clientStatus: 'BLOCKED', latestDeliverable: 'Fictional report', pendingDecision: 'Approve fictional change' });
    expect(update.data.clientUpdateAt).toBeInstanceOf(Date);
    expect(portalFindFirst.mock.calls[1][0].where.workspaceId).toBe('agency-a');
  });
});
