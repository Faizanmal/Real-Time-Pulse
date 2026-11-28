/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX WEBSOCKET GATEWAY
 * ============================================================================
 * Enterprise-grade WebSocket gateway with rooms, presence, and broadcast features.
 */

import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

import { PrismaService } from '../prisma/prisma.service';
import { readCookieValue } from '../auth/cookie-token.util';
import { createRealtimeEvent } from './realtime-event';

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
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // State Management (Local Memory)
  private readonly connections = new Map<string, SocketMetadata>();
  private readonly presence = new Map<string, Map<string, PresenceInfo>>(); // workspaceId -> userId -> presence
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> socketIds
  private readonly ipConnectionCounts = new Map<string, number>();
  private readonly portalTenants = new Map<string, string>();
  private readonly widgetTenants = new Map<string, string>();
  private readonly userTenants = new Map<string, string>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  private readonly MAX_CONNECTIONS_PER_IP = parseInt(
    process.env.WS_MAX_CONNECTIONS_PER_IP || '50',
    10,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async revokePortalSubscriptions(portalId: string): Promise<void> {
    if (!this.server) return;
    const room = `portal:${portalId}`;
    this.server.to(room).emit('portal:access:revoked', this.portalEvent(portalId, { portalId }));
    await this.server.in(room).socketsLeave(room);
    const widgets = await this.prisma.widget.findMany({ where: { portalId }, select: { id: true } });
    for (const widget of widgets) {
      const widgetRoom = `widget:${widget.id}`;
      this.server.to(widgetRoom).emit('portal:access:revoked', this.widgetEvent(widget.id, { portalId }));
      await this.server.in(widgetRoom).socketsLeave(widgetRoom);
    }
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway initialized');
    // Periodic cleanup of stale connections every minute
    this.cleanupTimer = setInterval(() => this.cleanupStaleConnections(), 60000);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
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
        this.logger.warn(`Client ${client.id} rejected: Too many connections from IP ${ip}`);
        client.emit('error', { message: 'Too many connections from your IP' });
        client.disconnect();
        return;
      }
      this.ipConnectionCounts.set(ip, count + 1);

      const payload = await this.verifyToken(token);
      const { userId, workspaceId } = payload;
      const account = await this.prisma.user.findFirst({ where: { id: userId, workspaceId }, select: { role: true } });
      if (!account || account.role === 'MEMBER') {
        client.emit('error', { message: 'Use a portal link assigned to your client account' });
        client.disconnect();
        return;
      }

      // Store connection metadata
      this.connections.set(client.id, {
        userId,
        workspaceId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        device: client.handshake.headers['user-agent'],
        ipAddress: ip,
      });
      this.userTenants.set(userId, workspaceId);

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
      client.to(`workspace:${workspaceId}`).emit('user:joined', createRealtimeEvent({
        userId,
        timestamp: new Date(),
      }, { tenantId: workspaceId, resourceType: 'workspace', resourceId: workspaceId }));

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection failed: ${message}`);
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
      if (!this.userSockets.get(userId) || this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
        await this.updatePresence(workspaceId, userId, 'offline');

        this.server.to(`workspace:${workspaceId}`).emit('user:left', createRealtimeEvent({
          userId,
          timestamp: new Date(),
        }, { tenantId: workspaceId, resourceType: 'workspace', resourceId: workspaceId }));
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
    if (!metadata || !this.isPortalId(data?.portalId)) return;

    const portal = await this.prisma.portal.findFirst({
      where: { id: data.portalId, workspaceId: metadata.workspaceId, deletedAt: null },
    });

    if (!portal) {
      client.emit('error', { message: 'Portal not found or access denied' });
      return;
    }

    await client.join(`portal:${data.portalId}`);
    this.portalTenants.set(data.portalId, metadata.workspaceId);

    await this.updatePresence(metadata.workspaceId, metadata.userId, 'online', data.portalId);

    client.to(`portal:${data.portalId}`).emit('portal:viewer:joined', this.portalEvent(data.portalId, {
      userId: metadata.userId,
      portalId: data.portalId,
      timestamp: new Date(),
    }));

    const viewers = await this.getPortalViewers(data.portalId);
    client.emit('portal:viewers', this.portalEvent(data.portalId, { portalId: data.portalId, viewers }));
  }

  @SubscribeMessage('portal:leave')
  async handleLeavePortal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata || !this.isPortalId(data?.portalId) || !client.rooms.has(`portal:${data.portalId}`)) return;

    await client.leave(`portal:${data.portalId}`);
    await this.updatePresence(metadata.workspaceId, metadata.userId, 'online');

    client.to(`portal:${data.portalId}`).emit('portal:viewer:left', this.portalEvent(data.portalId, {
      userId: metadata.userId,
      portalId: data.portalId,
      timestamp: new Date(),
    }));
  }

  // ============================================
  // WIDGET EVENTS
  // ============================================

  @SubscribeMessage('widget:subscribe')
  async handleWidgetSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { widgetIds: string[] },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata || !Array.isArray(data?.widgetIds) || data.widgetIds.length > 100 ||
      data.widgetIds.some((id) => typeof id !== 'string' || !id || id.length > 128)) {
      client.emit('error', { message: 'Access denied' });
      return;
    }
    const widgets = await this.prisma.widget.findMany({
      where: {
        id: { in: data.widgetIds },
        portal: { workspaceId: metadata.workspaceId, deletedAt: null },
      },
      select: { id: true, portalId: true },
    });
    const allowedIds = widgets.map((widget) => widget.id);
    for (const widget of widgets) this.widgetTenants.set(widget.id, metadata.workspaceId);
    for (const widgetId of allowedIds) {
      await client.join(`widget:${widgetId}`);
    }
    client.emit('widget:subscribed', { widgetIds: allowedIds });
  }

  @SubscribeMessage('widget:unsubscribe')
  async handleWidgetUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { widgetIds: string[] },
  ): Promise<void> {
    if (!Array.isArray(data?.widgetIds) || data.widgetIds.length > 100 ||
      data.widgetIds.some((id) => typeof id !== 'string' || !id || id.length > 128)) return;
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
    if (!metadata || !this.isPortalId(data?.portalId) || !client.rooms.has(`portal:${data.portalId}`)) return;
    metadata.lastActivity = new Date(); // Keep connection alive

    client.to(`portal:${data.portalId}`).emit('cursor:moved', this.portalEvent(data.portalId, {
      userId: metadata.userId,
      portalId: data.portalId,
      x: data.x,
      y: data.y,
      timestamp: Date.now(),
    }));
  }

  @SubscribeMessage('selection:change')
  async handleSelectionChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { portalId: string; widgetId?: string; selection: unknown },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata || !this.isPortalId(data?.portalId) || !client.rooms.has(`portal:${data.portalId}`)) return;
    if (data.widgetId && !(await this.widgetBelongsToPortal(data.widgetId, data.portalId, metadata.workspaceId))) return;

    client.to(`portal:${data.portalId}`).emit('selection:changed', this.portalEvent(data.portalId, {
      userId: metadata.userId,
      ...data,
      timestamp: Date.now(),
    }));
  }

  @SubscribeMessage('comment:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string; widgetId?: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata || !this.isPortalId(data?.portalId) || !client.rooms.has(`portal:${data.portalId}`)) return;
    if (data.widgetId && !(await this.widgetBelongsToPortal(data.widgetId, data.portalId, metadata.workspaceId))) return;

    const user = await this.prisma.user.findUnique({
      where: { id: metadata.userId },
      select: { firstName: true, lastName: true, avatar: true },
    });

    client.to(`portal:${data.portalId}`).emit('comment:user:typing', this.portalEvent(data.portalId, {
      userId: metadata.userId,
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      avatar: user?.avatar,
      portalId: data.portalId,
      widgetId: data.widgetId,
    }));
  }

  @SubscribeMessage('comment:stop-typing')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { portalId: string },
  ): Promise<void> {
    const metadata = this.connections.get(client.id);
    if (!metadata || !this.isPortalId(data?.portalId) || !client.rooms.has(`portal:${data.portalId}`)) return;

    client.to(`portal:${data.portalId}`).emit('comment:user:stopped-typing', this.portalEvent(data.portalId, {
      userId: metadata.userId,
      portalId: data.portalId,
    }));
  }

  // ============================================
  // BROADCAST METHODS (Service-facing)
  // ============================================

  broadcastToWorkspace(workspaceId: string, event: string, data: unknown): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, createRealtimeEvent(
      { ...(data as object), timestamp: new Date() },
      { tenantId: workspaceId, resourceType: 'workspace', resourceId: workspaceId },
    ));
  }

  broadcastToPortal(portalId: string, event: string, data: unknown): void {
    this.server.to(`portal:${portalId}`).emit(event, createRealtimeEvent(
      { ...(data as object), timestamp: new Date() },
      { tenantId: this.portalTenants.get(portalId) ?? (data as any)?.workspaceId ?? (data as any)?.tenantId ?? null, resourceType: 'portal', resourceId: portalId },
    ));
  }

  broadcastToWidget(widgetId: string, event: string, data: unknown): void {
    this.server.to(`widget:${widgetId}`).emit(event, createRealtimeEvent(
      { ...(data as object), timestamp: new Date() },
      { tenantId: this.widgetTenants.get(widgetId) ?? (data as any)?.workspaceId ?? (data as any)?.tenantId ?? null, resourceType: 'widget', resourceId: widgetId },
    ));
  }

  broadcastToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, createRealtimeEvent(
      { ...(data as object), timestamp: new Date() },
      { tenantId: this.userTenants.get(userId) ?? null, resourceType: 'user', resourceId: userId },
    ));
  }

  broadcastToAll(event: string, data: unknown): void {
    this.server.emit(event, createRealtimeEvent(
      { ...(data as object), timestamp: new Date() },
      { tenantId: null, resourceType: 'system', resourceId: 'all' },
    ));
  }

  private isPortalId(portalId: unknown): portalId is string {
    return typeof portalId === 'string' && portalId.length > 0 && portalId.length <= 128;
  }

  private async widgetBelongsToPortal(widgetId: string, portalId: string, workspaceId: string): Promise<boolean> {
    const widget = await this.prisma.widget.findFirst({
      where: { id: widgetId, portalId, portal: { workspaceId, deletedAt: null } },
      select: { id: true },
    });
    return Boolean(widget);
  }

  private portalEvent(portalId: string, data: Record<string, unknown>) {
    return createRealtimeEvent(data, {
      tenantId: this.portalTenants.get(portalId) ?? null,
      resourceType: 'portal', resourceId: portalId,
    });
  }

  private widgetEvent(widgetId: string, data: Record<string, unknown>) {
    return createRealtimeEvent(data, {
      tenantId: this.widgetTenants.get(widgetId) ?? null,
      resourceType: 'widget', resourceId: widgetId,
    });
  }

  emitWidgetUpdate(widgetId: string, data: unknown): void {
    this.broadcastToWidget(widgetId, 'widget:data:updated', { widgetId, data });
  }

  emitPortalLayoutUpdate(portalId: string, layout: unknown): void {
    this.broadcastToPortal(portalId, 'portal:layout:updated', {
      portalId,
      layout,
    });
  }

  emitAlert(workspaceId: string, alert: unknown): void {
    this.broadcastToWorkspace(workspaceId, 'alert:triggered', alert);
  }

  emitInsight(workspaceId: string, insight: unknown): void {
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

    const workspacePresence = this.presence.get(workspaceId);

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
        const presence = this.presence.get(metadata.workspaceId)?.get(metadata.userId);
        if (presence) viewers.push(presence);
      }
    }
    return viewers;
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return readCookieValue(client.handshake.headers.cookie, 'pulse_access') || client.handshake.auth?.token || null;
  }

  private async verifyToken(token: string): Promise<{ userId: string; workspaceId: string }> {
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
        // Remove stale connection metadata - socket.io will handle actual disconnection
        this.logger.debug(`Removing stale connection metadata for socket ${socketId}`);
        this.connections.delete(socketId);

        // Clean up user socket mapping if needed
        for (const [userId, sockets] of this.userSockets) {
          sockets.delete(socketId);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
          }
        }
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
