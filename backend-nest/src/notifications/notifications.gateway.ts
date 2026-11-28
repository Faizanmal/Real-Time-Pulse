import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { createRealtimeEvent } from '../realtime/realtime-event';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workspaceId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs
  private ipConnectionCounts: Map<string, number> = new Map();
  private userTenants = new Map<string, string>();
  private portalTenants = new Map<string, string>();
  private MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP || '50', 10);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async revokePortalSubscriptions(portalId: string): Promise<void> {
    if (!this.server) return;
    const room = `portal:${portalId}`;
    this.server.to(room).emit('portal:access:revoked', { portalId });
    await this.server.in(room).socketsLeave(room);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authenticate WebSocket connection

      const authData = client.handshake.auth as any;
      const authHeader = client.handshake.headers.authorization;

      const token = (authData.token as string | undefined) || authHeader?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: No token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Throttle by IP to avoid connection storms
      const ip = client.handshake.address || 'unknown';
      const count = this.ipConnectionCounts.get(ip) || 0;
      if (count >= this.MAX_CONNECTIONS_PER_IP) {
        this.logger.warn(
          `Client ${client.id} connection rejected: Too many connections from IP ${ip}`,
        );
        client.emit('error', { message: 'Too many connections from your IP' });
        client.disconnect();
        return;
      }
      this.ipConnectionCounts.set(ip, count + 1);

      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub as string;
      const workspaceId = payload.workspaceId as string;

      const account = await this.prisma.user.findFirst({ where: { id: userId, workspaceId }, select: { role: true } });
      if (!account || account.role === 'MEMBER') {
        client.emit('error', { message: 'Use a portal link assigned to your client account' });
        client.disconnect();
        return;
      }

      (client as any).userId = userId;

      (client as any).workspaceId = workspaceId;
      this.userTenants.set(userId, workspaceId);

      // Track user's sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(client.id);

      // Join workspace room
      void client.join(`workspace:${workspaceId}`);

      this.logger.log(`Client connected: ${client.id} (User: ${(client as any).userId as string})`);

      // Send connection acknowledgment
      client.emit('connected', createRealtimeEvent({
        message: 'Successfully connected to notifications',
        timestamp: new Date().toISOString(),
      }, { tenantId: workspaceId, resourceType: 'user', resourceId: userId }));
    } catch (error) {
      this.logger.error(`Client ${client.id} authentication failed`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSocketSet = this.userSockets.get(client.userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }

    // Decrement IP connection count
    const ip = client.handshake.address || 'unknown';
    const count = this.ipConnectionCounts.get(ip) || 0;
    if (count > 0) this.ipConnectionCounts.set(ip, count - 1);

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:portal')
  async handleSubscribePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    if (!client.userId || !client.workspaceId) return { success: false, error: 'Access denied' };
    const portal = await this.prisma.portal.findFirst({
      where: { id: data.portalId, workspaceId: client.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!portal) return { success: false, error: 'Access denied' };
    this.portalTenants.set(data.portalId, client.workspaceId);
    await client.join(`portal:${data.portalId}`);
    this.logger.log(`Client ${client.id} subscribed to portal ${data.portalId}`);
    return { success: true, portalId: data.portalId };
  }

  @SubscribeMessage('unsubscribe:portal')
  handleUnsubscribePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    if (typeof data?.portalId !== 'string' || !data.portalId || data.portalId.length > 128 || !client.rooms.has(`portal:${data.portalId}`)) {
      return { success: false, error: 'Access denied' };
    }
    void client.leave(`portal:${data.portalId}`);
    this.logger.log(`Client ${client.id} unsubscribed from portal ${data.portalId}`);
    return { success: true, portalId: data.portalId };
  }

  /**
   * Notify a specific user
   */
  notifyUser(userId: string, event: string, data: Record<string, unknown>): void {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      const payload = createRealtimeEvent(data, {
        tenantId: this.userTenants.get(userId) ?? null,
        resourceType: 'user', resourceId: userId,
      });
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, payload);
      });
      this.logger.debug(`Notification sent to user ${userId}: ${event}`);
    }
  }

  /**
   * Notify all users in a workspace
   */
  notifyWorkspace(workspaceId: string, event: string, data: Record<string, unknown>): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, createRealtimeEvent(data, {
      tenantId: workspaceId, resourceType: 'workspace', resourceId: workspaceId,
    }));
    this.logger.debug(`Notification sent to workspace ${workspaceId}: ${event}`);
  }

  /**
   * Notify all users subscribed to a portal
   */
  notifyPortal(portalId: string, event: string, data: Record<string, unknown>): void {
    this.server.to(`portal:${portalId}`).emit(event, createRealtimeEvent(data, {
      tenantId: this.portalTenants.get(portalId) ?? (data.tenantId as string | undefined) ?? null,
      resourceType: 'portal', resourceId: portalId,
    }));
    this.logger.debug(`Notification sent to portal ${portalId}: ${event}`);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: Record<string, unknown>): void {
    this.server.emit(event, createRealtimeEvent(data, {
      tenantId: null, resourceType: 'system', resourceId: 'all',
    }));
    this.logger.debug(`Broadcast notification: ${event}`);
  }
}

// Notification event types
export enum NotificationEvent {
  PORTAL_CREATED = 'portal:created',
  PORTAL_UPDATED = 'portal:updated',
  PORTAL_DELETED = 'portal:deleted',
  PORTAL_PUBLISHED = 'portal:published',

  WIDGET_ADDED = 'widget:added',
  WIDGET_UPDATED = 'widget:updated',
  WIDGET_DELETED = 'widget:deleted',
  WIDGET_DATA_UPDATED = 'widget:data_updated',

  WORKSPACE_MEMBER_ADDED = 'workspace:member_added',
  WORKSPACE_MEMBER_REMOVED = 'workspace:member_removed',
  WORKSPACE_UPDATED = 'workspace:updated',

  INTEGRATION_SYNC_STARTED = 'integration:sync_started',
  INTEGRATION_SYNC_COMPLETED = 'integration:sync_completed',
  INTEGRATION_SYNC_FAILED = 'integration:sync_failed',

  NOTIFICATION_NEW = 'notification:new',
}
