import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EmailService } from '../email/email.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a comment
   */
  async create(workspaceId: string, userId: string, dto: CreateCommentDto) {
    // Verify portal exists and user has access
    const portal = await this.prisma.portal.findFirst({
      where: { id: dto.portalId, workspaceId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // If widget specified, verify it exists
    if (dto.widgetId) {
      const widget = await this.prisma.widget.findFirst({
        where: { id: dto.widgetId, portalId: dto.portalId },
      });
      if (!widget) {
        throw new NotFoundException('Widget not found');
      }
    }

    // If parent comment specified, verify it exists
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, portalId: dto.portalId },
      });
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Extract mentions from content
    const mentions = this.extractMentions(dto.content);

    const comment = await this.prisma.comment.create({
      data: {
        portalId: dto.portalId,
        widgetId: dto.widgetId,
        authorId: userId,
        content: dto.content,
        mentions,
        parentId: dto.parentId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        replies: {
          take: 0, // New comment has no replies
        },
      },
    });

    this.logger.log(`Comment created: ${comment.id}`);

    // Send WebSocket notification for real-time updates
    this.notificationsGateway.notifyPortal(dto.portalId, 'comment:created', {
      comment,
      portalId: dto.portalId,
      widgetId: dto.widgetId,
    });

    // Send notifications to mentioned users
    if (mentions.length > 0) {
      await this.notifyMentionedUsers(comment, mentions);
    }

    // Notify parent comment author if this is a reply
    if (dto.parentId) {
      await this.notifyCommentReply(comment, dto.parentId);
    }

    return comment;
  }

  /**
   * Notify users mentioned in a comment
   */
  private async notifyMentionedUsers(comment: any, userIds: string[]): Promise<void> {
    try {
      const mentionedUsers = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      const portal = await this.prisma.portal.findUnique({
        where: { id: comment.portalId },
        select: { name: true },
      });

      for (const user of mentionedUsers) {
        // Send WebSocket notification
        this.notificationsGateway.notifyUser(user.id, 'comment:mentioned', {
          commentId: comment.id,
          portalId: comment.portalId,
          author: comment.author,
          content: comment.content.substring(0, 100),
        });

        // Send email notification
        try {
          await this.emailService.sendEmail({
            to: user.email,
            subject: `You were mentioned in a comment on ${portal?.name || 'a portal'}`,
            template: 'comment-mention',
            context: {
              recipientName: user.firstName || user.email.split('@')[0],
              authorName:
                comment.author?.firstName || comment.author?.email?.split('@')[0] || 'Someone',
              portalName: portal?.name || 'a portal',
              commentContent: comment.content.substring(0, 200),
              commentUrl: `${process.env.FRONTEND_URL}/portal/${comment.portalId}#comment-${comment.id}`,
            },
          });
        } catch (emailError) {
          this.logger.error(`Failed to send mention email to ${user.email}:`, emailError);
        }
      }
    } catch (error) {
      this.logger.error('Failed to notify mentioned users:', error);
    }
  }

  /**
   * Notify parent comment author of reply
   */
  private async notifyCommentReply(comment: any, parentId: string): Promise<void> {
    try {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
        include: {
          author: { select: { id: true, email: true, firstName: true } },
        },
      });

      if (!parentComment || parentComment.authorId === comment.authorId) {
        return; // Don't notify if replying to own comment
      }

      const portal = await this.prisma.portal.findUnique({
        where: { id: comment.portalId },
        select: { name: true },
      });

      // Send WebSocket notification
      this.notificationsGateway.notifyUser(parentComment.authorId, 'comment:reply', {
        commentId: comment.id,
        parentId,
        portalId: comment.portalId,
        author: comment.author,
      });

      // Send email notification
      await this.emailService.sendEmail({
        to: parentComment.author.email,
        subject: `New reply to your comment on ${portal?.name || 'a portal'}`,
        template: 'comment-reply',
        context: {
          recipientName: parentComment.author.firstName || parentComment.author.email.split('@')[0],
          authorName:
            comment.author?.firstName || comment.author?.email?.split('@')[0] || 'Someone',
          portalName: portal?.name || 'a portal',
          originalComment: parentComment.content.substring(0, 100),
          replyContent: comment.content.substring(0, 200),
          commentUrl: `${process.env.FRONTEND_URL}/portal/${comment.portalId}#comment-${comment.id}`,
        },
      });
    } catch (error) {
      this.logger.error('Failed to notify reply:', error);
    }
  }

  /**
   * Get comments for a portal
   */
  async findByPortal(
    portalId: string,
    workspaceId: string,
    options?: {
      widgetId?: string;
      includeReplies?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    // Verify portal access
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    const { widgetId, includeReplies = true, limit = 50, offset = 0 } = options || {};

    // Get top-level comments (no parent)
    const comments = await this.prisma.comment.findMany({
      where: {
        portalId,
        parentId: null, // Only top-level
        isDeleted: false,
        ...(widgetId && { widgetId }),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        ...(includeReplies && {
          replies: {
            where: { isDeleted: false },
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        }),
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.comment.count({
      where: {
        portalId,
        parentId: null,
        isDeleted: false,
        ...(widgetId && { widgetId }),
      },
    });

    return {
      comments,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a single comment with replies
   */
  async findOne(id: string, workspaceId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        replies: {
          where: { isDeleted: false },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Verify workspace access via portal
    const portal = await this.prisma.portal.findFirst({
      where: { id: comment.portalId, workspaceId },
    });

    if (!portal) {
      throw new ForbiddenException('Access denied');
    }

    return comment;
  }

  /**
   * Update a comment
   */
  async update(id: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findFirst({
      where: { id, isDeleted: false },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only author can edit
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // Extract new mentions
    const mentions = this.extractMentions(dto.content);

    const updated = await this.prisma.comment.update({
      where: { id },
      data: {
        content: dto.content,
        mentions,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`Comment updated: ${id}`);
    return updated;
  }

  /**
   * Delete a comment (soft delete)
   */
  async delete(id: string, userId: string, workspaceId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id, isDeleted: false },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user is author or workspace admin
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
    });

    if (comment.authorId !== userId && user?.role !== 'OWNER' && user?.role !== 'ADMIN') {
      throw new ForbiddenException('You cannot delete this comment');
    }

    await this.prisma.comment.update({
      where: { id },
      data: { isDeleted: true },
    });

    this.logger.log(`Comment deleted: ${id}`);
    return { message: 'Comment deleted successfully' };
  }

  /**
   * Get comment thread (all replies to a comment)
   */
  async getThread(id: string, workspaceId: string) {
    const comment = await this.findOne(id, workspaceId);

    // Get all nested replies recursively
    const replies = await this.getNestedReplies(id);

    return {
      ...comment,
      allReplies: replies,
    };
  }

  /**
   * Get replies count for multiple comments
   */
  async getRepliesCounts(commentIds: string[]) {
    const counts = await this.prisma.comment.groupBy({
      by: ['parentId'],
      where: {
        parentId: { in: commentIds },
        isDeleted: false,
      },
      _count: true,
    });

    return counts.reduce(
      (acc, item) => {
        if (item.parentId) {
          acc[item.parentId] = item._count;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Extract @mentions from content
   */
  private extractMentions(content: string): string[] {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[2]); // User ID from mention
    }

    return mentions;
  }

  /**
   * Get nested replies recursively
   */
  private async getNestedReplies(parentId: string): Promise<any[]> {
    const replies = await this.prisma.comment.findMany({
      where: {
        parentId,
        isDeleted: false,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Recursively get replies for each reply
    const nestedReplies = await Promise.all(
      replies.map(async (reply) => {
        const childReplies = await this.getNestedReplies(reply.id);
        return {
          ...reply,
          replies: childReplies,
        };
      }),
    );

    return nestedReplies;
  }
}
