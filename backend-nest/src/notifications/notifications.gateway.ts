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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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
  private MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP || '50', 10);

  constructor(private readonly jwtService: JwtService) {}

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

      (client as any).userId = userId;

      (client as any).workspaceId = workspaceId;

      // Track user's sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(client.id);

      // Join workspace room
      void client.join(`workspace:${workspaceId}`);

      this.logger.log(`Client connected: ${client.id} (User: ${(client as any).userId as string})`);

      // Send connection acknowledgment
      client.emit('connected', {
        message: 'Successfully connected to notifications',
        timestamp: new Date().toISOString(),
      });
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
  handleSubscribePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    void client.join(`portal:${data.portalId}`);
    this.logger.log(`Client ${client.id} subscribed to portal ${data.portalId}`);
    return { success: true, portalId: data.portalId };
  }

  @SubscribeMessage('unsubscribe:portal')
  handleUnsubscribePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
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
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
      this.logger.debug(`Notification sent to user ${userId}: ${event}`);
    }
  }

  /**
   * Notify all users in a workspace
   */
  notifyWorkspace(workspaceId: string, event: string, data: Record<string, unknown>): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
    this.logger.debug(`Notification sent to workspace ${workspaceId}: ${event}`);
  }

  /**
   * Notify all users subscribed to a portal
   */
  notifyPortal(portalId: string, event: string, data: Record<string, unknown>): void {
    this.server.to(`portal:${portalId}`).emit(event, data);
    this.logger.debug(`Notification sent to portal ${portalId}: ${event}`);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: Record<string, unknown>): void {
    this.server.emit(event, data);
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
