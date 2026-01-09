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
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// --- Types & Interfaces ---

interface SocketMetadata {
  userId: string;
  workspaceId: string;
  connectedAt: Date;
  lastActivity: Date;
  device?: string;
  ipAddress?: string;
}

interface PresenceInfo {
  userId: string;
  userName: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
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

  // State Management (Local Memory)
  private readonly connections = new Map<string, SocketMetadata>();
  private readonly presence = new Map<string, Map<string, PresenceInfo>>(); // workspaceId -> userId -> presence
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> socketIds
  private readonly ipConnectionCounts = new Map<string, number>();

  private readonly MAX_CONNECTIONS_PER_IP = parseInt(
    process.env.WS_MAX_CONNECTIONS_PER_IP || '50',
    10,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway initialized');
    // Periodic cleanup of stale connections every minute
    setInterval(() => this.cleanupStaleConnections(), 60000);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token provided`);
        client.disconnect();
        return;
      }

      // IP Throttling to prevent DOS
      const ip = client.handshake.address || 'unknown';
      const count = this.ipConnectionCounts.get(ip) || 0;
      if (count >= this.MAX_CONNECTIONS_PER_IP) {
        this.logger.warn(
          `Client ${client.id} rejected: Too many connections from IP ${ip}`,
        );
        client.emit('error', { message: 'Too many connections from your IP' });
        client.disconnect();
        return;
      }
      this.ipConnectionCounts.set(ip, count + 1);

      const payload = await this.verifyToken(token);
      const { userId, workspaceId } = payload;

      // Store connection metadata
      this.connections.set(client.id, {
        userId,
        workspaceId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        device: client.handshake.headers['user-agent'],
        ipAddress: ip,
      });

      // Track user's multi-device sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // Join standard rooms
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
    const ip = client.handshake.address || 'unknown';
    const count = this.ipConnectionCounts.get(ip) || 0;
    if (count > 0) this.ipConnectionCounts.set(ip, count - 1);

    const metadata = this.connections.get(client.id);
    if (metadata) {
      const { userId, workspaceId } = metadata;

      // Remove from user's socket set
      this.userSockets.get(userId)?.delete(client.id);

      // If user has no more active connections/tabs, mark as offline
      if (
        !this.userSockets.get(userId) ||
        this.userSockets.get(userId)?.size === 0
      ) {
        this.userSockets.delete(userId);
        await this.updatePresence(workspaceId, userId, 'offline');

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

    const portal = await this.prisma.portal.findFirst({
      where: { id: data.portalId, workspaceId: metadata.workspaceId },
    });

    if (!portal) {
      client.emit('error', { message: 'Portal not found or access denied' });
      return;
    }

    await client.join(`portal:${data.portalId}`);

    await this.updatePresence(
      metadata.workspaceId,
      metadata.userId,
      'online',
      data.portalId,
    );

    client.to(`portal:${data.portalId}`).emit('portal:viewer:joined', {
      userId: metadata.userId,
      portalId: data.portalId,
      timestamp: new Date(),
    });

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
  // COLLABORATION (CURSOR/TYPING)
  // ============================================

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string; x: number; y: number },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata) return;
    metadata.lastActivity = new Date(); // Keep connection alive

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
  // BROADCAST METHODS (Service-facing)
  // ============================================

  broadcastToWorkspace(workspaceId: string, event: string, data: any): void {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit(event, { ...data, timestamp: new Date() });
  }

  broadcastToPortal(portalId: string, event: string, data: any): void {
    this.server
      .to(`portal:${portalId}`)
      .emit(event, { ...data, timestamp: new Date() });
  }

  broadcastToWidget(widgetId: string, event: string, data: any): void {
    this.server
      .to(`widget:${widgetId}`)
      .emit(event, { ...data, timestamp: new Date() });
  }

  broadcastToUser(userId: string, event: string, data: any): void {
    this.server
      .to(`user:${userId}`)
      .emit(event, { ...data, timestamp: new Date() });
  }

  broadcastToAll(event: string, data: any): void {
    this.server.emit(event, { ...data, timestamp: new Date() });
  }

  emitWidgetUpdate(widgetId: string, data: any): void {
    this.broadcastToWidget(widgetId, 'widget:data:updated', { widgetId, data });
  }

  emitPortalLayoutUpdate(portalId: string, layout: any): void {
    this.broadcastToPortal(portalId, 'portal:layout:updated', {
      portalId,
      layout,
    });
  }

  emitAlert(workspaceId: string, alert: any): void {
    this.broadcastToWorkspace(workspaceId, 'alert:triggered', alert);
  }

  emitInsight(workspaceId: string, insight: any): void {
    this.broadcastToWorkspace(workspaceId, 'insight:generated', insight);
  }

  // ============================================
  // INTERNAL UTILITIES
  // ============================================

  private async updatePresence(
    workspaceId: string,
    userId: string,
    status: PresenceInfo['status'],
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
        const presence = this.presence
          .get(metadata.workspaceId)
          ?.get(metadata.userId);
        if (presence) viewers.push(presence);
      }
    }
    return viewers;
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') return queryToken;
    return client.handshake.auth?.token || null;
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
    const staleThreshold = 5 * 60 * 1000;

    for (const [socketId, metadata] of this.connections) {
      if (now - metadata.lastActivity.getTime() > staleThreshold) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) socket.disconnect(true);
        this.connections.delete(socketId);
      }
    }
  }

  getStats() {
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
