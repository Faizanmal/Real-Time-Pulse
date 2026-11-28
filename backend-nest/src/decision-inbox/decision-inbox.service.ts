import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ClientDecisionResponseKind,
  ClientDecisionStatus,
  OnboardingFunnelStage,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { ShareLinksService } from '../share-links/share-links.service';
import { OnboardingFunnelService } from '../analytics/onboarding-funnel.service';

import {
  isReminderDue,
  isValidTimeZone,
  isWithinBusinessHours,
} from './decision-policy';
import type {
  CreateClientDecisionDto,
  UpdateDecisionEscalationPolicyDto,
} from './dto/decision-inbox.dto';

@Injectable()
export class DecisionInboxService {
  private readonly logger = new Logger(DecisionInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shareLinks: ShareLinksService,
    @Optional() private readonly onboardingFunnel?: OnboardingFunnelService,
  ) {}

  async create(workspaceId: string, agencyUserId: string, dto: CreateClientDecisionDto) {
    await this.requireAgencyAdmin(workspaceId, agencyUserId);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dueAt && (!Number.isFinite(dueAt.getTime()) || dueAt <= new Date())) {
      throw new BadRequestException('Due date must be a future timestamp');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const link = await tx.shareLink.findFirst({
          where: {
            id: dto.sourceShareLinkId,
            allowDecisions: true,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            portal: { workspaceId, deletedAt: null },
            assignments: {
              some: {
                userId: dto.clientUserId,
                user: { workspaceId, role: 'MEMBER' },
              },
            },
          },
          include: {
            portal: {
              select: {
                id: true,
                workspaceId: true,
                draftMode: true,
                publishedSnapshot: true,
                publishedAt: true,
                publishRevision: true,
              },
            },
          },
        });
        if (!link) throw new NotFoundException('Assigned decision link not found');
        if (!link.portal.publishedAt || !link.portal.publishedSnapshot) {
          throw new ConflictException('Publish the client portal before requesting a decision');
        }
        const snapshotDigest = digestSnapshot(link.portal.publishedSnapshot);
        const decision = await tx.clientDecision.create({
          data: {
            workspaceId,
            portalId: link.portal.id,
            sourceShareLinkId: link.id,
            clientUserId: dto.clientUserId,
            createdById: agencyUserId,
            title: dto.title.trim(),
            prompt: dto.prompt.trim(),
            portalRevision: link.portal.publishRevision,
            snapshotDigest,
            dueAt,
          },
        });
        await tx.decisionTimelineEvent.create({
          data: {
            decisionId: decision.id,
            workspaceId,
            resourceId: decision.id,
            revision: decision.portalRevision,
            version: 1,
            eventType: 'REQUESTED',
            actorType: 'AGENCY',
            actorId: agencyUserId,
            details: { portalRevision: decision.portalRevision, dueAt },
          },
        });
        return tx.clientDecision.findUniqueOrThrow({
          where: { id: decision.id },
          include: { response: true, timeline: { orderBy: { serverTimestamp: 'asc' } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return result;
  }

  async listAgency(workspaceId: string, agencyUserId: string, portalId?: string) {
    await this.requireAgencyAdmin(workspaceId, agencyUserId);
    const decisions = await this.prisma.clientDecision.findMany({
      where: { workspaceId, ...(portalId ? { portalId } : {}) },
      include: { response: true, timeline: { orderBy: { serverTimestamp: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(decisions.map(({ clientUserId }) => clientUserId))] }, workspaceId },
      select: { id: true, email: true },
    });
    const emails = new Map(users.map(({ id, email }) => [id, email]));
    const portals = await this.prisma.portal.findMany({
      where: { id: { in: [...new Set(decisions.map(({ portalId }) => portalId))] }, workspaceId },
      select: { id: true, publishRevision: true },
    });
    const revisions = new Map(portals.map(({ id, publishRevision }) => [id, publishRevision]));
    return decisions.map((decision) => ({
      ...decision,
      clientEmail: emails.get(decision.clientUserId) ?? null,
      currentPortalRevision: revisions.get(decision.portalId) ?? null,
      isStale: revisions.get(decision.portalId) !== decision.portalRevision,
    }));
  }

  async listClient(token: string, password: string | undefined, clientUserId?: string) {
    const link = await this.shareLinks.requireDecisionCapability(token, password, clientUserId);
    if (!clientUserId) throw new ForbiddenException('Sign in with the assigned client account');
    const portal = await this.prisma.portal.findFirst({
      where: { id: link.portal.id, workspaceId: link.portal.workspaceId, deletedAt: null },
      select: { publishRevision: true },
    });
    if (!portal) throw new NotFoundException('Shared portal is unavailable');
    const decisions = await this.prisma.clientDecision.findMany({
      where: {
        workspaceId: link.portal.workspaceId,
        portalId: link.portal.id,
        sourceShareLinkId: link.id,
        clientUserId,
      },
      include: { response: true, timeline: { orderBy: { serverTimestamp: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      currentPortalRevision: portal.publishRevision,
      decisions: decisions.map((decision) => ({
        ...clientDecisionProjection(decision),
        canRespond:
          decision.status === ClientDecisionStatus.OPEN &&
          decision.portalRevision === portal.publishRevision,
        currentPortalRevision: portal.publishRevision,
      })),
    };
  }

  async respond(
    token: string,
    decisionId: string,
    clientUserId: string | undefined,
    input: {
      password?: string;
      expectedRevision: number;
      response: ClientDecisionResponseKind;
      comment?: string;
    },
  ) {
    const link = await this.shareLinks.requireDecisionCapability(token, input.password, clientUserId);
    if (!clientUserId) throw new ForbiddenException('Sign in with the assigned client account');
    const normalizedComment = input.comment?.trim() || null;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const decision = await tx.clientDecision.findFirst({
          where: {
            id: decisionId,
            workspaceId: link.portal.workspaceId,
            portalId: link.portal.id,
            sourceShareLinkId: link.id,
            clientUserId,
          },
          include: { response: true },
        });
        if (!decision) throw new NotFoundException('Decision not found');

        if (decision.response) {
          const sameSubmission =
            decision.response.responderUserId === clientUserId &&
            decision.response.portalRevision === input.expectedRevision &&
            decision.response.response === input.response &&
            decision.response.comment === normalizedComment;
          if (sameSubmission) return { ...clientDecisionProjection(decision), idempotent: true };
          throw new ConflictException('This decision already has an immutable response');
        }
        if (decision.status !== ClientDecisionStatus.OPEN)
          throw new ConflictException('This decision is no longer open');
        if (decision.portalRevision !== input.expectedRevision)
          throw new ConflictException('The decision is for a different portal revision');

        const now = new Date();
        const currentLink = await tx.shareLink.findFirst({
          where: {
            id: link.id,
            portalId: decision.portalId,
            isActive: true,
            allowDecisions: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            portal: { workspaceId: decision.workspaceId, deletedAt: null },
            assignments: {
              some: {
                userId: clientUserId,
                user: { workspaceId: decision.workspaceId, role: 'MEMBER' },
              },
            },
          },
          select: { id: true, password: true },
        });
        if (!currentLink) throw new ForbiddenException('The assigned client link has expired or been revoked');
        if (currentLink.password && (!input.password || !(await bcrypt.compare(input.password, currentLink.password)))) {
          throw new ForbiddenException('The assigned client link password changed or is invalid');
        }

        const portal = await tx.portal.findFirst({
          where: { id: decision.portalId, workspaceId: decision.workspaceId, deletedAt: null },
          select: { publishRevision: true, publishedSnapshot: true, publishedAt: true },
        });
        if (!portal) throw new NotFoundException('Shared portal is unavailable');
        if (
          portal.publishRevision !== decision.portalRevision ||
          portal.publishRevision !== input.expectedRevision ||
          !portal.publishedAt ||
          !portal.publishedSnapshot ||
          digestSnapshot(portal.publishedSnapshot) !== decision.snapshotDigest
        ) {
          throw new ConflictException('The portal changed. Ask the agency to issue a new decision request.');
        }

        const status = responseStatus(input.response);
        const changed = await tx.clientDecision.updateMany({
          where: {
            id: decision.id,
            workspaceId: decision.workspaceId,
            clientUserId,
            status: ClientDecisionStatus.OPEN,
            portalRevision: input.expectedRevision,
          },
          data: { status },
        });
        if (changed.count !== 1) throw new ConflictException('This decision was already answered');

        const response = await tx.clientDecisionResponse.create({
          data: {
            decisionId: decision.id,
            responderUserId: clientUserId,
            response: input.response,
            comment: normalizedComment,
            portalRevision: input.expectedRevision,
          },
        });
        await tx.decisionTimelineEvent.create({
          data: {
            decisionId: decision.id,
            workspaceId: decision.workspaceId,
            resourceId: decision.id,
            revision: response.portalRevision,
            version: 1,
            eventType: 'CLIENT_RESPONDED',
            actorType: 'CLIENT',
            actorId: clientUserId,
            details: { response: response.response, portalRevision: response.portalRevision },
          },
        });
        return {
          ...clientDecisionProjection({ ...decision, status, response }),
          idempotent: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    try {
      await this.onboardingFunnel?.recordStage(link.portal.workspaceId, OnboardingFunnelStage.FIRST_DECISION);
    } catch {
      // Client decision response must not depend on optional telemetry.
    }
    return result;
  }

  async getPolicy(workspaceId: string, agencyUserId: string) {
    await this.requireAgencyAdmin(workspaceId, agencyUserId);
    return (
      (await this.prisma.decisionEscalationPolicy.findUnique({ where: { workspaceId } })) ?? {
        workspaceId,
        enabled: false,
        notificationOptIn: false,
        timeZone: 'UTC',
        businessDays: [1, 2, 3, 4, 5],
        businessHoursStart: '09:00',
        businessHoursEnd: '17:00',
        reminderIntervalMinutes: 1440,
        maxReminders: 3,
      }
    );
  }

  async updatePolicy(
    workspaceId: string,
    agencyUserId: string,
    dto: UpdateDecisionEscalationPolicyDto,
  ) {
    await this.requireAgencyAdmin(workspaceId, agencyUserId);
    const current = await this.getPolicy(workspaceId, agencyUserId);
    const merged = { ...current, ...dto };
    if (!isValidTimeZone(merged.timeZone)) throw new BadRequestException('Use a valid IANA time zone');
    if (merged.businessHoursStart >= merged.businessHoursEnd)
      throw new BadRequestException('Business hours must start before they end');
    if (merged.enabled && !merged.notificationOptIn)
      throw new BadRequestException('Enable explicit notification opt-in before enabling reminders');
    return this.prisma.decisionEscalationPolicy.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        enabled: merged.enabled,
        notificationOptIn: merged.notificationOptIn,
        timeZone: merged.timeZone,
        businessDays: merged.businessDays,
        businessHoursStart: merged.businessHoursStart,
        businessHoursEnd: merged.businessHoursEnd,
        reminderIntervalMinutes: merged.reminderIntervalMinutes,
        maxReminders: merged.maxReminders,
        updatedById: agencyUserId,
      },
      update: { ...dto, updatedById: agencyUserId },
    });
  }

  async withdraw(decisionId: string, workspaceId: string, agencyUserId: string) {
    await this.requireAgencyAdmin(workspaceId, agencyUserId);
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.clientDecision.findFirst({
        where: { id: decisionId, workspaceId, status: ClientDecisionStatus.OPEN },
        select: { portalRevision: true },
      });
      if (!prior) throw new NotFoundException('Open decision not found');
      const changed = await tx.clientDecision.updateMany({
        where: { id: decisionId, workspaceId, status: ClientDecisionStatus.OPEN },
        data: { status: ClientDecisionStatus.WITHDRAWN },
      });
      if (!changed.count) throw new NotFoundException('Open decision not found');
      await tx.decisionTimelineEvent.create({
        data: {
          decisionId,
          workspaceId,
          resourceId: decisionId,
          revision: prior.portalRevision,
          version: 1,
          eventType: 'WITHDRAWN',
          actorType: 'AGENCY',
          actorId: agencyUserId,
        },
      });
      return tx.clientDecision.findFirstOrThrow({
        where: { id: decisionId, workspaceId },
        include: { response: true, timeline: { orderBy: { serverTimestamp: 'asc' } } },
      });
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processEscalations(now = new Date()) {
    const policies = await this.prisma.decisionEscalationPolicy.findMany({
      where: { enabled: true, notificationOptIn: true },
    });
    let created = 0;
    let suppressed = 0;
    for (const policy of policies) {
      if (!isWithinBusinessHours(now, policy)) continue;
      const decisions = await this.prisma.clientDecision.findMany({
        where: {
          workspaceId: policy.workspaceId,
          status: ClientDecisionStatus.OPEN,
          dueAt: { lte: now },
          reminderCount: { lt: policy.maxReminders },
        },
        take: 500,
      });
      for (const decision of decisions) {
        if (!isReminderDue(now, decision, policy)) {
          suppressed += 1;
          continue;
        }
        try {
          if (await this.createReminder(decision, policy.workspaceId, policy, now)) created += 1;
          else suppressed += 1;
        } catch (error) {
          suppressed += 1;
          this.logger.warn(`Decision reminder was not created for ${decision.id}: ${(error as Error).message}`);
        }
      }
    }
    this.logger.log(`Decision escalation run: created=${created}, suppressed=${suppressed}`);
    return { created, suppressed };
  }

  private async createReminder(
    decision: { id: string; workspaceId: string; portalId: string; sourceShareLinkId: string; clientUserId: string; title: string; dueAt: Date | null; lastReminderAt: Date | null; reminderCount: number },
    workspaceId: string,
    policy: { timeZone: string; businessDays: number[]; businessHoursStart: string; businessHoursEnd: string; enabled: boolean; notificationOptIn: boolean; reminderIntervalMinutes: number; maxReminders: number },
    now: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.clientDecision.findFirst({ where: { id: decision.id, workspaceId } });
      if (!current || current.status !== ClientDecisionStatus.OPEN || !isReminderDue(now, current, policy)) return false;
      const liveLink = await tx.shareLink.findFirst({
        where: {
          id: current.sourceShareLinkId,
          portalId: current.portalId,
          allowDecisions: true,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          portal: { workspaceId, deletedAt: null },
          assignments: { some: { userId: current.clientUserId, user: { workspaceId, role: 'MEMBER' } } },
        },
        select: { token: true },
      });
      if (!liveLink) return false;
      const changed = await tx.clientDecision.updateMany({
        where: {
          id: current.id,
          workspaceId,
          status: ClientDecisionStatus.OPEN,
          reminderCount: current.reminderCount,
          lastReminderAt: current.lastReminderAt,
        },
        data: { reminderCount: { increment: 1 }, lastReminderAt: now },
      });
      if (changed.count !== 1) return false;
      const ordinal = current.reminderCount + 1;
      await tx.decisionReminder.create({ data: { decisionId: current.id, ordinal } });
      await tx.notification.create({
        data: {
          userId: current.clientUserId,
          workspaceId,
          title: 'Decision reminder',
          message: `“${current.title}” is awaiting your response.`,
          type: NotificationType.DECISION_REMINDER,
          actionUrl: `/share/${liveLink.token}`,
          portalId: current.portalId,
          metadata: { decisionId: current.id, reminderOrdinal: ordinal },
        },
      });
      await tx.decisionTimelineEvent.create({
        data: {
          decisionId: current.id,
          workspaceId,
          resourceId: current.id,
          revision: current.portalRevision,
          version: 1,
          eventType: 'REMINDER_SENT',
          actorType: 'SYSTEM',
          details: { ordinal, timeZone: policy.timeZone },
        },
      });
      return true;
    });
  }

  private async requireAgencyAdmin(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { role: true },
    });
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN'))
      throw new ForbiddenException('Only workspace owners and admins can manage client decisions');
  }
}

function responseStatus(response: ClientDecisionResponseKind): ClientDecisionStatus {
  switch (response) {
    case ClientDecisionResponseKind.APPROVE:
      return ClientDecisionStatus.APPROVED;
    case ClientDecisionResponseKind.DECLINE:
      return ClientDecisionStatus.DECLINED;
    case ClientDecisionResponseKind.REQUEST_CHANGES:
      return ClientDecisionStatus.CHANGES_REQUESTED;
  }
}

function digestSnapshot(snapshot: Prisma.JsonValue): string {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function clientDecisionProjection(decision: {
  id: string;
  title: string;
  prompt: string;
  status: ClientDecisionStatus;
  portalRevision: number;
  dueAt: Date | null;
  createdAt: Date;
  response?: {
    response: ClientDecisionResponseKind;
    comment: string | null;
    portalRevision: number;
    createdAt: Date;
    } | null;
  timeline?: Array<{
    eventId: string;
    version: number;
    revision: number;
    eventType: string;
    actorType: string;
    serverTimestamp: Date;
  }>;
}) {
  return {
    id: decision.id,
    title: decision.title,
    prompt: decision.prompt,
    status: decision.status,
    portalRevision: decision.portalRevision,
    dueAt: decision.dueAt,
    createdAt: decision.createdAt,
    response: decision.response,
    ...(decision.timeline
      ? {
          timeline: decision.timeline.map(({ eventId, version, revision, eventType, actorType, serverTimestamp }) => ({
            eventId,
            version,
            revision,
            eventType,
            actorType,
            serverTimestamp,
          })),
        }
      : {}),
  };
}
