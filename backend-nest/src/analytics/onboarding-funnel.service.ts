import { createHmac } from 'crypto';

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsentType, OnboardingFunnelStage, Prisma, ProductTelemetryKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const PURPOSE = 'Consent-based, pseudonymous onboarding funnel measurement';
const STAGES = Object.values(OnboardingFunnelStage);

@Injectable()
export class OnboardingFunnelService {
  private readonly logger = new Logger(OnboardingFunnelService.name);
  private readonly hmacKey: string;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.hmacKey = config.get<string>('ONBOARDING_FUNNEL_HMAC_KEY') ?? '';
  }

  async setConsent(workspaceId: string, userId: string, consented: boolean) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { id: true, email: true, role: true },
    });
    if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Workspace owner or admin required');
    }

    const consent = await this.prisma.$transaction(async (tx: any) => {
      const previous = await tx.gDPRConsent.findFirst({
        where: { workspaceId, consentType: ConsentType.ANALYTICS },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      // Store each preference change as an immutable consent record.
      const now = new Date(Math.max(Date.now(), previous ? previous.createdAt.getTime() + 1 : 0));
      const saved = await tx.gDPRConsent.create({
        data: {
          workspaceId,
          userId,
          subjectEmail: user.email,
          consentType: ConsentType.ANALYTICS,
          purpose: PURPOSE,
          consented,
          consentedAt: consented ? now : null,
          revokedAt: consented ? null : now,
          revocationReason: consented ? null : 'Workspace analytics preference revoked',
          createdAt: now,
        },
      });

      if (!consented) {
        const journeyKey = this.journeyKey(workspaceId);
        if (journeyKey) await tx.onboardingFunnelEvent.deleteMany({ where: { journeyKey } });
        await tx.productTelemetryEvent.deleteMany({
          where: {
            workspaceId,
            kind: { in: [
              ProductTelemetryKind.FEATURE_ADOPTION,
              ProductTelemetryKind.FEATURE_SUCCESS,
              ProductTelemetryKind.FEATURE_GUARDRAIL,
              ProductTelemetryKind.EXPERIMENT,
            ] },
          },
        });
      }
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      analyticsConsent: consent.consented,
      trackingAvailable: this.hasHmacKey(),
      message: this.hasHmacKey()
        ? 'Preference saved.'
        : 'Preference saved; funnel tracking is unavailable until the server HMAC key is configured.',
    };
  }

  /** Track only a first occurrence after explicit workspace consent. */
  async recordStage(workspaceId: string, stage: OnboardingFunnelStage) {
    if (!this.hasHmacKey()) return { recorded: false, reason: 'tracking_unconfigured' };
    try {
      const journeyKey = this.journeyKey(workspaceId);
      if (!journeyKey) return { recorded: false, reason: 'tracking_unconfigured' };
      const eventKey = this.digest(`${journeyKey}:${stage}`);
      const result = await this.prisma.$transaction(async (tx: any) => {
        const consent = await tx.gDPRConsent.findFirst({
          where: { workspaceId, consentType: ConsentType.ANALYTICS },
          orderBy: { createdAt: 'desc' },
          select: { consented: true, expiresAt: true },
        });
        if (!consent?.consented || (consent.expiresAt && consent.expiresAt <= new Date())) {
          return { recorded: false, reason: 'consent_required' };
        }
        const event = await tx.onboardingFunnelEvent.create({
          data: { journeyKey, eventKey, stage },
          select: { stage: true, happenedAt: true },
        });
        return { recorded: true, duplicate: false, event };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result.recorded && !result.duplicate) {
        try { await this.cleanupExpiredFunnelEvents(); } catch { /* Retention cleanup never blocks product actions. */ }
      }
      return result;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        return { recorded: true, duplicate: true, stage };
      }
      this.logger.warn(`Could not record onboarding stage ${stage}`);
      // Telemetry must never fail registration, sync, publish, or client access.
      return { recorded: false, reason: 'temporarily_unavailable' };
    }
  }

  async stagesForWorkspace(workspaceId: string) {
    const [consent, integration, portal] = await Promise.all([
      this.prisma.gDPRConsent.findFirst({
        where: { workspaceId, consentType: ConsentType.ANALYTICS },
        orderBy: { createdAt: 'desc' },
        select: { consented: true, expiresAt: true },
      }),
      this.prisma.integration.findFirst({
        where: { workspaceId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { provider: true, connectionState: true, lastSyncError: true, lastValidDataAt: true, settings: true },
      }),
      this.prisma.portal.findFirst({
        where: { workspaceId, slug: 'agency-client-demo', deletedAt: null },
        select: { shareToken: true, publishedAt: true, deletedAt: true },
      }),
    ]);
    const enabled = Boolean(
      this.hasHmacKey() && consent?.consented && (!consent.expiresAt || consent.expiresAt > new Date()),
    );
    const recovery = integration?.lastSyncError
      ? 'Reconnect or retry the provider from Integrations. Your setup is saved and can be resumed.'
      : null;
    const base = {
      analyticsConsent: Boolean(consent?.consented),
      trackingAvailable: this.hasHmacKey(),
      providerConnection: integration
        ? {
            provider: integration.provider,
            state: integration.connectionState,
            failureCode: integration.lastSyncError,
            nextAction: recovery,
            lastValidDataAt: integration.lastValidDataAt,
            isDemo: (integration.settings as Record<string, unknown> | null)?.isDemo === true,
          }
        : null,
      demoClientPath: portal?.shareToken ? `/v/${portal.shareToken}` : null,
      publishedAt: portal?.publishedAt ?? null,
    };
    if (!enabled) return { ...base, stages: [], completedStages: 0, totalStages: STAGES.length };

    const journeyKey = this.journeyKey(workspaceId);
    const events = journeyKey
      ? await this.prisma.onboardingFunnelEvent.findMany({
          where: { journeyKey },
          select: { stage: true, happenedAt: true },
          orderBy: { happenedAt: 'asc' },
        })
      : [];
    const eventByStage = new Map(events.map((event) => [event.stage, event.happenedAt]));
    const stages = STAGES.map((stage) => ({ stage, complete: eventByStage.has(stage), happenedAt: eventByStage.get(stage) ?? null }));
    return { ...base, analyticsConsent: true, trackingAvailable: true, stages, completedStages: events.length, totalStages: STAGES.length };
  }

  async getStatus(workspaceId: string, userId: string) {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    try { await this.cleanupExpiredFunnelEvents(); } catch { /* Status remains available if cleanup is temporarily unavailable. */ }
    return this.stagesForWorkspace(workspaceId);
  }

  async cleanupExpiredFunnelEvents() {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    return this.prisma.onboardingFunnelEvent.deleteMany({ where: { happenedAt: { lt: cutoff } } });
  }

  private async assertWorkspaceAdmin(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { role: true },
    });
    if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Workspace owner or admin required');
    }
  }

  private hasHmacKey() {
    return Buffer.byteLength(this.hmacKey) >= 32;
  }

  private journeyKey(workspaceId: string) {
    if (!this.hasHmacKey()) return null;
    return this.digest(`onboarding-journey:v1:${workspaceId}`);
  }

  private digest(value: string) {
    return createHmac('sha256', this.hmacKey).update(value).digest('hex');
  }
}

