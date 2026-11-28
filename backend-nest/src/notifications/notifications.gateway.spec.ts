import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway tenant rooms', () => {
  it('rejects a guessed portal ID from another workspace', async () => {
    const prisma = { portal: { findFirst: jest.fn().mockResolvedValue(null) } };
    const gateway = new NotificationsGateway({} as any, prisma as any);
    const client = {
      id: 'socket-a', userId: 'user-a', workspaceId: 'tenant-a',
      join: jest.fn(), rooms: new Set(['socket-a']),
    } as any;

    const result = await gateway.handleSubscribePortal(client, { portalId: 'guessed-portal' });

    expect(result).toEqual({ success: false, error: 'Access denied' });
    expect(prisma.portal.findFirst).toHaveBeenCalledWith({
      where: { id: 'guessed-portal', workspaceId: 'tenant-a', deletedAt: null },
      select: { id: true },
    });
    expect(client.join).not.toHaveBeenCalled();
  });
});
