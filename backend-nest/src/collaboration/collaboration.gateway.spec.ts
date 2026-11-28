import { CollaborationGateway } from './collaboration.gateway';

describe('CollaborationGateway tenant room authorization', () => {
  let gateway: CollaborationGateway;
  let service: { verifyPortalAccess: jest.Mock; logActivity: jest.Mock; claimRealtimeOperation: jest.Mock; saveChatMessage: jest.Mock };

  beforeEach(() => {
    service = {
      verifyPortalAccess: jest.fn(),
      logActivity: jest.fn(),
      claimRealtimeOperation: jest.fn(),
      saveChatMessage: jest.fn(),
    };
    gateway = new CollaborationGateway({} as any, service as any);
    gateway.server = { to: jest.fn(() => ({ emit: jest.fn() })) } as any;
  });

  function socket(rooms: string[] = []) {
    return {
      id: 'socket-a', userId: 'user-a', workspaceId: 'tenant-a', userName: 'Demo User',
      rooms: new Set(['socket-a', ...rooms]), join: jest.fn(), leave: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })),
    } as any;
  }

  it('rejects a guessed cross-tenant portal ID before joining or logging activity', async () => {
    service.verifyPortalAccess.mockResolvedValue(false);
    const client = socket();

    const result = await gateway.handleJoinPortal(client, { portalId: 'guessed-portal' });

    expect(result).toEqual({ success: false, error: 'Access denied to this portal' });
    expect(client.join).not.toHaveBeenCalled();
    expect(service.logActivity).not.toHaveBeenCalled();
  });

  it('does not forward cursor or activity requests from a socket outside the authorized room', async () => {
    const client = socket();

    const cursorResult = await gateway.handleCursorMove(client, { portalId: 'guessed-portal', cursor: { x: 1, y: 1 } });
    const activityResult = await gateway.handleGetActivityFeed(client, { portalId: 'guessed-portal' });

    expect(cursorResult).toEqual({ success: false, error: 'Access denied' });
    expect(activityResult).toEqual({ success: false, error: 'Access denied' });
    expect(service.verifyPortalAccess).not.toHaveBeenCalled();
  });

  it('rechecks the tenant-scoped portal grant on an existing room before mutation', async () => {
    service.verifyPortalAccess.mockResolvedValue(false);
    const client = socket(['portal:portal-from-another-tenant']);

    const result = await gateway.handleChatMessage(client, {
      portalId: 'portal-from-another-tenant', message: 'must not persist',
    });

    expect(result).toEqual({ success: false, error: 'Access denied' });
    expect(service.verifyPortalAccess).toHaveBeenCalledWith('user-a', 'tenant-a', 'portal-from-another-tenant');
  });

  it('keeps presence while another tab for the same user remains in the portal room', async () => {
    const client = socket(['portal:portal-a']);
    (gateway as any).portalUsers.set('portal-a', new Map([['user-a', {
      userId: 'user-a', name: 'Demo User', status: 'active', lastSeen: new Date(),
    }]]));
    const roomEmit = jest.fn();
    gateway.server = { in: jest.fn(() => ({ fetchSockets: jest.fn().mockResolvedValue([
      { id: 'socket-b', userId: 'user-a' },
    ]) })), to: jest.fn(() => ({ emit: roomEmit })) } as any;

    await gateway.handleDisconnect(client);

    expect(gateway.getPortalUsers('portal-a')).toHaveLength(1);
    expect(roomEmit).not.toHaveBeenCalledWith('user:left', expect.anything());
  });

  it('does not persist or rebroadcast a retried chat operation ID', async () => {
    service.verifyPortalAccess.mockResolvedValue(true);
    service.claimRealtimeOperation.mockResolvedValue(false);
    const serverTo = jest.fn(() => ({ emit: jest.fn() }));
    gateway.server = { to: serverTo } as any;
    const client = socket(['portal:portal-a']);

    const result = await gateway.handleChatMessage(client, {
      portalId: 'portal-a', message: 'retry message', operationId: 'chat-op-123',
    });

    expect(result).toEqual({ success: true, duplicate: true });
    expect(service.claimRealtimeOperation).toHaveBeenCalledWith('portal-a', 'user-a', 'chat-op-123');
    expect(service.saveChatMessage).not.toHaveBeenCalled();
    expect(serverTo).not.toHaveBeenCalled();
  });
});
