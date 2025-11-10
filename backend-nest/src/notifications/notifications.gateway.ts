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
import { Logger, UseGuards } from '@nestjs/common';
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
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authenticate WebSocket connection
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(
          `Client ${client.id} connection rejected: No token provided`,
        );
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub;
      client.workspaceId = payload.workspaceId;

      // Track user's sockets
      if (client.userId && !this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      if (client.userId) {
        this.userSockets.get(client.userId)!.add(client.id);
      }

      // Join workspace room
      if (client.workspaceId) {
        client.join(`workspace:${client.workspaceId}`);
      }

      this.logger.log(
        `Client connected: ${client.id} (User: ${client.userId})`,
      );

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

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:portal')
  handleSubscribePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    client.join(`portal:${data.portalId}`);
    this.logger.log(
      `Client ${client.id} subscribed to portal ${data.portalId}`,
    );
    return { success: true, portalId: data.portalId };
  }

  @SubscribeMessage('unsubscribe:portal')
  handleUnsubscribePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    client.leave(`portal:${data.portalId}`);
    this.logger.log(
      `Client ${client.id} unsubscribed from portal ${data.portalId}`,
    );
    return { success: true, portalId: data.portalId };
  }

  /**
   * Notify a specific user
   */
  notifyUser(userId: string, event: string, data: any) {
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
  notifyWorkspace(workspaceId: string, event: string, data: any) {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
    this.logger.debug(
      `Notification sent to workspace ${workspaceId}: ${event}`,
    );
  }

  /**
   * Notify all users subscribed to a portal
   */
  notifyPortal(portalId: string, event: string, data: any) {
    this.server.to(`portal:${portalId}`).emit(event, data);
    this.logger.debug(`Notification sent to portal ${portalId}: ${event}`);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any) {
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
