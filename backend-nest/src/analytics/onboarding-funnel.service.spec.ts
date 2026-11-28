import { ForbiddenException } from '@nestjs/common';
import { ConsentType, OnboardingFunnelStage } from '@prisma/client';

import { OnboardingFunnelService } from './onboarding-funnel.service';

jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_DAY_AT_2AM: '0 2 * * *' } }));

describe('OnboardingFunnelService', () => {
  const workspaceId = 'workspace-fictional-a';
  const userId = 'owner-fictional-a';
  const key = 'local-test-only-funnel-hmac-key-32-bytes';

  function harness(options: { consented?: boolean; expiresAt?: Date | null; role?: string; key?: string } = {}) {
    let consent: any = options.consented === undefined ? null : {
      id: 'consent-a', workspaceId, userId, consentType: ConsentType.ANALYTICS,
      consented: options.consented, expiresAt: options.expiresAt ?? null, createdAt: new Date(),
    };
    const rows = new Map<string, any>();
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: userId, email: 'owner@fictional.invalid', role: options.role ?? 'OWNER' }) },
      gDPRConsent: {
        findFirst: jest.fn(async () => consent),
        create: jest.fn(async ({ data }: any) => (consent = { id: 'consent-a', ...data, createdAt: new Date() })),
        update: jest.fn(async ({ data }: any) => (consent = { ...consent, ...data })),
      },
      onboardingFunnelEvent: {
        create: jest.fn(async ({ data }: any) => {
          if (rows.has(data.eventKey)) throw Object.assign(new Error('duplicate event'), { code: 'P2002' });
          const row = { id: `event-${rows.size + 1}`, ...data, happenedAt: new Date() };
          rows.set(data.eventKey, row);
          return { stage: row.stage, happenedAt: row.happenedAt };
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          for (const [eventKey, row] of rows) if (row.journeyKey === where.journeyKey) rows.delete(eventKey);
          return { count: 1 };
        }),
        findMany: jest.fn(async ({ where }: any) => [...rows.values()].filter((row) => row.journeyKey === where.journeyKey)),
      },
      productTelemetryEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      integration: { findFirst: jest.fn().mockResolvedValue(null) },
      portal: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (operation: any) => operation(prisma)),
    };
    const service = new OnboardingFunnelService(prisma, { get: () => options.key ?? key } as any);
    return { service, prisma, rows, getConsent: () => consent };
  }

  it('records only after consent and stores HMAC identifiers, not tenant identifiers', async () => {
    const { service, prisma } = harness({ consented: false });
    expect(await service.recordStage(workspaceId, OnboardingFunnelStage.CONNECTED)).toMatchObject({ recorded: false, reason: 'consent_required' });
    expect(prisma.onboardingFunnelEvent.create).not.toHaveBeenCalled();

    const optedIn = harness({ consented: true });
    expect(await optedIn.service.recordStage(workspaceId, OnboardingFunnelStage.CONNECTED)).toMatchObject({ recorded: true, duplicate: false });
    const stored = optedIn.prisma.onboardingFunnelEvent.create.mock.calls[0][0].data;
    expect(stored.journeyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.eventKey).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(workspaceId);
    expect(JSON.stringify(stored)).not.toContain(userId);
    expect(Object.keys(stored).sort()).toEqual(['eventKey', 'journeyKey', 'stage']);
  });

  it('deduplicates repeated first-stage events', async () => {
    const { service, rows } = harness({ consented: true });
    const first = await service.recordStage(workspaceId, OnboardingFunnelStage.FIRST_PUBLISH);
    const repeat = await service.recordStage(workspaceId, OnboardingFunnelStage.FIRST_PUBLISH);
    expect(first).toMatchObject({ recorded: true, duplicate: false });
    expect(repeat).toMatchObject({ recorded: true, duplicate: true });
    expect(rows.size).toBe(1);
  });

  it('does not record expired consent or when the server HMAC key is missing/weak', async () => {
    const expired = harness({ consented: true, expiresAt: new Date(Date.now() - 1000) });
    expect(await expired.service.recordStage(workspaceId, OnboardingFunnelStage.FIRST_CLIENT_VIEW)).toMatchObject({ recorded: false, reason: 'consent_required' });
    expect(expired.rows.size).toBe(0);
    const unconfigured = harness({ consented: true, key: 'too-short' });
    expect(await unconfigured.service.recordStage(workspaceId, OnboardingFunnelStage.REGISTERED)).toMatchObject({ recorded: false, reason: 'tracking_unconfigured' });
    expect(unconfigured.rows.size).toBe(0);
  });

  it('requires a workspace owner/admin to view or change consent and erases events on revocation', async () => {
    const denied = harness({ role: 'MEMBER', consented: true });
    await expect(denied.service.setConsent(workspaceId, userId, false)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(denied.service.getStatus(workspaceId, userId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(denied.prisma.gDPRConsent.update).not.toHaveBeenCalled();

    const allowed = harness({ consented: true });
    await allowed.service.recordStage(workspaceId, OnboardingFunnelStage.FIRST_DECISION);
    await allowed.service.setConsent(workspaceId, userId, false);
    expect(allowed.getConsent().consented).toBe(false);
    expect(allowed.rows.size).toBe(0);
    expect(allowed.prisma.onboardingFunnelEvent.deleteMany).toHaveBeenCalledWith({ where: { journeyKey: expect.any(String) } });
    expect(allowed.prisma.productTelemetryEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId,
        kind: { in: [
          'FEATURE_ADOPTION',
          'FEATURE_SUCCESS',
          'FEATURE_GUARDRAIL',
          'EXPERIMENT',
        ] },
      },
    });
  });

  it('denies a guessed workspace status request for another tenant', async () => {
    const { service, prisma } = harness({ consented: true });
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(service.getStatus('workspace-other-tenant', userId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: userId, workspaceId: 'workspace-other-tenant' },
      select: { role: true },
    });
  });

  it('reports only this workspace’s consented stage status and safe connection recovery state', async () => {
    const { service, prisma } = harness({ consented: true });
    prisma.integration.findFirst.mockResolvedValue({
      provider: 'GITHUB', connectionState: 'REAUTH_REQUIRED', lastSyncError: 'provider_auth_expired',
      lastValidDataAt: new Date('2026-01-01T00:00:00Z'), settings: { isDemo: false },
    });
    prisma.portal.findFirst.mockResolvedValue({ shareToken: 'fictional-token', publishedAt: null });
    await service.recordStage(workspaceId, OnboardingFunnelStage.CONNECTED);
    const status = await service.getStatus(workspaceId, userId);
    expect(status).toMatchObject({
      analyticsConsent: true,
      completedStages: 1,
      providerConnection: { state: 'REAUTH_REQUIRED', failureCode: 'provider_auth_expired', isDemo: false },
      demoClientPath: '/v/fictional-token',
    });
    expect(status.providerConnection?.nextAction).toContain('Reconnect or retry');
    expect(JSON.stringify(status)).not.toContain(workspaceId);
  });
});

