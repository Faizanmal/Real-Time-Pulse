import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { OnboardingFunnelStage, Prisma, Portal, User, Subscription } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  DEMO_CONNECTOR_LABEL,
  DemoConnectorService,
} from '../integrations/services/demo-connector.service';
import { IntegrationService } from '../integrations/integration.service';
import { MetricProvenanceService } from '../analytics/metric-provenance.service';
import { ValueLedgerService } from '../analytics/value-ledger.service';
import { OnboardingFunnelService } from '../analytics/onboarding-funnel.service';
import { AuditService } from '../audit/audit.service';

import {
  CreatePortalDto,
  PublishPortalDto,
  PublicPortalViewDto,
  UpdatePortalDto,
  PortalResponseDto,
} from './dto/portal.dto';
import { createPublishedPortalSnapshot, readPublishedPortalSnapshot } from './portal-snapshot';
import { summarizeClientFeedStatus } from './client-portal-status';

// Define the include object for reuse.
// This ensures all portal queries fetch the same related data.
const portalInclude = {
  workspace: {
    select: {
      id: true,
      name: true,
      logo: true,
      primaryColor: true,
    },
  },
  _count: {
    select: { widgets: true },
  },
};

// Define the type for the portal object returned by our queries.
// It's a `Portal` plus the fields from `portalInclude`.
type PortalWithDetails = Prisma.PortalGetPayload<{
  include: typeof portalInclude;
}>;

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: IntegrationService,
    private readonly demoConnectorService: DemoConnectorService,
    private readonly cache: CacheService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
    @Optional() private readonly notificationsGateway?: NotificationsGateway,
    @Optional() private readonly metricProvenance?: MetricProvenanceService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly valueLedger?: ValueLedgerService,
    @Optional() private readonly onboardingFunnel?: OnboardingFunnelService,
  ) {}

  /** Create or reuse one persistent, clearly labelled demo portal for this tenant. */
  async createDemoClientPortal(workspaceId: string, userId: string) {
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    const slug = 'agency-client-demo';
    const portalId = `demo-portal-${workspaceId}`;
    const widgetId = `demo-widget-${workspaceId}`;
    const integrationId = `demo-integration-${workspaceId}`;
    const marker = '[REAL_TIME_PULSE_DEMO]';

    const result = await this.prisma.$transaction(async (tx) => {
      const existingIntegration = await tx.integration.findUnique({
        where: { workspaceId_provider: { workspaceId, provider: 'DEMO' } },
      });
      if (
        existingIntegration &&
        (existingIntegration.settings as Record<string, unknown>)?.isDemo !== true
      ) {
        throw new ConflictException('This workspace already has a non-demo DEMO integration.');
      }

      const existingPortal = await tx.portal.findUnique({
        where: { workspaceId_slug: { workspaceId, slug } },
      });
      if (existingPortal?.deletedAt) {
        throw new ConflictException(
          'The demo portal was previously revoked; its slug is retained for recovery review.',
        );
      }
      if (existingPortal && !existingPortal.description?.startsWith(marker)) {
        throw new ConflictException(
          'The demo portal slug is already in use by a different portal.',
        );
      }

      const integration = await tx.integration.upsert({
        where: { workspaceId_provider: { workspaceId, provider: 'DEMO' } },
        update: {},
        create: {
          id: integrationId,
          workspaceId,
          provider: 'DEMO',
          accessToken: 'DEMO_ONLY_NO_CREDENTIAL',
          accountName: `${DEMO_CONNECTOR_LABEL} (fictional data)`,
          settings: this.demoConnectorService.getSettings() as Prisma.InputJsonObject,
          status: 'ACTIVE',
        },
      });

      const portal = await tx.portal.upsert({
        where: { workspaceId_slug: { workspaceId, slug } },
        update: {},
        create: {
          id: portalId,
          workspaceId,
          name: 'Agency to Client Demo',
          slug,
          description: `${marker} Fictional agency and client metrics; not connected to a live provider.`,
          isPublic: true,
          draftMode: true,
          createdById: userId,
          layout: [{ i: widgetId, x: 0, y: 0, w: 12, h: 4 }],
        },
      });

      const existingWidget = await tx.widget.findUnique({ where: { id: widgetId } });
      if (
        existingWidget &&
        (existingWidget.portalId !== portal.id || existingWidget.integrationId !== integration.id)
      ) {
        throw new ConflictException(
          'A different widget already occupies the demo widget identifier.',
        );
      }

      await tx.widget.upsert({
        where: { id: widgetId },
        update: {},
        create: {
          id: widgetId,
          portalId: portal.id,
          integrationId: integration.id,
          name: 'Fictional business health metrics',
          type: 'GA4_METRIC_KPI',
          config: { dataType: 'metrics', demo: true },
          gridX: 0,
          gridY: 0,
          gridWidth: 12,
          gridHeight: 4,
        },
      });

      if (!portal.publishedSnapshot) {
        const snapshotSource = await tx.portal.findUniqueOrThrow({
          where: { id: portal.id },
          include: {
            workspace: { select: { name: true, primaryColor: true } },
            widgets: {
              orderBy: { order: 'asc' },
              include: { integration: { select: { id: true, provider: true } } },
            },
          },
        });
        const publishedAt = new Date();
        await tx.portal.update({
          where: { id: portal.id },
          data: {
            draftMode: true,
            publishedAt,
            publishRevision: 1,
            publishedSnapshot: createPublishedPortalSnapshot(snapshotSource, 1, publishedAt),
          },
        });
      }

      return {
        portalId: portal.id,
        name: portal.name,
        shareToken: portal.shareToken,
        clientPath: `/v/${portal.shareToken}`,
        demoLabel: DEMO_CONNECTOR_LABEL,
        isDemo: true,
      };
    });
    for (const stage of [
      OnboardingFunnelStage.CONNECTED,
      OnboardingFunnelStage.FIRST_VALID_SYNC,
      OnboardingFunnelStage.FIRST_PUBLISH,
    ]) {
      try {
        await this.onboardingFunnel?.recordStage(workspaceId, stage);
      } catch {
        // Funnel telemetry must not block demo setup.
      }
    }
    return result;
  }

  /** Return only the published snapshot (or legacy live view for pre-builder portals). */
  async findPublicViewByShareToken(shareToken: string): Promise<PublicPortalViewDto> {
    const portal = await this.prisma.portal.findUnique({
      where: { shareToken, deletedAt: null, isPublic: true },
      include: {
        workspace: { select: { name: true, primaryColor: true } },
        widgets: {
          orderBy: { order: 'asc' },
          include: {
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

    if (!portal) {
      throw new NotFoundException('Shared portal not found');
    }
    const snapshot = readPublishedPortalSnapshot(portal.publishedSnapshot);
    if (portal.draftMode && !snapshot)
      throw new NotFoundException('Shared portal has not been published');
    try {
      await this.onboardingFunnel?.recordStage(portal.workspaceId, OnboardingFunnelStage.FIRST_CLIENT_VIEW);
    } catch {
      // Public client access must not depend on optional telemetry.
    }
    return this.buildClientProjection(
      portal,
      snapshot,
      portal.draftMode ? 'published' : 'legacy-live',
    );
  }

  /** Authenticated client-safe preview of the current draft. */
  async previewDraft(
    portalId: string,
    workspaceId: string,
    userId: string,
  ): Promise<PublicPortalViewDto> {
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId, deletedAt: null },
      include: {
        workspace: { select: { name: true, primaryColor: true } },
        widgets: {
          orderBy: { order: 'asc' },
          include: {
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
    if (!portal) throw new NotFoundException('Portal not found');
    return this.buildClientProjection(portal, null, 'draft-preview');
  }

  async publishDraft(portalId: string, workspaceId: string, userId: string, dto: PublishPortalDto) {
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);
    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime()))
      throw new BadRequestException('Invalid draft timestamp');
    const publishedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const portal = await tx.portal.findFirst({
        where: { id: portalId, workspaceId, deletedAt: null },
        include: {
          workspace: { select: { name: true, primaryColor: true } },
          widgets: {
            orderBy: { order: 'asc' },
            include: {
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
      if (!portal) throw new NotFoundException('Portal not found');
      if (portal.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new ConflictException('Portal draft changed. Reload before publishing.');
      }
      const revision = portal.publishRevision + 1;
      const metrics = this.metricProvenance
        ? await this.metricProvenance.publicMetrics(portal.id)
        : [];
      const valueClaims = this.valueLedger ? await this.valueLedger.publicClaims(portal.id) : [];
      const publishedSnapshot = createPublishedPortalSnapshot(
        portal,
        revision,
        publishedAt,
        metrics,
        valueClaims,
      );
      const updated = await tx.portal.updateMany({
        where: { id: portalId, workspaceId, deletedAt: null, updatedAt: expectedUpdatedAt },
        data: {
          draftMode: true,
          publishedSnapshot,
          publishedAt,
          publishRevision: revision,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Portal draft changed. Reload before publishing.');
      return { portalId, publishedAt, publishRevision: revision, isPublic: portal.isPublic };
    });
    await this.cache.invalidatePortal(portalId);
    this.realtimeGateway?.broadcastToWorkspace(workspaceId, 'portal:published', result);
    try {
      await this.onboardingFunnel?.recordStage(workspaceId, OnboardingFunnelStage.FIRST_PUBLISH);
    } catch {
      // Publishing must not fail because optional telemetry is unavailable.
    }
    return result;
  }

  async unpublish(portalId: string, workspaceId: string, userId: string) {
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);
    const result = await this.prisma.portal.updateMany({
      where: { id: portalId, workspaceId, deletedAt: null, isPublic: true },
      data: { isPublic: false },
    });
    if (result.count !== 1) {
      const existing = await this.prisma.portal.findFirst({
        where: { id: portalId, workspaceId, deletedAt: null },
        select: { isPublic: true },
      });
      if (!existing) throw new NotFoundException('Portal not found');
      if (!existing.isPublic) return { portalId, isPublic: false };
      throw new ConflictException('Portal changed while unpublishing. Reload and retry.');
    }
    await this.cache.invalidatePortal(portalId);
    this.realtimeGateway?.broadcastToWorkspace(workspaceId, 'portal:unpublished', { portalId });
    await this.recordCommandAudit(
      userId,
      workspaceId,
      'Portal',
      portalId,
      'POST',
      '/api/v1/portals/:id/unpublish',
      { isPublic: false },
    );
    return { portalId, isPublic: false };
  }

  async findAttention(workspaceId: string, userId: string, page = 1, pageSize = 5) {
    await this.verifyUserInWorkspace(userId, workspaceId);
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safeSize = Number.isFinite(pageSize)
      ? Math.min(20, Math.max(1, Math.floor(pageSize)))
      : 5;
    const where: Prisma.PortalWhereInput = {
      workspaceId,
      deletedAt: null,
      OR: [
        { clientStatus: { in: ['BLOCKED', 'NEEDS_ATTENTION'] } },
        { pendingDecision: { not: null } },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.portal.findMany({
        where,
        select: {
          id: true,
          name: true,
          clientStatus: true,
          clientStatusNote: true,
          pendingDecision: true,
          clientUpdateAt: true,
          updatedAt: true,
        },
        orderBy: [{ clientUpdateAt: 'asc' }, { updatedAt: 'asc' }],
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
      this.prisma.portal.count({ where }),
    ]);
    return { items: rows, total, page: safePage, pageSize: safeSize };
  }

  async bulkUnpublish(portalIds: string[], workspaceId: string, userId: string) {
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);
    if (
      !Array.isArray(portalIds) ||
      portalIds.length === 0 ||
      portalIds.length > 50 ||
      portalIds.some((id) => typeof id !== 'string' || id.length === 0)
    ) {
      throw new BadRequestException('Select between 1 and 50 valid portals.');
    }
    const uniqueIds = [...new Set(portalIds)];
    let succeededCount = 0;
    const changedPortalIds: string[] = [];
    for (const portalId of uniqueIds) {
      const updated = await this.prisma.portal.updateMany({
        where: { id: portalId, workspaceId, deletedAt: null, isPublic: true },
        data: { isPublic: false },
      });
      if (updated.count === 1) {
        succeededCount += 1;
        changedPortalIds.push(portalId);
        await this.cache.invalidatePortal(portalId);
        this.realtimeGateway?.broadcastToWorkspace(workspaceId, 'portal:unpublished', { portalId });
      }
    }
    if (succeededCount > 0) {
      await this.recordCommandAudit(
        userId,
        workspaceId,
        'PortalBulkOperation',
        workspaceId,
        'POST',
        '/api/v1/portals/bulk-unpublish',
        {
          operation: 'UNPUBLISH',
          succeededCount,
          requestedCount: uniqueIds.length,
          changedPortalIds,
        },
      );
    }
    return {
      requestedCount: uniqueIds.length,
      succeededCount,
      unavailableCount: uniqueIds.length - succeededCount,
      succeededPortalIds: changedPortalIds,
    };
  }

  private async recordCommandAudit(
    userId: string,
    workspaceId: string,
    entity: string,
    entityId: string,
    method: string,
    endpoint: string,
    newValues: Record<string, unknown>,
  ) {
    if (!this.auditService) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.auditService.log({
      workspaceId,
      userId,
      userEmail: user?.email ?? 'unknown',
      action: 'UPDATE',
      entity,
      entityId,
      method,
      endpoint,
      newValues: newValues as Prisma.InputJsonValue,
      metadata: { source: 'agency-command-center' },
    });
  }

  private async buildClientProjection(
    portal: any,
    snapshot: ReturnType<typeof readPublishedPortalSnapshot>,
    viewMode: NonNullable<PublicPortalViewDto['viewMode']>,
  ): Promise<PublicPortalViewDto> {
    const rawWidgets = portal.widgets.map((widget: any) => ({
      id: widget.id,
      name: widget.name,
      type: widget.type,
      integrationId: widget.integrationId ?? null,
      provider: widget.integration?.provider ?? null,
      order: widget.order ?? 0,
      layout: { x: widget.gridX, y: widget.gridY, w: widget.gridWidth, h: widget.gridHeight },
    }));
    const storedOrder =
      portal.layout && typeof portal.layout === 'object' && !Array.isArray(portal.layout)
        ? (portal.layout as { widgetOrder?: unknown }).widgetOrder
        : undefined;
    const sourceWidgets =
      snapshot?.widgets ??
      (Array.isArray(storedOrder) && storedOrder.every((id) => typeof id === 'string')
        ? [...rawWidgets].sort((a: any, b: any) => {
            const rank = new Map((storedOrder as string[]).map((id, index) => [id, index]));
            return (
              (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
                (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.order - b.order
            );
          })
        : rawWidgets);
    const widgets = await Promise.all(
      sourceWidgets.map(async (widget) => {
        const isDemo = widget.provider === 'DEMO';
        let data: Record<string, unknown> | null = null;
        if (isDemo && widget.integrationId) {
          try {
            data = (await this.integrationService.fetchData(
              widget.integrationId,
              'metrics',
            )) as Record<string, unknown>;
          } catch {
            data = null;
          }
        }
        return {
          id: widget.id,
          name: widget.name,
          type: widget.type,
          data,
          sourceLabel: isDemo
            ? data
              ? 'Fictional local sample data'
              : 'Sample connector unavailable'
            : 'No public data configured',
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
    const visibleWidgetIds = sourceWidgets.map((widget) => widget.id);
    const feedStatus = this.clientFeedStatus(portal, visibleWidgetIds, metrics);
    const clientFields = snapshot
      ? {
          clientStatus: snapshot.clientStatus ?? null,
          clientStatusNote: snapshot.clientStatusNote ?? null,
          latestDeliverable: snapshot.latestDeliverable ?? null,
          pendingDecision: snapshot.pendingDecision ?? null,
          clientUpdateAt: snapshot.clientUpdateAt ?? null,
        }
      : {
          clientStatus: portal.clientStatus ?? null,
          clientStatusNote: portal.clientStatusNote ?? null,
          latestDeliverable: portal.latestDeliverable ?? null,
          pendingDecision: portal.pendingDecision ?? null,
          clientUpdateAt: portal.clientUpdateAt?.toISOString() ?? null,
        };
    return {
      id: portal.id,
      name: snapshot?.name ?? portal.name,
      description: snapshot?.description ?? portal.description,
      workspaceName: snapshot?.workspaceName ?? portal.workspace.name,
      primaryColor: snapshot?.primaryColor ?? portal.workspace.primaryColor ?? '#2563eb',
      widgets,
      metrics,
      valueClaims,
      viewMode,
      publishedAt: snapshot?.publishedAt ?? null,
      publishRevision: snapshot?.revision ?? portal.publishRevision ?? 0,
      ...clientFields,
      feedStatus,
    };
  }

  private clientFeedStatus(
    portal: any,
    visibleWidgetIds: string[],
    metrics: Array<Record<string, any>>,
  ) {
    const visible = new Set(visibleWidgetIds);
    const widgetFeeds = portal.widgets
      .filter((widget: any) => visible.has(widget.id) && widget.integration)
      .map((widget: any) => ({
        lastSyncedAt: widget.integration.lastSyncedAt,
        lastValidDataAt: widget.integration.lastValidDataAt,
        connectionState: widget.integration.connectionState,
      }));
    const metricFeeds = metrics.map((metric) => ({
      sourceFreshnessAt: metric.sourceFreshnessAt,
      health: metric.health,
    }));
    return summarizeClientFeedStatus([...widgetFeeds, ...metricFeeds]);
  }

  /**
   * Create a new portal
   */
  async create(
    workspaceId: string,
    userId: string,
    dto: CreatePortalDto,
  ): Promise<PortalResponseDto> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Check if slug already exists in this workspace
    // No `as any` needed. Use the properly typed prisma client.
    const existingPortal: Portal | null = await this.prisma.portal.findFirst({
      where: {
        workspaceId,
        slug: dto.slug,
        deletedAt: null,
      },
    });

    if (existingPortal) {
      throw new ConflictException('Portal slug already exists in this workspace');
    }

    // Check subscription limits
    const subscription: Subscription | null = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    const portalCount: number = await this.prisma.portal.count({
      where: { workspaceId, deletedAt: null },
    });

    if (!subscription) {
      throw new ForbiddenException('A workspace subscription is required to create portals.');
    }
    if (portalCount >= subscription.maxPortals) {
      throw new BadRequestException(
        `Portal limit reached. Upgrade your plan to create more portals.`,
      );
    }

    // Generate unique share token
    const shareToken = this.generateShareToken();

    // Create portal
    // The result is typed as `PortalWithDetails` because of the `include`
    const portal = (await this.prisma.portal.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        shareToken,
        isPublic: dto.isPublic ?? false,
        draftMode: dto.isPublic !== true,
        // Use `dto.layout ?? {}` as in original, assuming layout is non-nullable JSON
        layout: dto.layout ?? {},
        workspaceId,
        createdById: userId,
      },
      include: portalInclude, // Use the reusable include
    })) as PortalWithDetails;

    return this.formatPortalResponse(portal);
  }

  /**
   * Get all portals for a workspace with pagination
   */
  async findAll(
    workspaceId: string,
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ portals: PortalResponseDto[]; total: number; page: number; pageSize: number }> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePageSize = Number.isFinite(pageSize)
      ? Math.min(100, Math.max(1, Math.floor(pageSize)))
      : 20;
    const skip = (safePage - 1) * safePageSize;

    // `Promise.all` correctly infers the types
    const [portals, total] = await Promise.all([
      this.prisma.portal.findMany({
        where: { workspaceId, deletedAt: null },
        include: portalInclude, // Use the reusable include
        orderBy: { createdAt: 'desc' },
        skip,
        take: safePageSize,
      }),
      this.prisma.portal.count({
        where: { workspaceId, deletedAt: null },
      }),
    ]);

    return {
      // `p` is inferred as `PortalWithDetails`
      portals: portals.map((p) => this.formatPortalResponse(p)),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * Get a single portal by ID
   */
  async findOne(portalId: string, workspaceId: string, userId: string): Promise<PortalResponseDto> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Type the result explicitly as it can be null
    const portal: PortalWithDetails | null = await this.prisma.portal.findFirst({
      where: { id: portalId, deletedAt: null },
      include: portalInclude, // Use the reusable include
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    return this.formatPortalResponse(portal);
  }

  /**
   * Get portal by share token (public access)
   */
  async findByShareToken(shareToken: string): Promise<PublicPortalViewDto> {
    // Keep this legacy public route token-safe by using the same field allowlist as `/view`.
    return this.findPublicViewByShareToken(shareToken);
  }

  /**
   * Update a portal
   */
  async update(
    portalId: string,
    workspaceId: string,
    userId: string,
    dto: UpdatePortalDto,
  ): Promise<PortalResponseDto> {
    const changesClientSummary =
      dto.clientStatus !== undefined ||
      dto.clientStatusNote !== undefined ||
      dto.latestDeliverable !== undefined ||
      dto.pendingDecision !== undefined;
    if (changesClientSummary)
      await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);
    else await this.verifyUserInWorkspace(userId, workspaceId);

    // Verify portal exists and belongs to workspace
    const existingPortal: Portal | null = await this.prisma.portal.findFirst({
      where: { id: portalId, deletedAt: null },
    });

    if (!existingPortal) {
      throw new NotFoundException('Portal not found');
    }
    if (existingPortal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    if (dto.isPublic === true) {
      const assignedLink = await this.prisma.shareLink.findFirst({
        where: {
          portalId,
          isActive: true,
          assignments: { some: {} },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (assignedLink)
        throw new ConflictException(
          'Disable assigned client links before making this portal public',
        );
    }

    // `dto.layout` can be `undefined`, which Prisma's update
    // correctly interprets as "do not update this field".
    const update = await this.prisma.portal.updateMany({
      where: { id: portalId, workspaceId, deletedAt: null },
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
        layout: dto.layout,
        clientStatus: dto.clientStatus,
        clientStatusNote: dto.clientStatusNote,
        latestDeliverable: dto.latestDeliverable,
        pendingDecision: dto.pendingDecision,
        ...(dto.clientStatus !== undefined ||
        dto.clientStatusNote !== undefined ||
        dto.latestDeliverable !== undefined ||
        dto.pendingDecision !== undefined
          ? { clientUpdateAt: new Date() }
          : {}),
      },
    });
    if (update.count !== 1) throw new NotFoundException('Portal not found');
    const portal = (await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId, deletedAt: null },
      include: portalInclude,
    })) as PortalWithDetails | null;
    if (!portal) throw new NotFoundException('Portal not found');

    await this.cache.invalidatePortal(portalId);
    return this.formatPortalResponse(portal);
  }

  /**
   * Delete a portal
   */
  async remove(portalId: string, workspaceId: string, userId: string): Promise<void> {
    // Verify user belongs to workspace with proper permissions
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    // Verify portal exists and belongs to workspace
    const portal: Portal | null = await this.prisma.portal.findFirst({
      where: { id: portalId, deletedAt: null },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }
    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    const widgetIds = await this.prisma.widget.findMany({
      where: { portalId },
      select: { id: true },
    });
    await this.prisma.portal.updateMany({
      where: { id: portalId, workspaceId, deletedAt: null },
      data: { deletedAt: new Date(), isPublic: false, shareToken: this.generateShareToken() },
    });
    await this.cache.invalidatePortal(
      portalId,
      widgetIds.map(({ id }) => id),
    );
    await Promise.all([
      this.realtimeGateway?.revokePortalSubscriptions(portalId),
      this.notificationsGateway?.revokePortalSubscriptions(portalId),
    ]);
  }

  /**
   * Regenerate share token for a portal
   */
  async regenerateShareToken(
    portalId: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ shareToken: string }> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Verify portal exists and belongs to workspace
    const portal: Portal | null = await this.prisma.portal.findFirst({
      where: { id: portalId, deletedAt: null },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }
    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    const newShareToken = this.generateShareToken();

    await this.prisma.portal.updateMany({
      where: { id: portalId, workspaceId, deletedAt: null },
      data: { shareToken: newShareToken },
    });
    await this.cache.invalidatePortal(portalId);

    return { shareToken: newShareToken };
  }

  /**
   * Generate a unique share token
   */
  private generateShareToken(): string {
    return uuidv4();
  }

  /**
   * Verify user belongs to workspace
   */
  private async verifyUserInWorkspace(userId: string, workspaceId: string): Promise<void> {
    // Type the user result
    const user: User | null = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this workspace');
    }
  }

  /**
   * Verify user has required permissions in workspace
   */
  private async verifyUserPermission(
    userId: string,
    workspaceId: string,
    allowedRoles: string[],
  ): Promise<void> {
    // Type the user result
    const user: User | null = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    // Assuming user.role is a string.
    // If it's an enum, you might need to adjust `allowedRoles` type.
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Format portal response
   * This function is now strongly typed.
   */
  private formatPortalResponse(portal: PortalWithDetails): PortalResponseDto {
    return {
      id: portal.id,
      name: portal.name,
      slug: portal.slug,
      description: portal.description,
      shareToken: portal.shareToken,
      isPublic: portal.isPublic,
      draftMode: portal.draftMode,
      publishedAt: portal.publishedAt,
      publishRevision: portal.publishRevision,

      layout: portal.layout as Record<string, any> | null, // `layout` is of type JsonValue
      workspaceId: portal.workspaceId,
      createdAt: portal.createdAt,
      updatedAt: portal.updatedAt,
      clientStatus: portal.clientStatus,
      clientStatusNote: portal.clientStatusNote,
      latestDeliverable: portal.latestDeliverable,
      pendingDecision: portal.pendingDecision,
      clientUpdateAt: portal.clientUpdateAt,
      workspace: portal.workspace, // This is guaranteed to exist and be correctly shaped
      widgetCount: portal._count?.widgets, // This is now safe and guaranteed to be a number
    };
  }
}
