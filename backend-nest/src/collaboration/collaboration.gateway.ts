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
import { CollaborationService } from './collaboration.service';
import type { ActivityLog, WidgetChange } from './collaboration.service';

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
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  // Track users by portal
  private portalUsers: Map<string, Map<string, UserPresence>> = new Map();

  // Track editing locks
  private editingLocks: Map<
    string,
    { userId: string; userName: string; timestamp: number }
  > = new Map();

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
      const token =
        (authData.token as string | undefined) || authHeader?.split(' ')[1];

      if (!token) {
        this.logger.warn(
          `Client ${client.id} connection rejected: No token provided`,
        );
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

      this.logger.log(
        `Collaboration client connected: ${client.id} (User: ${client.userId})`,
      );

      client.emit('connected', {
        message: 'Successfully connected to collaboration service',
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Client ${client.id} authentication failed`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      // Remove user from all portals they were in
      this.portalUsers.forEach((users, portalId) => {
        if (users.has(client.userId!)) {
          users.delete(client.userId!);
          // Notify others in the portal
          this.server.to(`portal:${portalId}`).emit('user:left', {
            userId: client.userId,
            userName: client.userName,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Release any locks held by this user
      this.editingLocks.forEach((lock, widgetId) => {
        if (lock.userId === client.userId) {
          this.editingLocks.delete(widgetId);
          const portalId = widgetId.split(':')[0];
          this.server.to(`portal:${portalId}`).emit('widget:unlocked', {
            widgetId: widgetId.split(':')[1],
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    this.logger.log(`Collaboration client disconnected: ${client.id}`);
  }

  @SubscribeMessage('portal:join')
  async handleJoinPortal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string },
  ) {
    const { portalId } = data;

    // Verify access to portal
    const hasAccess = await this.collaborationService.verifyPortalAccess(
      client.userId!,
      client.workspaceId!,
      portalId,
    );

    if (!hasAccess) {
      return { success: false, error: 'Access denied to this portal' };
    }

    // Join the portal room
    await client.join(`portal:${portalId}`);

    // Initialize portal users map if needed
    if (!this.portalUsers.has(portalId)) {
      this.portalUsers.set(portalId, new Map());
    }

    // Add user to portal
    const userPresence: UserPresence = {
      userId: client.userId!,
      name: client.userName || 'Anonymous',
      avatar: client.userAvatar,
      lastSeen: new Date(),
      status: 'active',
    };
    this.portalUsers.get(portalId)!.set(client.userId!, userPresence);

    // Get current users in portal
    const currentUsers = Array.from(this.portalUsers.get(portalId)!.values());

    // Notify others that user joined
    client.to(`portal:${portalId}`).emit('user:joined', {
      user: userPresence,
      timestamp: new Date().toISOString(),
    });

    // Log activity
    await this.collaborationService.logActivity({
      portalId,
      userId: client.userId!,
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
    const { portalId } = data;

    await client.leave(`portal:${portalId}`);

    // Remove user from portal
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap) {
      portalUserMap.delete(client.userId!);
    }

    // Notify others
    this.server.to(`portal:${portalId}`).emit('user:left', {
      userId: client.userId,
      userName: client.userName,
      timestamp: new Date().toISOString(),
    });

    // Release any locks
    const lockKey = `${portalId}:*`;
    this.editingLocks.forEach((lock, key) => {
      if (key.startsWith(`${portalId}:`) && lock.userId === client.userId) {
        this.editingLocks.delete(key);
        this.server.to(`portal:${portalId}`).emit('widget:unlocked', {
          widgetId: key.split(':')[1],
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.logger.log(`User ${client.userId} left portal ${portalId}`);

    return { success: true };
  }

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; cursor: CursorPosition },
  ) {
    const { portalId, cursor } = data;

    // Update user presence with cursor
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && portalUserMap.has(client.userId!)) {
      const user = portalUserMap.get(client.userId!)!;
      user.cursor = cursor;
      user.lastSeen = new Date();
      user.status = 'active';
    }

    // Broadcast cursor position to others in portal
    client.to(`portal:${portalId}`).emit('cursor:update', {
      userId: client.userId,
      userName: client.userName,
      avatar: client.userAvatar,
      cursor,
      timestamp: Date.now(),
    });

    return { success: true };
  }

  @SubscribeMessage('widget:lock')
  async handleWidgetLock(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; widgetId: string },
  ) {
    const { portalId, widgetId } = data;
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
      userId: client.userId!,
      userName: client.userName || 'Anonymous',
      timestamp: Date.now(),
    });

    // Notify others
    client.to(`portal:${portalId}`).emit('widget:locked', {
      widgetId,
      lockedBy: {
        userId: client.userId,
        userName: client.userName,
      },
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Widget ${widgetId} locked by user ${client.userId}`);

    return { success: true, widgetId };
  }

  @SubscribeMessage('widget:unlock')
  handleWidgetUnlock(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; widgetId: string },
  ) {
    const { portalId, widgetId } = data;
    const lockKey = `${portalId}:${widgetId}`;

    const lock = this.editingLocks.get(lockKey);
    if (lock && lock.userId === client.userId) {
      this.editingLocks.delete(lockKey);

      // Notify others
      this.server.to(`portal:${portalId}`).emit('widget:unlocked', {
        widgetId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Widget ${widgetId} unlocked by user ${client.userId}`);
    }

    return { success: true };
  }

  @SubscribeMessage('widget:change')
  async handleWidgetChange(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; change: WidgetChange },
  ) {
    const { portalId, change } = data;

    // Add user info to change
    change.userId = client.userId!;
    change.timestamp = Date.now();

    // Apply operational transformation for conflict resolution
    const transformedChange = await this.collaborationService.transformChange(
      portalId,
      change,
    );

    // Broadcast change to others
    client.to(`portal:${portalId}`).emit('widget:changed', {
      change: transformedChange,
      userName: client.userName,
      timestamp: new Date().toISOString(),
    });

    // Save change to history for undo/redo
    await this.collaborationService.saveChangeHistory(
      portalId,
      transformedChange,
    );

    // Log activity
    await this.collaborationService.logActivity({
      portalId,
      userId: client.userId!,
      action: 'widget_edited',
      widgetId: change.widgetId,
      changeType: change.changeType,
      timestamp: new Date(),
    });

    return { success: true, change: transformedChange };
  }

  @SubscribeMessage('presence:update')
  handlePresenceUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      status: 'active' | 'idle' | 'away';
      activeWidgetId?: string;
    },
  ) {
    const { portalId, status, activeWidgetId } = data;

    // Update user presence
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && portalUserMap.has(client.userId!)) {
      const user = portalUserMap.get(client.userId!)!;
      user.status = status;
      user.activeWidgetId = activeWidgetId;
      user.lastSeen = new Date();
    }

    // Broadcast presence update
    client.to(`portal:${portalId}`).emit('presence:changed', {
      userId: client.userId,
      userName: client.userName,
      status,
      activeWidgetId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('activity:feed')
  async handleGetActivityFeed(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { portalId: string; limit?: number },
  ) {
    const { portalId, limit = 50 } = data;

    const activities = await this.collaborationService.getActivityFeed(
      portalId,
      limit,
    );

    return { success: true, activities };
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { portalId: string; message: string; widgetId?: string },
  ) {
    const { portalId, message, widgetId } = data;

    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: client.userId,
      userName: client.userName,
      avatar: client.userAvatar,
      message,
      widgetId,
      timestamp: new Date().toISOString(),
    };

    // Broadcast message to portal
    this.server.to(`portal:${portalId}`).emit('chat:new', chatMessage);

    // Save message
    await this.collaborationService.saveChatMessage(portalId, chatMessage);

    return { success: true, message: chatMessage };
  }

  // WebRTC Signaling for peer-to-peer collaboration
  @SubscribeMessage('webrtc:offer')
  handleWebRTCOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      targetUserId: string;
      offer: RTCSessionDescriptionInit;
    },
  ) {
    const { portalId, targetUserId, offer } = data;

    // Find target user's socket
    const portalUserMap = this.portalUsers.get(portalId);
    if (portalUserMap && portalUserMap.has(targetUserId)) {
      this.server.to(`portal:${portalId}`).emit('webrtc:offer', {
        fromUserId: client.userId,
        fromUserName: client.userName,
        offer,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('webrtc:answer')
  handleWebRTCAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      targetUserId: string;
      answer: RTCSessionDescriptionInit;
    },
  ) {
    const { portalId, targetUserId, answer } = data;

    this.server.to(`portal:${portalId}`).emit('webrtc:answer', {
      fromUserId: client.userId,
      answer,
    });

    return { success: true };
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleWebRTCIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      portalId: string;
      targetUserId: string;
      candidate: RTCIceCandidateInit;
    },
  ) {
    const { portalId, candidate } = data;

    client.to(`portal:${portalId}`).emit('webrtc:ice-candidate', {
      fromUserId: client.userId,
      candidate,
    });

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
    this.server.to(`portal:${portalId}`).emit(event, data);
  }
}
