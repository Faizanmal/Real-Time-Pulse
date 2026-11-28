import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway tenant room authorization', () => {
  let gateway: RealtimeGateway;
  let prisma: { portal: { findFirst: jest.Mock }; widget: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { portal: { findFirst: jest.fn() }, widget: { findMany: jest.fn() } };
    gateway = new RealtimeGateway({} as any, {} as any, prisma as any);
    (gateway as any).connections.set('socket-a', {
      userId: 'agency-a', workspaceId: 'tenant-a', connectedAt: new Date(), lastActivity: new Date(),
    });
  });

  it('rejects a guessed portal ID outside the authenticated workspace', async () => {
    prisma.portal.findFirst.mockResolvedValue(null);
    const client = { id: 'socket-a', rooms: new Set(['socket-a']), join: jest.fn(), emit: jest.fn() } as any;

    await gateway.handleJoinPortal(client, { portalId: 'portal-tenant-b' });

    expect(prisma.portal.findFirst).toHaveBeenCalledWith({
      where: { id: 'portal-tenant-b', workspaceId: 'tenant-a', deletedAt: null },
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('error', { message: 'Portal not found or access denied' });
  });

  it('subscribes only to widgets resolved inside the authenticated tenant', async () => {
    prisma.widget.findMany.mockResolvedValue([{ id: 'widget-tenant-a' }]);
    const client = { id: 'socket-a', join: jest.fn(), emit: jest.fn() } as any;

    await gateway.handleWidgetSubscribe(client, { widgetIds: ['widget-tenant-a', 'widget-tenant-b'] });

    expect(prisma.widget.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['widget-tenant-a', 'widget-tenant-b'] },
        portal: { workspaceId: 'tenant-a', deletedAt: null },
      }),
    }));
    expect(client.join).toHaveBeenCalledTimes(1);
    expect(client.join).toHaveBeenCalledWith('widget:widget-tenant-a');
    expect(client.emit).toHaveBeenCalledWith('widget:subscribed', { widgetIds: ['widget-tenant-a'] });
  });
});
