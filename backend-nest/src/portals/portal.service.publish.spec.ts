import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DemoConnectorService } from '../integrations/services/demo-connector.service';
import { IntegrationService } from '../integrations/integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortalService } from './portal.service';

jest.mock('uuid', () => ({ v4: () => 'test-share-token' }));
jest.mock('../integrations/integration.service', () => ({ IntegrationService: class {} }));

describe('PortalService draft preview and publication', () => {
  const updatedAt = new Date('2026-11-26T10:00:00.000Z');
  const portal = {
    id: 'portal-a', workspaceId: 'agency-a', deletedAt: null, updatedAt,
    name: 'Fictional client portal', description: 'Sample data only',
    isPublic: false, draftMode: true, publishRevision: 0,
    clientStatus: 'ON_TRACK', clientStatusNote: 'Fictional status for tests.',
    latestDeliverable: 'Fictional monthly report', pendingDecision: 'Approve the fictional budget',
    clientUpdateAt: updatedAt,
    workspace: { name: 'Northstar Fictional Agency', primaryColor: '#123456' },
    widgets: [{ id: 'widget-a', name: 'Fictional KPI', type: 'METRIC', order: 0,
      integrationId: 'integration-a', integration: {
        provider: 'DEMO', lastSyncedAt: new Date('2026-11-24T10:00:00.000Z'),
        lastValidDataAt: new Date('2026-11-24T10:00:00.000Z'), connectionState: 'CONNECTED',
      },
      gridX: 0, gridY: 0, gridWidth: 12, gridHeight: 4,
      config: { privateNote: 'NEVER_COPY', credential: 'NEVER_COPY' } }],
  };
  const buildService = (role = 'OWNER', workspaceId = 'agency-a') => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findFirst = jest.fn().mockResolvedValue(portal);
    const tx = { portal: { findFirst: jest.fn().mockResolvedValue(portal), updateMany } };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-a', workspaceId, role }) },
      portal: { findFirst },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const cache = { invalidatePortal: jest.fn().mockResolvedValue(undefined) };
    const integration = { fetchData: jest.fn() } as unknown as IntegrationService;
    return { service: new PortalService(prisma, integration, new DemoConnectorService(), cache as any), prisma, updateMany, findFirst, integration };
  };

  it('denies preview for another tenant before loading portal content', async () => {
    const { service, findFirst } = buildService('OWNER', 'agency-b');
    await expect(service.previewDraft('portal-a', 'agency-a', 'owner-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects stale publication without writing a snapshot', async () => {
    const { service, updateMany } = buildService();
    await expect(service.publishDraft('portal-a', 'agency-a', 'owner-a', {
      expectedUpdatedAt: '2026-11-26T09:00:00.000Z',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('publishes an allowlisted snapshot without widget config or credential fields', async () => {
    const { service, updateMany } = buildService();
    const result = await service.publishDraft('portal-a', 'agency-a', 'owner-a', { expectedUpdatedAt: updatedAt.toISOString() });
    expect(result).toMatchObject({ portalId: 'portal-a', publishRevision: 1, isPublic: false });
    const snapshot = updateMany.mock.calls[0][0].data.publishedSnapshot;
    expect(JSON.stringify(snapshot)).not.toContain('NEVER_COPY');
    expect(snapshot.widgets[0]).toMatchObject({ id: 'widget-a', provider: 'DEMO' });
    expect(snapshot).toMatchObject({ clientStatus: 'ON_TRACK', latestDeliverable: 'Fictional monthly report', pendingDecision: 'Approve the fictional budget' });
    expect(updateMany.mock.calls[0][0].where).toMatchObject({ workspaceId: 'agency-a', updatedAt });
  });

  it('previews only client-safe fields and reports a failed demo connector without substituting zero', async () => {
    const { service, integration } = buildService();
    (integration.fetchData as jest.Mock).mockRejectedValue(new Error('fixture connector failed'));
    const preview = await service.previewDraft('portal-a', 'agency-a', 'owner-a');
    expect(preview.widgets[0]).toMatchObject({ data: null, sourceLabel: 'Sample connector unavailable', isDemo: true });
    expect(preview).toMatchObject({
      clientStatus: 'ON_TRACK', latestDeliverable: 'Fictional monthly report', pendingDecision: 'Approve the fictional budget',
      feedStatus: { health: 'STALE', lastSyncedAt: '2026-11-24T10:00:00.000Z' },
    });
    expect(JSON.stringify(preview)).not.toContain('NEVER_COPY');
    expect(JSON.stringify(preview)).not.toContain('integration-a');
  });
});
