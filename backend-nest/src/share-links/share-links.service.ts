import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';
import { OnboardingFunnelStage } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';

import { CacheService } from '../cache/cache.service';
import { DemoConnectorService } from '../integrations/services/demo-connector.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricProvenanceService } from '../analytics/metric-provenance.service';
import { ValueLedgerService } from '../analytics/value-ledger.service';
import { OnboardingFunnelService } from '../analytics/onboarding-funnel.service';
import { readPublishedPortalSnapshot } from '../portals/portal-snapshot';
import { summarizeClientFeedStatus } from '../portals/client-portal-status';

import { CreateShareLinkDto, UpdateShareLinkDto } from './dto/share-link.dto';

export interface AccessLog {
  timestamp: Date;
  outcome: 'allowed' | 'denied';
  reason?:
    | 'password_required'
    | 'password_rejected'
    | 'expired'
    | 'inactive'
    | 'view_limit'
    | 'portal_revoked';
  visitorHash?: string;
  referrerOrigin?: string;
}

export interface ShareLinkAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  viewsByDay: { date: string; views: number }[];
  viewsByCountry: { country: string; views: number }[];
  topReferrers: { referrer: string; count: number }[];
  averageViewDuration?: number;
}

@Injectable()
export class ShareLinksService {
  private readonly logger = new Logger(ShareLinksService.name);
  private readonly ACCESS_LOG_PREFIX = 'sharelink:access:v2:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @Optional() private readonly demoConnectorService?: DemoConnectorService,
    @Optional() private readonly metricProvenance?: MetricProvenanceService,
    @Optional() private readonly valueLedger?: ValueLedgerService,
    @Optional() private readonly onboardingFunnel?: OnboardingFunnelService,
  ) {}

  /**
   * Create a share link for a portal
   */
  async create(workspaceId: string, userId: string, dto: CreateShareLinkDto) {
    await this.verifyShareManager(workspaceId, userId);
    // Verify portal exists and belongs to workspace
    const portal = await this.prisma.portal.findFirst({
      where: { id: dto.portalId, workspaceId, deletedAt: null },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    const assignments = await this.validateClientAssignees(workspaceId, dto.clientUserIds);
    if (dto.allowDecisions && assignments.length === 0) {
      throw new BadRequestException('Decision replies require an assigned client account');
    }
    if (assignments.length && portal.isPublic) {
      throw new BadRequestException('Set the portal to private before creating a client-only link');
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    const shareLink = await this.prisma.shareLink.create({
      data: {
        portalId: dto.portalId,
        token: uuidv4(),
        password: hashedPassword,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxViews: dto.maxViews,
        allowExport: dto.allowExport ?? false,
        allowComments: dto.allowComments ?? false,
        allowDecisions: dto.allowDecisions ?? false,
        isActive: dto.isActive ?? true,
        createdById: userId,
        ...(assignments.length > 0 && {
          assignments: { create: assignments.map((userId) => ({ userId })) },
        }),
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        assignments: { select: { userId: true, user: { select: { email: true } } } },
      },
    });

    this.logger.log(`Share link created: ${shareLink.id} for portal ${dto.portalId}`);

    const { password: _passwordHash, ...safeShareLink } = shareLink;
    return {
      ...safeShareLink,
      hasPassword: !!shareLink.password,
      shareUrl: this.generateShareUrl(shareLink.token),
    };
  }

  /**
   * Get all share links for a workspace
   */
  async findAll(workspaceId: string, userId: string, portalId?: string) {
    await this.verifyShareManager(workspaceId, userId);
    const links = await this.prisma.shareLink.findMany({
      where: {
        portal: { workspaceId, deletedAt: null },
        ...(portalId && { portalId }),
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        assignments: { select: { userId: true, user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      ...link,
      shareUrl: this.generateShareUrl(link.token),
      hasPassword: !!link.password,
      password: undefined, // Don't expose password hash
    }));
  }

  /**
   * Get a single share link
   */
  async findOne(id: string, workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId, deletedAt: null },
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        assignments: { select: { userId: true, user: { select: { email: true } } } },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    return {
      ...link,
      shareUrl: this.generateShareUrl(link.token),
      hasPassword: !!link.password,
      password: undefined,
    };
  }

  async listManagedComments(id: string, workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    const link = await this.prisma.shareLink.findFirst({
      where: { id, portal: { workspaceId, deletedAt: null } },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Share link not found');
    return this.prisma.sharedPortalComment.findMany({
      where: { shareLinkId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayName: true, content: true, createdAt: true },
    });
  }

  async deleteManagedComment(id: string, commentId: string, workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    const comment = await this.prisma.sharedPortalComment.findFirst({
      where: {
        id: commentId,
        shareLinkId: id,
        shareLink: { portal: { workspaceId, deletedAt: null } },
      },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.sharedPortalComment.delete({ where: { id: comment.id } });
    return { deleted: true };
  }

  /**
   * Update a share link
   */
  async update(id: string, workspaceId: string, userId: string, dto: UpdateShareLinkDto) {
    await this.verifyShareManager(workspaceId, userId);
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId, deletedAt: null },
      },
      include: { assignments: { select: { userId: true } } },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const nextAssignees = dto.clientUserIds ?? link.assignments.map(({ userId }) => userId);
    if ((dto.allowDecisions ?? link.allowDecisions) && nextAssignees.length === 0) {
      throw new BadRequestException('Decision replies require an assigned client account');
    }

    if (dto.clientUserIds?.length) {
      const portal = await this.prisma.portal.findFirst({
        where: { id: link.portalId, workspaceId, deletedAt: null },
        select: { isPublic: true },
      });
      if (portal?.isPublic)
        throw new BadRequestException(
          'Set the portal to private before assigning client-only access',
        );
    }

    // Handle password update
    let password = link.password;
    if (dto.password !== undefined) {
      password = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    }

    const updated = await this.prisma.shareLink.update({
      where: { id },
      data: {
        password,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        maxViews: dto.maxViews,
        allowExport: dto.allowExport,
        allowComments: dto.allowComments,
        allowDecisions: dto.allowDecisions,
        isActive: dto.isActive,
        ...(dto.clientUserIds !== undefined && {
          assignments: {
            deleteMany: {},
            create: (await this.validateClientAssignees(workspaceId, dto.clientUserIds)).map(
              (userId) => ({ userId }),
            ),
          },
        }),
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
    await this.cacheService.invalidatePortal(link.portalId);

    return {
      ...updated,
      shareUrl: this.generateShareUrl(updated.token),
      hasPassword: !!updated.password,
      password: undefined,
    };
  }

  /**
   * Delete a share link
   */
  async delete(id: string, workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId, deletedAt: null },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    await this.prisma.shareLink.delete({ where: { id } });
    await this.cacheService.invalidatePortal(link.portalId);
    this.logger.log(`Share link deleted: ${id}`);
    return { message: 'Share link deleted successfully' };
  }

  /**
   * Regenerate share link token
   */
  async regenerateToken(id: string, workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId, deletedAt: null },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const newToken = uuidv4();
    await this.prisma.shareLink.update({
      where: { id },
      data: {
        token: newToken,
        currentViews: 0, // Reset view count
      },
    });
    await this.cacheService.invalidatePortal(link.portalId);

    return {
      token: newToken,
      shareUrl: this.generateShareUrl(newToken),
    };
  }

  /**
   * Access a shared portal (public endpoint)
   */
  async accessSharedPortal(
    token: string,
    password?: string,
    requestMetadata?: { ip?: string; referrer?: string },
    userId?: string,
  ) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        portal: {
          include: {
            widgets: {
              select: {
                id: true,
                name: true,
                type: true,
                order: true,
                integration: {
                  select: {
                    id: true,
                    provider: true,
                    lastSyncedAt: true,
                    lastValidDataAt: true,
                    connectionState: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
            workspace: {
              select: { name: true, logo: true, primaryColor: true },
            },
          },
        },
        assignments: {
          select: { userId: true, user: { select: { workspaceId: true, role: true } } },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found or expired');
    }

    this.assertAssignedClient(link.assignments, userId, link.portal.workspaceId);

    // Check if active
    if (!link.isActive) {
      await this.logAccess(token, { outcome: 'denied', reason: 'inactive', ...requestMetadata });
      throw new ForbiddenException('This share link has been deactivated');
    }

    if (link.portal.deletedAt) {
      await this.logAccess(token, {
        outcome: 'denied',
        reason: 'portal_revoked',
        ...requestMetadata,
      });
      throw new NotFoundException('Share link not found or expired');
    }

    const snapshot = readPublishedPortalSnapshot(link.portal.publishedSnapshot);
    if (link.portal.draftMode && !snapshot) {
      throw new NotFoundException('Portal has not been published');
    }

    // Check expiration
    if (link.expiresAt && link.expiresAt <= new Date()) {
      await this.logAccess(token, { outcome: 'denied', reason: 'expired', ...requestMetadata });
      throw new ForbiddenException('This share link has expired');
    }

    // Check view limit
    if (link.maxViews && link.currentViews >= link.maxViews) {
      await this.logAccess(token, { outcome: 'denied', reason: 'view_limit', ...requestMetadata });
      throw new ForbiddenException('This share link has reached its view limit');
    }

    // Check password
    if (link.password) {
      if (!password) {
        await this.logAccess(token, {
          outcome: 'denied',
          reason: 'password_required',
          ...requestMetadata,
        });
        throw new BadRequestException('Password required');
      }
      const isValid = await bcrypt.compare(password, link.password);
      if (!isValid) {
        await this.logAccess(token, {
          outcome: 'denied',
          reason: 'password_rejected',
          ...requestMetadata,
        });
        throw new ForbiddenException('Invalid password');
      }
    }

    // Atomically consume a view only after validation, so concurrent requests cannot exceed maxViews.
    const now = new Date();
    const consumed = await this.prisma.shareLink.updateMany({
      where: {
        id: link.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(link.maxViews ? { currentViews: { lt: link.maxViews } } : {}),
        portal: { deletedAt: null },
      },
      data: { currentViews: { increment: 1 }, lastAccessedAt: now },
    });
    if (consumed.count !== 1) {
      const latest = await this.prisma.shareLink.findUnique({
        where: { id: link.id },
        select: { isActive: true, expiresAt: true, maxViews: true, currentViews: true },
      });
      if (!latest?.isActive) throw new ForbiddenException('This share link has been deactivated');
      if (latest?.expiresAt && latest.expiresAt <= now)
        throw new ForbiddenException('This share link has expired');
      throw new ForbiddenException('This share link has reached its view limit');
    }
    await this.logAccess(token, { outcome: 'allowed', ...requestMetadata });
    try {
      await this.onboardingFunnel?.recordStage(link.portal.workspaceId, OnboardingFunnelStage.FIRST_CLIENT_VIEW);
    } catch {
      // Share access must not fail because optional telemetry is unavailable.
    }

    // Return portal data
    const sourceWidgets =
      snapshot?.widgets ??
      link.portal.widgets.map((widget) => ({
        id: widget.id,
        name: widget.name,
        type: widget.type,
        provider: widget.integration?.provider ?? null,
        layout: undefined,
      }));
    const widgets = await Promise.all(
      sourceWidgets.map(async (widget) => {
        const isDemo = widget.provider === 'DEMO';
        return {
          id: widget.id,
          name: widget.name,
          type: widget.type,
          data:
            isDemo && this.demoConnectorService
              ? (this.demoConnectorService.fetchData('metrics') as Record<string, unknown>)
              : null,
          sourceLabel: isDemo ? 'Fictional local sample data' : 'No public sample data configured',
          isDemo,
          layout: widget.layout,
        };
      }),
    );
    const metrics =
      snapshot?.metrics ??
      (this.metricProvenance ? await this.metricProvenance.publicMetrics(link.portal.id) : []);
    const valueClaims =
      snapshot?.valueClaims ??
      (this.valueLedger ? await this.valueLedger.publicClaims(link.portal.id) : []);
    const visibleWidgetIds = new Set(sourceWidgets.map((widget) => widget.id));
    const feedStatus = summarizeClientFeedStatus([
      ...link.portal.widgets
        .filter((widget) => visibleWidgetIds.has(widget.id) && widget.integration)
        .map((widget) => ({
          lastSyncedAt: widget.integration?.lastSyncedAt,
          lastValidDataAt: widget.integration?.lastValidDataAt,
          connectionState: widget.integration?.connectionState,
        })),
      ...metrics.map((metric: Record<string, any>) => ({
        sourceFreshnessAt: metric.sourceFreshnessAt,
        health: metric.health,
      })),
    ]);
    return {
      portal: {
        id: link.portal.id,
        name: snapshot?.name ?? link.portal.name,
        description: snapshot?.description ?? link.portal.description,
        widgets,
        metrics,
        valueClaims,
        clientStatus: snapshot
          ? (snapshot.clientStatus ?? null)
          : (link.portal.clientStatus ?? null),
        clientStatusNote: snapshot
          ? (snapshot.clientStatusNote ?? null)
          : (link.portal.clientStatusNote ?? null),
        latestDeliverable: snapshot
          ? (snapshot.latestDeliverable ?? null)
          : (link.portal.latestDeliverable ?? null),
        pendingDecision: snapshot
          ? (snapshot.pendingDecision ?? null)
          : (link.portal.pendingDecision ?? null),
        clientUpdateAt: snapshot
          ? (snapshot.clientUpdateAt ?? null)
          : (link.portal.clientUpdateAt?.toISOString() ?? null),
        feedStatus,
        workspace: {
          name: snapshot?.workspaceName ?? link.portal.workspace.name,
          logo: link.portal.workspace.logo,
          primaryColor: snapshot?.primaryColor ?? link.portal.workspace.primaryColor,
        },
      },
      permissions: {
        allowExport: link.allowExport,
        allowComments: link.allowComments,
        allowDecisions: link.allowDecisions,
      },
    };
  }

  /**
   * Check if password is required for a share link
   */
  async checkPasswordRequired(token: string, userId?: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      select: {
        password: true,
        isActive: true,
        expiresAt: true,
        maxViews: true,
        currentViews: true,
        portal: { select: { deletedAt: true, workspaceId: true } },
        assignments: {
          select: { userId: true, user: { select: { workspaceId: true, role: true } } },
        },
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Share link not found or inactive');
    }
    this.assertAssignedClient(link.assignments, userId, link.portal.workspaceId);

    if (link.expiresAt && link.expiresAt <= new Date()) {
      throw new ForbiddenException('This share link has expired');
    }
    if (link.portal.deletedAt) throw new NotFoundException('Share link not found or inactive');
    if (link.maxViews && link.currentViews >= link.maxViews) {
      throw new ForbiddenException('This share link has reached its view limit');
    }

    return {
      passwordRequired: !!link.password,
    };
  }

  /** Revalidate each bearer-link operation against current durable state. */
  private async requireCapability(
    token: string,
    password: string | undefined,
    permission: 'allowExport' | 'allowComments' | 'allowDecisions',
    userId?: string,
  ) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        portal: { select: { id: true, workspaceId: true, deletedAt: true } },
        assignments: {
          select: { userId: true, user: { select: { workspaceId: true, role: true } } },
        },
      },
    });
    if (!link || !link.isActive || link.portal.deletedAt)
      throw new NotFoundException('Shared access is unavailable');
    this.assertAssignedClient(link.assignments, userId, link.portal.workspaceId);
    if (link.expiresAt && link.expiresAt <= new Date())
      throw new ForbiddenException('This share link has expired');
    if (link.password && (!password || !(await bcrypt.compare(password, link.password)))) {
      throw new ForbiddenException('Password is required or invalid');
    }
    if (!link[permission])
      throw new ForbiddenException('This share link does not allow that action');
    return link;
  }

  /** Decision actions require a current authenticated assignment, not a bearer-only guest link. */
  async requireDecisionCapability(token: string, password: string | undefined, userId?: string) {
    if (!userId) throw new ForbiddenException('Sign in with the assigned client account to respond');
    const link = await this.requireCapability(token, password, 'allowDecisions', userId);
    if (
      !link.assignments.some(
        (assignment) =>
          assignment.userId === userId &&
          assignment.user.workspaceId === link.portal.workspaceId &&
          assignment.user.role === 'MEMBER',
      )
    ) {
      throw new ForbiddenException('This decision is assigned to a different client account');
    }
    return link;
  }

  async requireAssignedReportCapability(token: string, password: string | undefined, userId?: string) {
    if (!userId) throw new ForbiddenException('Sign in with the assigned client account to view reports');
    const link = await this.requireCapability(token, password, 'allowExport', userId);
    if (!link.assignments.some((assignment) => assignment.userId === userId &&
      assignment.user?.workspaceId === link.portal.workspaceId && assignment.user.role === 'MEMBER')) {
      throw new ForbiddenException('This report is available only to assigned client accounts');
    }
    return link;
  }

  async getSharedExport(token: string, password?: string, userId?: string) {
    const link = await this.requireCapability(token, password, 'allowExport', userId);
    const portal = await this.prisma.portal.findFirst({
      where: { id: link.portalId, workspaceId: link.portal.workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        draftMode: true,
        publishedSnapshot: true,
        clientStatus: true,
        clientStatusNote: true,
        latestDeliverable: true,
        pendingDecision: true,
        clientUpdateAt: true,
        workspace: { select: { name: true, logo: true, primaryColor: true } },
        widgets: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            integration: {
              select: {
                id: true,
                provider: true,
                lastSyncedAt: true,
                lastValidDataAt: true,
                connectionState: true,
              },
            },
          },
        },
      },
    });
    if (!portal) throw new NotFoundException('Shared access is unavailable');
    const snapshot = readPublishedPortalSnapshot(portal.publishedSnapshot);
    if (portal.draftMode && !snapshot) throw new NotFoundException('Portal has not been published');
    const sourceWidgets =
      snapshot?.widgets ??
      portal.widgets.map((widget) => ({
        id: widget.id,
        name: widget.name,
        type: widget.type,
        provider: widget.integration?.provider ?? null,
        layout: undefined,
      }));
    const widgets = await Promise.all(
      sourceWidgets.map(async (widget) => {
        const isDemo = widget.provider === 'DEMO';
        return {
          id: widget.id,
          name: widget.name,
          type: widget.type,
          data:
            isDemo && this.demoConnectorService
              ? (this.demoConnectorService.fetchData('metrics') as Record<string, unknown>)
              : null,
          sourceLabel: isDemo ? 'Fictional local sample data' : 'No public sample data configured',
          isDemo,
          layout: widget.layout,
        };
      }),
    );
    const metrics =
      snapshot?.metrics ??
      (this.metricProvenance ? await this.metricProvenance.publicMetrics(portal.id) : []);
    const valueClaims =
      snapshot?.valueClaims ??
      (this.valueLedger ? await this.valueLedger.publicClaims(portal.id) : []);
    const visibleWidgetIds = new Set(sourceWidgets.map((widget) => widget.id));
    const feedStatus = summarizeClientFeedStatus([
      ...portal.widgets
        .filter((widget) => visibleWidgetIds.has(widget.id) && widget.integration)
        .map((widget) => ({
          lastSyncedAt: widget.integration?.lastSyncedAt,
          lastValidDataAt: widget.integration?.lastValidDataAt,
          connectionState: widget.integration?.connectionState,
        })),
      ...metrics.map((metric: Record<string, any>) => ({
        sourceFreshnessAt: metric.sourceFreshnessAt,
        health: metric.health,
      })),
    ]);
    return {
      portal: {
        id: portal.id,
        name: snapshot?.name ?? portal.name,
        description: snapshot?.description ?? portal.description,
        workspace: portal.workspace,
        widgets,
        metrics,
        valueClaims,
        clientStatus: snapshot ? (snapshot.clientStatus ?? null) : portal.clientStatus,
        clientStatusNote: snapshot ? (snapshot.clientStatusNote ?? null) : portal.clientStatusNote,
        latestDeliverable: snapshot
          ? (snapshot.latestDeliverable ?? null)
          : portal.latestDeliverable,
        pendingDecision: snapshot ? (snapshot.pendingDecision ?? null) : portal.pendingDecision,
        clientUpdateAt: snapshot
          ? (snapshot.clientUpdateAt ?? null)
          : (portal.clientUpdateAt?.toISOString() ?? null),
        feedStatus,
      },
      exportedAt: new Date().toISOString(),
      source: 'shared-portal-view',
    };
  }

  async listSharedComments(token: string, password?: string, userId?: string) {
    const link = await this.requireCapability(token, password, 'allowComments', userId);
    return this.prisma.sharedPortalComment.findMany({
      where: { shareLinkId: link.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayName: true, content: true, createdAt: true },
    });
  }

  async createSharedComment(
    token: string,
    password: string | undefined,
    displayName: string,
    content: string,
    userId?: string,
  ) {
    const link = await this.requireCapability(token, password, 'allowComments', userId);
    const cleanName = displayName.trim().slice(0, 80);
    const cleanContent = content.trim().slice(0, 2000);
    if (!cleanName || !cleanContent) throw new BadRequestException('Name and comment are required');
    return this.prisma.sharedPortalComment.create({
      data: { shareLinkId: link.id, displayName: cleanName, content: cleanContent },
      select: { id: true, displayName: true, content: true, createdAt: true },
    });
  }

  async requestAccess(token: string, email: string, message?: string) {
    // Return the same response for unknown and known links to avoid link enumeration.
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      select: { id: true, portal: { select: { workspaceId: true, deletedAt: true } } },
    });
    if (link && !link.portal.deletedAt) {
      const existing = await this.prisma.shareAccessRequest.findFirst({
        where: { shareLinkId: link.id, email: email.toLowerCase(), status: 'PENDING' },
        select: { id: true },
      });
      if (!existing)
        await this.prisma.shareAccessRequest.create({
          data: {
            workspaceId: link.portal.workspaceId,
            shareLinkId: link.id,
            email: email.toLowerCase(),
            message: message?.trim() || null,
          },
        });
    }
    return { accepted: true };
  }

  async listAccessRequests(workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    return this.prisma.shareAccessRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        message: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        shareLink: { select: { id: true, portal: { select: { name: true } } } },
      },
    });
  }

  async reviewAccessRequest(id: string, workspaceId: string, userId: string) {
    await this.verifyShareManager(workspaceId, userId);
    const request = await this.prisma.shareAccessRequest.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Access request not found');
    return this.prisma.shareAccessRequest.update({
      where: { id },
      data: { status: 'REVIEWED', reviewedAt: new Date() },
      select: { id: true, status: true, reviewedAt: true },
    });
  }

  /**
   * Generate QR code for share link
   */
  async generateQRCode(
    id: string,
    workspaceId: string,
    options?: {
      width?: number;
      margin?: number;
      darkColor?: string;
      lightColor?: string;
    },
  ): Promise<{ qrCode: string; shareUrl: string }> {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const shareUrl = this.generateShareUrl(link.token);

    const qrCode = await QRCode.toDataURL(shareUrl, {
      width: options?.width || 256,
      margin: options?.margin || 2,
      color: {
        dark: options?.darkColor || '#000000',
        light: options?.lightColor || '#FFFFFF',
      },
    });

    return { qrCode, shareUrl };
  }

  /**
   * Get QR code as buffer for download
   */
  async getQRCodeBuffer(
    id: string,
    workspaceId: string,
    options?: {
      width?: number;
      format?: 'png' | 'svg';
    },
  ): Promise<Buffer> {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const shareUrl = this.generateShareUrl(link.token);

    if (options?.format === 'svg') {
      const svg = await QRCode.toString(shareUrl, {
        type: 'svg',
        width: options?.width || 256,
      });
      return Buffer.from(svg);
    }

    return await QRCode.toBuffer(shareUrl, {
      width: options?.width || 256,
      margin: 2,
    });
  }

  /**
   * Log access for analytics
   */
  async logAccess(
    token: string,
    accessData: {
      outcome: 'allowed' | 'denied';
      reason?: AccessLog['reason'];
      ip?: string;
      referrer?: string;
    },
  ): Promise<void> {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      select: { id: true },
    });

    if (!link) return;

    const accessLog: AccessLog = {
      timestamp: new Date(),
      outcome: accessData.outcome,
      reason: accessData.reason,
      ...(accessData.ip
        ? { visitorHash: createHmac('sha256', token).update(accessData.ip).digest('hex') }
        : {}),
      ...(accessData.referrer
        ? { referrerOrigin: this.getSafeReferrerOrigin(accessData.referrer) }
        : {}),
    };

    // Store access logs in Redis (keep last 1000)
    const cacheKey = `${this.ACCESS_LOG_PREFIX}${link.id}`;
    try {
      const existing = await this.cacheService.get(cacheKey);
      const logs: AccessLog[] = existing ? JSON.parse(existing) : [];
      logs.unshift(accessLog);
      const trimmedLogs = logs.slice(0, 1000);
      await this.cacheService.set(cacheKey, JSON.stringify(trimmedLogs), 30 * 24 * 60 * 60); // 30 days
    } catch (error) {
      this.logger.error('Failed to log access:', error);
    }
  }

  private getSafeReferrerOrigin(referrer: string): string | undefined {
    try {
      return new URL(referrer).origin;
    } catch {
      return undefined;
    }
  }

  private async verifyShareManager(workspaceId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { role: true },
    });
    if (!user) throw new ForbiddenException('Access denied to this workspace');
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only workspace owners and admins can manage share links');
    }
  }

  private async validateClientAssignees(
    workspaceId: string,
    userIds?: string[],
  ): Promise<string[]> {
    const uniqueIds = [...new Set(userIds || [])];
    if (!uniqueIds.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds }, workspaceId, role: 'MEMBER' },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      throw new BadRequestException('Assigned client accounts must be members of this workspace');
    }
    return uniqueIds;
  }

  private assertAssignedClient(
    assignments:
      Array<{ userId: string; user?: { workspaceId: string; role: string } }> | undefined,
    userId?: string,
    workspaceId?: string,
  ): void {
    if (
      assignments?.length &&
      (!userId ||
        !assignments.some(
          (assignment) =>
            assignment.userId === userId &&
            assignment.user?.workspaceId === workspaceId &&
            assignment.user.role === 'MEMBER',
        ))
    ) {
      throw new ForbiddenException('This link is available only to assigned client accounts');
    }
  }

  /**
   * Get analytics for a share link
   */
  async getAnalytics(id: string, workspaceId: string): Promise<ShareLinkAnalytics> {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    // Get access logs from cache
    const cacheKey = `${this.ACCESS_LOG_PREFIX}${id}`;
    let logs: AccessLog[] = [];

    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        logs = JSON.parse(cached);
      }
    } catch (error) {
      this.logger.error('Failed to get access logs:', error);
    }

    // Calculate analytics
    const uniqueVisitors = new Set(logs.map((l) => l.visitorHash).filter(Boolean));

    // Views by day (last 30 days)
    const viewsByDay: { date: string; views: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const views = logs.filter(
        (l) => new Date(l.timestamp).toISOString().split('T')[0] === dateStr,
      ).length;
      viewsByDay.push({ date: dateStr, views });
    }

    // We deliberately do not retain source IP addresses, so country analytics
    // are unavailable until a privacy-reviewed GeoIP design is introduced.
    const viewsByCountry: { country: string; views: number }[] = [];

    // Top referrers
    const referrerMap = new Map<string, number>();
    logs.forEach((l) => {
      const referrer = l.referrerOrigin || 'Direct';
      referrerMap.set(referrer, (referrerMap.get(referrer) || 0) + 1);
    });
    const topReferrers = Array.from(referrerMap.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViews: link.currentViews,
      uniqueVisitors: uniqueVisitors.size,
      viewsByDay,
      viewsByCountry,
      topReferrers,
    };
  }

  /**
   * Generate share URL
   */
  private generateShareUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return `${baseUrl}/share/${token}`;
  }
}
