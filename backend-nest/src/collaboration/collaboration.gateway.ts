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

import { CollaborationService } from './collaboration.service';
import type { WidgetChange } from './collaboration.service';
import { readCookieValue } from '../auth/cookie-token.util';
import { createRealtimeEvent } from '../realtime/realtime-event';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workspaceId?: string;
  userName?: string;
  userAvatar?: string;
}

interface CursorPosition {
  x: number;
  y: number;
  widgetId?: string;
  elementId?: string;
}

export interface UserPresence {
  userId: string;
  name: string;
  avatar?: string;
  cursor?: CursorPosition;
  activeWidgetId?: string;
  lastSeen: Date;
  status: 'active' | 'idle' | 'away';
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/collaboration',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  // Track users by portal
  private portalUsers: Map<string, Map<string, UserPresence>> = new Map();
  private portalTenants = new Map<string, string>();

  // Track editing locks
  private editingLocks: Map<string, { userId: string; userName: string; timestamp: number }> =
    new Map();

  // Operation transformation queue for conflict resolution
  private operationQueues: Map<string, WidgetChange[]> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly collaborationService: CollaborationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authData = client.handshake.auth as any;
      const authHeader = client.handshake.headers.authorization;
      const token = readCookieValue(client.handshake.headers.cookie, 'pulse_access') ||
        (authData.token as string | undefined) || authHeader?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub as string;
      client.workspaceId = payload.workspaceId as string;
      client.userName = payload.firstName
        ? `${payload.firstName} ${payload.lastName || ''}`.trim()
        : payload.email;
      client.userAvatar = payload.avatar;

      this.logger.log(`Collaboration client connected: ${client.id} (User: ${client.userId})`);

      client.emit('connected', createRealtimeEvent({
        message: 'Successfully connected to collaboration service',
        userId: client.userId,
        timestamp: new Date().toISOString(),
      }, { tenantId: client.workspaceId ?? null, resourceType: 'user', resourceId: client.userId ?? client.id }));
    } catch (error) {
      this.logger.error(`Client ${client.id} authentication failed`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      // Remove user from all portals they were in
      for (const [portalId, users] of this.portalUsers) {
        if (users.has(client.userId)) {
          const sockets = await this.server.in(`portal:${portalId}`).fetchSockets();
          if (sockets.some((socket) => socket.id !== client.id && (socket as unknown as AuthenticatedSocket).userId === client.userId)) continue;
          users.delete(client.userId);
          // Notify others in the portal
          this.server.to(`portal:${portalId}`).emit('user:left', this.portalEvent(client, portalId, {
            userId: client.userId,
            userName: client.userName,
            timestamp: new Date().toISOString(),
          }));
        }
      }

      // Release any locks held by this user
      for (const [widgetId, lock] of this.editingLocks) {
        if (lock.userId === client.userId) {
          const portalId = widgetId.split(':')[0];
          const sockets = await this.server.in(`portal:${portalId}`).fetchSockets();
          if (sockets.some((socket) => (socket as unknown as AuthenticatedSocket).userId === client.userId)) continue;
          this.editingLocks.delete(widgetId);
          this.server.to(`portal:${portalId}`).emit('widget:unlocked', this.portalEvent(client, portalId, {
            widgetId: widgetId.split(':')[1],
            timestamp: new Date().toISOString(),
          }));
        }
      }
    }

    this.logger.log(`Collaboration client disconnected: ${client.id}`);
  }

  @SubscribeMessage('portal:join')
  async handleJoinPortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    const portalId = data?.portalId;
    if (!this.isPortalId(portalId) || !client.userId || !client.workspaceId) return { success: false, error: 'Access denied' };

    // Verify access to portal
    const hasAccess = await this.collaborationService.verifyPortalAccess(
      client.userId,
      client.workspaceId,
      portalId,
    );

    if (!hasAccess) {
      return { success: false, error: 'Access denied to this portal' };
    }

    // Join the portal room
    await client.join(`portal:${portalId}`);
    this.portalTenants.set(portalId, client.workspaceId);

    // Initialize portal users map if needed
    if (!this.portalUsers.has(portalId)) {
      this.portalUsers.set(portalId, new Map());
    }

    // Add user to portal
    const userPresence: UserPresence = {
      userId: client.userId,
      name: client.userName || 'Anonymous',
      avatar: client.userAvatar,
      lastSeen: new Date(),
      status: 'active',
    };
    this.portalUsers.get(portalId).set(client.userId, userPresence);

    // Get current users in portal
    const currentUsers = Array.from(this.portalUsers.get(portalId).values());

    // Notify others that user joined
    client.to(`portal:${portalId}`).emit('user:joined', this.portalEvent(client, portalId, {
      user: userPresence,
      timestamp: new Date().toISOString(),
    }));

    // Log activity
    await this.collaborationService.logActivity({
      portalId,
      userId: client.userId,
      action: 'joined',
      timestamp: new Date(),
    });

    this.logger.log(`User ${client.userId} joined portal ${portalId}`);

    return {
      success: true,
      users: currentUsers,
      portalId,
    };
  }

  @SubscribeMessage('portal:leave')
  async handleLeavePortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    const portalId = data?.portalId;
    if (!this.isPortalId(portalId) || !client.userId || !client.rooms.has(`portal:${portalId}`)) return { success: false, error: 'Access denied' };

    await client.leave(`portal:${portalId}`);
    const remainingSockets = await this.server.in(`portal:${portalId}`).fetchSockets();
    const anotherTabStillPresent = remainingSockets.some(
      (socket) => (socket as unknown as AuthenticatedSocket).userId === client.userId,
    );

    // Remove user from portal
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && !anotherTabStillPresent) {
      portalUserMap.delete(client.userId);
    }

    // Notify others
    if (!anotherTabStillPresent) this.server.to(`portal:${portalId}`).emit('user:left', this.portalEvent(client, portalId, {
      userId: client.userId,
      userName: client.userName,
      timestamp: new Date().toISOString(),
    }));

    // Release any locks
    const _lockKey = `${portalId}:*`;
    if (!anotherTabStillPresent) this.editingLocks.forEach((lock, key) => {
      if (key.startsWith(`${portalId}:`) && lock.userId === client.userId) {
        this.editingLocks.delete(key);
        this.server.to(`portal:${portalId}`).emit('widget:unlocked', this.portalEvent(client, portalId, {
          widgetId: key.split(':')[1],
          timestamp: new Date().toISOString(),
        }));
      }
    });

    this.logger.log(`User ${client.userId} left portal ${portalId}`);

    return { success: true };
  }

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; cursor: CursorPosition },
  ) {
    const { portalId, cursor } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId))) return { success: false, error: 'Access denied' };

    // Update user presence with cursor
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && portalUserMap.has(client.userId)) {
      const user = portalUserMap.get(client.userId);
      user.cursor = cursor;
      user.lastSeen = new Date();
      user.status = 'active';
    }

    // Broadcast cursor position to others in portal
    client.to(`portal:${portalId}`).emit('cursor:update', this.portalEvent(client, portalId, {
      userId: client.userId,
      userName: client.userName,
      avatar: client.userAvatar,
      cursor,
      timestamp: Date.now(),
    }));

    return { success: true };
  }

  @SubscribeMessage('widget:lock')
  async handleWidgetLock(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; widgetId: string },
  ) {
    const { portalId, widgetId } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId)) || !this.isPortalId(widgetId)) return { success: false, error: 'Access denied' };
    const lockKey = `${portalId}:${widgetId}`;

    // Check if widget is already locked
    const existingLock = this.editingLocks.get(lockKey);
    if (existingLock && existingLock.userId !== client.userId) {
      // Check if lock is stale (> 30 seconds)
      if (Date.now() - existingLock.timestamp < 30000) {
        return {
          success: false,
          error: 'Widget is being edited by another user',
          lockedBy: existingLock.userName,
        };
      }
    }

    // Acquire lock
    this.editingLocks.set(lockKey, {
      userId: client.userId,
      userName: client.userName || 'Anonymous',
      timestamp: Date.now(),
    });

    // Notify others
    client.to(`portal:${portalId}`).emit('widget:locked', this.portalEvent(client, portalId, {
      widgetId,
      lockedBy: {
        userId: client.userId,
        userName: client.userName,
      },
      timestamp: new Date().toISOString(),
    }));

    this.logger.log(`Widget ${widgetId} locked by user ${client.userId}`);

    return { success: true, widgetId };
  }

  @SubscribeMessage('widget:unlock')
  async handleWidgetUnlock(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; widgetId: string },
  ) {
    const { portalId, widgetId } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId)) || !this.isPortalId(widgetId)) return { success: false, error: 'Access denied' };
    const lockKey = `${portalId}:${widgetId}`;

    const lock = this.editingLocks.get(lockKey);
    if (lock && lock.userId === client.userId) {
      this.editingLocks.delete(lockKey);

      // Notify others
      this.server.to(`portal:${portalId}`).emit('widget:unlocked', this.portalEvent(client, portalId, {
        widgetId,
        timestamp: new Date().toISOString(),
      }));

      this.logger.log(`Widget ${widgetId} unlocked by user ${client.userId}`);
    }

    return { success: true };
  }

  @SubscribeMessage('widget:change')
  async handleWidgetChange(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; change: WidgetChange },
  ) {
    const { portalId, change } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId)) || !change || typeof change.widgetId !== 'string') return { success: false, error: 'Access denied' };
    if (change.operationId !== undefined && !this.isOperationId(change.operationId)) return { success: false, error: 'Invalid operation ID' };
    if (change.operationId && !(await this.collaborationService.claimRealtimeOperation(portalId, client.userId!, change.operationId))) {
      return { success: true, duplicate: true };
    }

    // Add user info to change
    change.userId = client.userId!;
    change.timestamp = Date.now();

    // Apply operational transformation for conflict resolution
    const transformedChange = await this.collaborationService.transformChange(portalId, change);

    // Broadcast change to others
    client.to(`portal:${portalId}`).emit('widget:changed', this.portalEvent(client, portalId, {
      eventId: change.operationId,
      change: transformedChange,
      userName: client.userName,
      timestamp: new Date().toISOString(),
    }));

    // Save change to history for undo/redo
    await this.collaborationService.saveChangeHistory(portalId, transformedChange);

    // Log activity
    await this.collaborationService.logActivity({
      portalId,
      userId: client.userId,
      action: 'widget_edited',
      widgetId: change.widgetId,
      changeType: change.changeType,
      timestamp: new Date(),
    });

    return { success: true, change: transformedChange };
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      status: 'active' | 'idle' | 'away';
      activeWidgetId?: string;
    },
  ) {
    const { portalId, status, activeWidgetId } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId)) || !['active', 'idle', 'away'].includes(status)) return { success: false, error: 'Access denied' };

    // Update user presence
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && portalUserMap.has(client.userId)) {
      const user = portalUserMap.get(client.userId);
      user.status = status;
      user.activeWidgetId = activeWidgetId;
      user.lastSeen = new Date();
    }

    // Broadcast presence update
    client.to(`portal:${portalId}`).emit('presence:changed', this.portalEvent(client, portalId, {
      userId: client.userId,
      userName: client.userName,
      status,
      activeWidgetId,
      timestamp: new Date().toISOString(),
    }));

    return { success: true };
  }

  @SubscribeMessage('activity:feed')
  async handleGetActivityFeed(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; limit?: number },
  ) {
    const { portalId, limit = 50 } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId))) return { success: false, error: 'Access denied' };

    const activities = await this.collaborationService.getActivityFeed(portalId, limit);

    return { success: true, activities };
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { portalId: string; message: string; widgetId?: string; operationId?: string },
  ) {
    const { portalId, message, widgetId } = data ?? ({} as typeof data);
    if (!(await this.hasPortalAccess(client, portalId)) || typeof message !== 'string' || message.length < 1 || message.length > 4000) return { success: false, error: 'Access denied' };
    if (data.operationId !== undefined && !this.isOperationId(data.operationId)) return { success: false, error: 'Invalid operation ID' };
    if (data.operationId && !(await this.collaborationService.claimRealtimeOperation(portalId, client.userId!, data.operationId))) {
      return { success: true, duplicate: true };
    }

    const chatMessage = {
      id: data.operationId ?? `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: client.userId,
      userName: client.userName,
      avatar: client.userAvatar,
      message,
      widgetId,
      timestamp: new Date().toISOString(),
    };

    // Broadcast message to portal
    this.server.to(`portal:${portalId}`).emit('chat:new', this.portalEvent(client, portalId, {
      ...chatMessage,
      eventId: data.operationId,
    }));

    // Save message
    await this.collaborationService.saveChatMessage(portalId, chatMessage);

    return { success: true, message: chatMessage };
  }

  // WebRTC Signaling for peer-to-peer collaboration
  @SubscribeMessage('webrtc:offer')
  async handleWebRTCOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      targetUserId: string;
      offer: RTCSessionDescriptionInit;
    },
  ) {
    const { portalId, targetUserId, offer } = data;
    if (!(await this.hasPortalAccess(client, portalId))) return { success: false, error: 'Access denied' };

    // Find target user's socket
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && portalUserMap.has(targetUserId)) {
      this.server.to(`portal:${portalId}`).emit('webrtc:offer', this.portalEvent(client, portalId, {
        fromUserId: client.userId,
        fromUserName: client.userName,
        offer,
      }));
    }

    return { success: true };
  }

  @SubscribeMessage('webrtc:answer')
  async handleWebRTCAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      targetUserId: string;
      answer: RTCSessionDescriptionInit;
    },
  ) {
    const { portalId, targetUserId: _targetUserId, answer } = data;
    if (!(await this.hasPortalAccess(client, portalId))) return { success: false, error: 'Access denied' };

    this.server.to(`portal:${portalId}`).emit('webrtc:answer', this.portalEvent(client, portalId, {
      fromUserId: client.userId,
      answer,
    }));

    return { success: true };
  }

  @SubscribeMessage('webrtc:ice-candidate')
  async handleWebRTCIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      targetUserId: string;
      candidate: RTCIceCandidateInit;
    },
  ) {
    const { portalId, candidate } = data;
    if (!(await this.hasPortalAccess(client, portalId))) return { success: false, error: 'Access denied' };

    client.to(`portal:${portalId}`).emit('webrtc:ice-candidate', this.portalEvent(client, portalId, {
      fromUserId: client.userId,
      candidate,
    }));

    return { success: true };
  }

  // Helper method to get users in a portal
  getPortalUsers(portalId: string): UserPresence[] {
    const portalUserMap = this.portalUsers.get(portalId);
    if (!portalUserMap) return [];
    return Array.from(portalUserMap.values());
  }

  // Helper method to broadcast to portal
  broadcastToPortal(portalId: string, event: string, data: any): void {
    this.server.to(`portal:${portalId}`).emit(event, createRealtimeEvent(data ?? {}, {
      tenantId: this.portalTenants.get(portalId) ?? null,
      resourceType: 'portal',
      resourceId: portalId,
    }));
  }

  private isPortalId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 128;
  }

  private isOperationId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 128;
  }

  private async hasPortalAccess(client: AuthenticatedSocket, portalId: unknown): Promise<boolean> {
    if (!this.isPortalId(portalId) || !client.userId || !client.workspaceId || !client.rooms.has(`portal:${portalId}`)) return false;
    return this.collaborationService.verifyPortalAccess(client.userId, client.workspaceId, portalId);
  }

  private portalEvent(client: AuthenticatedSocket, portalId: string, data: Record<string, unknown>) {
    return createRealtimeEvent(data, {
      tenantId: client.workspaceId ?? this.portalTenants.get(portalId) ?? null,
      resourceType: 'portal',
      resourceId: portalId,
    });
  }
}
