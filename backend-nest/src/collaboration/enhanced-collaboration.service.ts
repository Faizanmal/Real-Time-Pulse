/**
 * Enhanced Collaboration Service
 * Provides real-time co-editing, presence, and commenting features
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { v4 as uuidv4 } from 'uuid';

interface UserPresence {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { widgetId: string; elementId?: string };
  lastSeen: Date;
  isActive: boolean;
}

interface CollaborationSession {
  id: string;
  portalId: string;
  activeUsers: UserPresence[];
  lockedElements: Record<string, string>; // elementId -> userId
  createdAt: Date;
}

interface EditOperation {
  id: string;
  type: 'insert' | 'delete' | 'update' | 'move';
  target: { type: 'widget' | 'element'; id: string };
  data: any;
  userId: string;
  workspaceId: string;
  timestamp: Date;
  version: number;
}

interface Comment {
  id: string;
  portalId: string;
  widgetId?: string;
  position?: { x: number; y: number };
  content: string;
  authorId: string;
  author?: { name: string; avatar?: string };
  parentId?: string;
  replies?: Comment[];
  mentions: string[];
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EnhancedCollaborationService {
  private sessions: Map<string, CollaborationSession> = new Map();
  private operationBuffers: Map<string, EditOperation[]> = new Map();
  private userColors: string[] = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ==================== PRESENCE MANAGEMENT ====================

  /**
   * Join a collaboration session
   */
  async joinSession(
    portalId: string,
    userId: string,
  ): Promise<{ session: CollaborationSession; userPresence: UserPresence }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    let session = this.sessions.get(portalId);

    if (!session) {
      session = {
        id: uuidv4(),
        portalId,
        activeUsers: [],
        lockedElements: {},
        createdAt: new Date(),
      };
      this.sessions.set(portalId, session);
    }

    // Check if user already in session
    const existingUser = session.activeUsers.find((u) => u.id === userId);
    if (existingUser) {
      existingUser.lastSeen = new Date();
      existingUser.isActive = true;
      return { session, userPresence: existingUser };
    }

    // Assign color
    const usedColors = session.activeUsers.map((u) => u.color);
    const availableColor =
      this.userColors.find((c) => !usedColors.includes(c)) || this.userColors[0];

    const userPresence: UserPresence = {
      id: user.id,
      name: user.name || 'Anonymous',
      avatar: user.avatar || undefined,
      color: availableColor,
      lastSeen: new Date(),
      isActive: true,
    };

    session.activeUsers.push(userPresence);

    // Cache session state
    await this.cache.set(`session:${portalId}`, JSON.stringify(session), 3600);

    return { session, userPresence };
  }

  /**
   * Update user cursor position
   */
  async updateCursor(
    portalId: string,
    userId: string,
    position: { x: number; y: number },
  ): Promise<void> {
    const session = this.sessions.get(portalId);
    if (!session) return;

    const user = session.activeUsers.find((u) => u.id === userId);
    if (user) {
      user.cursor = position;
      user.lastSeen = new Date();
    }
  }

  /**
   * Update user selection
   */
  async updateSelection(
    portalId: string,
    userId: string,
    selection: { widgetId: string; elementId?: string } | null,
  ): Promise<void> {
    const session = this.sessions.get(portalId);
    if (!session) return;

    const user = session.activeUsers.find((u) => u.id === userId);
    if (user) {
      user.selection = selection || undefined;
      user.lastSeen = new Date();
    }
  }

  /**
   * Leave collaboration session
   */
  async leaveSession(portalId: string, userId: string): Promise<void> {
    const session = this.sessions.get(portalId);
    if (!session) return;

    // Remove user from active users
    session.activeUsers = session.activeUsers.filter((u) => u.id !== userId);

    // Release any locks held by user
    for (const [elementId, lockUserId] of Object.entries(session.lockedElements)) {
      if (lockUserId === userId) {
        delete session.lockedElements[elementId];
      }
    }

    // Clean up empty sessions
    if (session.activeUsers.length === 0) {
      this.sessions.delete(portalId);
      await this.cache.del(`session:${portalId}`);
    }
  }

  /**
   * Get current session state
   */
  getSession(portalId: string): CollaborationSession | undefined {
    return this.sessions.get(portalId);
  }

  // ==================== ELEMENT LOCKING ====================

  /**
   * Lock an element for editing
   */
  async lockElement(
    portalId: string,
    elementId: string,
    userId: string,
  ): Promise<{ success: boolean; lockedBy?: string }> {
    const session = this.sessions.get(portalId);
    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const currentLock = session.lockedElements[elementId];
    if (currentLock && currentLock !== userId) {
      const lockUser = session.activeUsers.find((u) => u.id === currentLock);
      return { success: false, lockedBy: lockUser?.name || currentLock };
    }

    session.lockedElements[elementId] = userId;
    return { success: true };
  }

  /**
   * Unlock an element
   */
  async unlockElement(portalId: string, elementId: string, userId: string): Promise<void> {
    const session = this.sessions.get(portalId);
    if (!session) return;

    if (session.lockedElements[elementId] === userId) {
      delete session.lockedElements[elementId];
    }
  }

  // ==================== OPERATIONAL TRANSFORMATION ====================

  /**
   * Apply an edit operation
   */
  async applyOperation(
    portalId: string,
    operation: Omit<EditOperation, 'id' | 'timestamp' | 'version'>,
  ): Promise<EditOperation> {
    const buffer = this.operationBuffers.get(portalId) || [];
    const version = buffer.length + 1;

    const fullOperation: EditOperation = {
      ...operation,
      id: uuidv4(),
      timestamp: new Date(),
      version,
    };

    buffer.push(fullOperation);
    this.operationBuffers.set(portalId, buffer);

    // Persist operation
    await this.prisma.operationLog.create({
      data: {
        workspaceId: fullOperation.workspaceId,
        userId: fullOperation.userId,
        operation: fullOperation.type,
        entityType: fullOperation.target.type,
        entityId: fullOperation.target.id,
        changes: fullOperation.data,
        metadata: { version: fullOperation.version },
        createdAt: fullOperation.timestamp,
      },
    });

    return fullOperation;
  }

  /**
   * Get operations since a version
   */
  async getOperationsSince(portalId: string, sinceVersion: number): Promise<EditOperation[]> {
    const buffer = this.operationBuffers.get(portalId) || [];
    return buffer.filter((op) => op.version > sinceVersion);
  }

  // ==================== COMMENTS & ANNOTATIONS ====================

  /**
   * Create a comment
   */
  async createComment(
    portalId: string,
    userId: string,
    data: {
      widgetId?: string;
      position?: { x: number; y: number };
      content: string;
      parentId?: string;
    },
  ): Promise<Comment> {
    // Extract mentions
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(data.content)) !== null) {
      mentions.push(match[2]); // User ID
    }

    const comment = await this.prisma.comment.create({
      data: {
        id: uuidv4(),
        portalId,
        widgetId: data.widgetId,
        positionX: data.position?.x,
        positionY: data.position?.y,
        content: data.content,
        authorId: userId,
        parentId: data.parentId,
        mentions,
        resolved: false,
      },
      include: {
        author: { select: { name: true, avatar: true } },
      },
    });

    // Notify mentioned users
    if (mentions.length > 0) {
      await this.notifyMentions(comment as any, mentions);
    }

    return this.formatComment(comment);
  }

  /**
   * Get comments for a portal
   */
  async getComments(
    portalId: string,
    options?: { widgetId?: string; includeResolved?: boolean },
  ): Promise<Comment[]> {
    const where: any = { portalId, parentId: null };

    if (options?.widgetId) {
      where.widgetId = options.widgetId;
    }

    if (!options?.includeResolved) {
      where.resolved = false;
    }

    const comments = await this.prisma.comment.findMany({
      where,
      include: {
        author: { select: { name: true, avatar: true } },
        replies: {
          include: { author: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map(this.formatComment);
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, userId: string, content: string): Promise<Comment> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, authorId: userId },
    });

    if (!comment) {
      throw new BadRequestException('Comment not found or not authorized');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content, updatedAt: new Date() },
      include: { author: { select: { name: true, avatar: true } } },
    });

    return this.formatComment(updated);
  }

  /**
   * Resolve a comment thread
   */
  async resolveComment(commentId: string, userId: string): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { resolved: true, resolvedById: userId, resolvedAt: new Date() },
    });
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, authorId: userId },
    });

    if (!comment) {
      throw new BadRequestException('Comment not found or not authorized');
    }

    // Delete replies first
    await this.prisma.comment.deleteMany({ where: { parentId: commentId } });
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  /**
   * Add reaction to comment
   */
  async addReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    await this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, type: emoji },
      update: { type: emoji },
    });
  }

  /**
   * Remove reaction from comment
   */
  async removeReaction(commentId: string, userId: string, _emoji: string): Promise<void> {
    await this.prisma.commentReaction.delete({
      where: { commentId_userId: { commentId, userId } },
    });
  }

  // ==================== TEAM WORKSPACES ====================

  /**
   * Create team workspace
   */
  async createTeamWorkspace(name: string, ownerId: string, _settings?: any): Promise<any> {
    const workspace = await this.prisma.workspace.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      },
    });

    // Create workspace member for owner
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: ownerId,
        role: 'ADMIN',
      },
    });

    return workspace;
  }

  /**
   * Invite user to workspace
   */
  async inviteToWorkspace(
    workspaceId: string,
    inviterId: string,
    email: string,
    role: 'admin' | 'editor' | 'viewer',
  ): Promise<any> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new BadRequestException('Workspace not found');
    }

    const roleMap = {
      admin: 'ADMIN',
      editor: 'MEMBER',
      viewer: 'MEMBER',
    } as const;

    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        invitedById: inviterId,
        email,
        role: roleMap[role] as any,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return invite;
  }

  /**
   * Accept workspace invitation
   */
  async acceptInvite(token: string, userId: string): Promise<void> {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: { token, expiresAt: { gt: new Date() }, acceptedAt: null },
    });

    if (!invite) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const memberRoleMap = {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'EDITOR', // Default to EDITOR for MEMBER
    } as const;

    await this.prisma.$transaction([
      this.prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: memberRoleMap[invite.role] as any,
          joinedAt: new Date(),
        },
      }),
      this.prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: userId },
      }),
    ]);
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: 'admin' | 'editor' | 'viewer',
  ): Promise<void> {
    const memberRoleMap = {
      admin: 'ADMIN',
      editor: 'EDITOR',
      viewer: 'VIEWER',
    } as const;

    await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
      data: { role: memberRoleMap[role] as any },
    });
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
    });
  }

  /**
   * Get workspace members
   */
  async getWorkspaceMembers(workspaceId: string): Promise<any[]> {
    return await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
  }

  // ==================== HELPER METHODS ====================

  private formatComment(comment: any): Comment {
    return {
      id: comment.id,
      portalId: comment.portalId,
      widgetId: comment.widgetId,
      position: comment.positionX ? { x: comment.positionX, y: comment.positionY } : undefined,
      content: comment.content,
      authorId: comment.authorId,
      author: comment.author,
      parentId: comment.parentId,
      replies: comment.replies?.map((r: any) => this.formatComment(r)),
      mentions: comment.mentions || [],
      resolved: comment.resolved,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private async notifyMentions(comment: Comment, userIds: string[]): Promise<void> {
    // Implementation would send notifications via NotificationService
    this.logger.log(`Notifying users ${userIds.join(', ')} of mention in comment ${comment.id}`);
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(): Promise<void> {
    const inactiveThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    for (const [portalId, session] of this.sessions) {
      session.activeUsers = session.activeUsers.filter((u) => u.lastSeen > inactiveThreshold);

      if (session.activeUsers.length === 0) {
        this.sessions.delete(portalId);
        await this.cache.del(`session:${portalId}`);
      }
    }
  }
}
