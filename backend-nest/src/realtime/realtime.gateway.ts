/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX WEBSOCKET GATEWAY
 * ============================================================================
 * Enterprise-grade WebSocket gateway with rooms, presence, and broadcast features.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Connection metadata
interface SocketMetadata {
  userId: string;
  workspaceId: string;
  connectedAt: Date;
  lastActivity: Date;
  device?: string;
  ipAddress?: string;
}

// Room types
type RoomType = 'workspace' | 'portal' | 'widget' | 'user' | 'broadcast';

// Presence info
interface PresenceInfo {
  userId: string;
  userName: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy';
  currentPortal?: string;
  lastSeen: Date;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly connections = new Map<string, SocketMetadata>();
  private readonly presence = new Map<string, Map<string, PresenceInfo>>(); // workspaceId -> userId -> presence
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');

    // Set up adapter for horizontal scaling (Redis)
    // this.setupRedisAdapter(server);

    // Periodic cleanup of stale connections
    setInterval(() => this.cleanupStaleConnections(), 60000);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      // Authenticate the connection
      const token = this.extractToken(client);
      if (!token) {
        throw new WsException('Authentication required');
      }

      const payload = await this.verifyToken(token);
      const { userId, workspaceId } = payload;

      // Store connection metadata
      this.connections.set(client.id, {
        userId,
        workspaceId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        device: client.handshake.headers['user-agent'],
        ipAddress: client.handshake.address,
      });

      // Track user's sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // Join workspace room
      await client.join(`workspace:${workspaceId}`);
      await client.join(`user:${userId}`);

      // Update presence
      await this.updatePresence(workspaceId, userId, 'online');

      // Notify others in workspace
      client.to(`workspace:${workspaceId}`).emit('user:joined', {
        userId,
        timestamp: new Date(),
      });

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (metadata) {
      const { userId, workspaceId } = metadata;

      // Remove from user's socket set
      this.userSockets.get(userId)?.delete(client.id);

      // If user has no more connections, mark as offline
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
        await this.updatePresence(workspaceId, userId, 'offline');

        // Notify others in workspace
        this.server.to(`workspace:${workspaceId}`).emit('user:left', {
          userId,
          timestamp: new Date(),
        });
      }

      this.connections.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  // ============================================
  // PORTAL EVENTS
  // ============================================

  @SubscribeMessage('portal:join')
  async handleJoinPortal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;

    // Verify access to portal
    const portal = await this.prisma.portal.findFirst({
      where: {
        id: data.portalId,
        workspaceId: metadata.workspaceId,
      },
    });

    if (!portal) {
      client.emit('error', { message: 'Portal not found or access denied' });
      return;
    }

    await client.join(`portal:${data.portalId}`);

    // Update presence with current portal
    await this.updatePresence(
      metadata.workspaceId,
      metadata.userId,
      'online',
      data.portalId,
    );

    // Notify portal viewers
    client.to(`portal:${data.portalId}`).emit('portal:viewer:joined', {
      userId: metadata.userId,
      portalId: data.portalId,
      timestamp: new Date(),
    });

    // Send current viewers
    const viewers = await this.getPortalViewers(data.portalId);
    client.emit('portal:viewers', { portalId: data.portalId, viewers });
  }

  @SubscribeMessage('portal:leave')
  async handleLeavePortal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;

    await client.leave(`portal:${data.portalId}`);

    // Update presence to remove current portal
    await this.updatePresence(metadata.workspaceId, metadata.userId, 'online');

    client.to(`portal:${data.portalId}`).emit('portal:viewer:left', {
      userId: metadata.userId,
      portalId: data.portalId,
      timestamp: new Date(),
    });
  }

  // ============================================
  // WIDGET EVENTS
  // ============================================

  @SubscribeMessage('widget:subscribe')
  async handleWidgetSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { widgetIds: string[] },
  ): Promise<void> {
    for (const widgetId of data.widgetIds) {
      await client.join(`widget:${widgetId}`);
    }
    client.emit('widget:subscribed', { widgetIds: data.widgetIds });
  }

  @SubscribeMessage('widget:unsubscribe')
  async handleWidgetUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { widgetIds: string[] },
  ): Promise<void> {
    for (const widgetId of data.widgetIds) {
      await client.leave(`widget:${widgetId}`);
    }
  }

  // ============================================
  // CURSOR & COLLABORATION
  // ============================================

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string; x: number; y: number },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;

    client.to(`portal:${data.portalId}`).emit('cursor:moved', {
      userId: metadata.userId,
      portalId: data.portalId,
      x: data.x,
      y: data.y,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('selection:change')
  async handleSelectionChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { portalId: string; widgetId?: string; selection: any },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;

    client.to(`portal:${data.portalId}`).emit('selection:changed', {
      userId: metadata.userId,
      ...data,
      timestamp: Date.now(),
    });
  }

  // ============================================
  // COMMENTS & CHAT
  // ============================================

  @SubscribeMessage('comment:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string; widgetId?: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;

    const user = await this.prisma.user.findUnique({
      where: { id: metadata.userId },
      select: { firstName: true, lastName: true, avatar: true },
    });

    client.to(`portal:${data.portalId}`).emit('comment:user:typing', {
      userId: metadata.userId,
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      avatar: user?.avatar,
      portalId: data.portalId,
      widgetId: data.widgetId,
    });
  }

  @SubscribeMessage('comment:stop-typing')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;

    client.to(`portal:${data.portalId}`).emit('comment:user:stopped-typing', {
      userId: metadata.userId,
      portalId: data.portalId,
    });
  }

  // ============================================
  // BROADCAST METHODS (called from services)
  // ============================================

  broadcastToWorkspace(workspaceId: string, event: string, data: any): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  broadcastToPortal(portalId: string, event: string, data: any): void {
    this.server.to(`portal:${portalId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  broadcastToWidget(widgetId: string, event: string, data: any): void {
    this.server.to(`widget:${widgetId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  broadcastToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  broadcastToAll(event: string, data: any): void {
    this.server.emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  // Widget data update broadcast
  emitWidgetUpdate(widgetId: string, data: any): void {
    this.broadcastToWidget(widgetId, 'widget:data:updated', {
      widgetId,
      data,
    });
  }

  // Portal layout update broadcast
  emitPortalLayoutUpdate(portalId: string, layout: any): void {
    this.broadcastToPortal(portalId, 'portal:layout:updated', {
      portalId,
      layout,
    });
  }

  // Alert notification broadcast
  emitAlert(workspaceId: string, alert: any): void {
    this.broadcastToWorkspace(workspaceId, 'alert:triggered', alert);
  }

  // AI Insight broadcast
  emitInsight(workspaceId: string, insight: any): void {
    this.broadcastToWorkspace(workspaceId, 'insight:generated', insight);
  }

  // ============================================
  // PRESENCE MANAGEMENT
  // ============================================

  private async updatePresence(
    workspaceId: string,
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline',
    currentPortal?: string,
  ): Promise<void> {
    if (!this.presence.has(workspaceId)) {
      this.presence.set(workspaceId, new Map());
    }

    const workspacePresence = this.presence.get(workspaceId)!;

    if (status === 'offline') {
      workspacePresence.delete(userId);
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, avatar: true },
      });

      workspacePresence.set(userId, {
        userId,
        userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        avatar: user?.avatar || undefined,
        status,
        currentPortal,
        lastSeen: new Date(),
      });
    }

    // Broadcast presence update
    this.broadcastToWorkspace(workspaceId, 'presence:updated', {
      userId,
      status,
      currentPortal,
    });
  }

  getWorkspacePresence(workspaceId: string): PresenceInfo[] {
    return Array.from(this.presence.get(workspaceId)?.values() || []);
  }

  private async getPortalViewers(portalId: string): Promise<PresenceInfo[]> {
    const room = this.server.sockets.adapter.rooms.get(`portal:${portalId}`);
    if (!room) return [];

    const viewers: PresenceInfo[] = [];
    for (const socketId of room) {
      const metadata = this.connections.get(socketId);
      if (metadata) {
        const workspacePresence = this.presence.get(metadata.workspaceId);
        const presence = workspacePresence?.get(metadata.userId);
        if (presence) {
          viewers.push(presence);
        }
      }
    }
    return viewers;
  }

  // ============================================
  // UTILITIES
  // ============================================

  private extractToken(client: Socket): string | null {
    // Try auth header first
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Try query params
    const token = client.handshake.query.token;
    if (typeof token === 'string') {
      return token;
    }

    // Try auth object
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    return null;
  }

  private async verifyToken(
    token: string,
  ): Promise<{ userId: string; workspaceId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('jwt.secret'),
      });
      return { userId: payload.sub, workspaceId: payload.workspaceId };
    } catch {
      throw new WsException('Invalid token');
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [socketId, metadata] of this.connections) {
      if (now - metadata.lastActivity.getTime() > staleThreshold) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
        this.connections.delete(socketId);
      }
    }
  }

  // Get connection statistics
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    connectionsByWorkspace: Record<string, number>;
  } {
    const connectionsByWorkspace: Record<string, number> = {};

    for (const metadata of this.connections.values()) {
      connectionsByWorkspace[metadata.workspaceId] =
        (connectionsByWorkspace[metadata.workspaceId] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userSockets.size,
      connectionsByWorkspace,
    };
  }
}
