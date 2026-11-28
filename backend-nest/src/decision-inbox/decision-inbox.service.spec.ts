import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientDecisionResponseKind, ClientDecisionStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ShareLinksService } from '../share-links/share-links.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_HOUR: '0 0 * * * *' },
}));
jest.mock('../share-links/share-links.service', () => ({
  ShareLinksService: class ShareLinksService {},
}));

import { DecisionInboxService } from './decision-inbox.service';

const portalSnapshot = { portal: 'Fictional client report', widgets: [{ id: 'fixture-widget' }] };
const openedDecision = {
  id: 'decision-a',
  workspaceId: 'agency-a',
  portalId: 'portal-a',
  sourceShareLinkId: 'link-a',
  clientUserId: 'client-a',
  createdById: 'owner-a',
  title: 'Approve fictional campaign brief',
  prompt: 'Approve the published version?',
  portalRevision: 4,
  snapshotDigest: 'fixture-digest',
  status: ClientDecisionStatus.OPEN,
  dueAt: new Date('2026-03-09T12:00:00.000Z'),
  reminderCount: 0,
  lastReminderAt: null,
  response: null,
};

describe('DecisionInboxService', () => {
  let service: DecisionInboxService;
  let prisma: any;
  let tx: any;
  let shareLinks: any;

  beforeEach(() => {
    tx = {
      shareLink: { findFirst: jest.fn() },
      portal: { findFirst: jest.fn() },
      clientDecision: {
        create: jest.fn().mockResolvedValue(openedDecision),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...openedDecision, timeline: [] }),
        findFirst: jest.fn().mockResolvedValue(openedDecision),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clientDecisionResponse: { create: jest.fn() },
      decisionTimelineEvent: { create: jest.fn().mockResolvedValue({ id: 'event-a' }) },
      decisionReminder: { create: jest.fn() },
      notification: { create: jest.fn() },
    };
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ role: 'OWNER' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      portal: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      shareLink: { findFirst: jest.fn() },
      clientDecision: { findMany: jest.fn().mockResolvedValue([]) },
      decisionEscalationPolicy: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    };
    shareLinks = {
      requireDecisionCapability: jest.fn().mockResolvedValue({
        id: 'link-a',
        portal: { id: 'portal-a', workspaceId: 'agency-a' },
      }),
    };
    service = new DecisionInboxService(prisma as PrismaService, shareLinks as ShareLinksService);
  });

  it('creates an immutable request bound to the current published portal revision', async () => {
    tx.shareLink.findFirst.mockResolvedValue({
      id: 'link-a',
      portal: {
        id: 'portal-a',
        workspaceId: 'agency-a',
        publishedAt: new Date('2026-03-08T12:00:00.000Z'),
        publishedSnapshot: portalSnapshot,
        publishRevision: 4,
      },
    });
    const result = await service.create('agency-a', 'owner-a', {
      sourceShareLinkId: 'link-a',
      clientUserId: 'client-a',
      title: ' Approve fictional campaign brief ',
      prompt: ' Approve the published version? ',
    });
    expect(result.portalRevision).toBe(4);
    expect(tx.clientDecision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: 'agency-a', portalId: 'portal-a', clientUserId: 'client-a', portalRevision: 4, snapshotDigest: expect.any(String) }),
    }));
    expect(tx.decisionTimelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        decisionId: 'decision-a',
        workspaceId: 'agency-a',
        resourceId: 'decision-a',
        revision: 4,
        version: 1,
        eventType: 'REQUESTED',
        actorId: 'owner-a',
      }),
    }));
  });

  it('rejects an agency user without owner/admin permission and never queries the link', async () => {
    prisma.user.findFirst.mockResolvedValue({ role: 'MEMBER' });
    await expect(service.create('agency-a', 'member-a', {
      sourceShareLinkId: 'link-a', clientUserId: 'client-a', title: 'Review', prompt: 'Approve?',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a link not scoped to the caller workspace or assigned client', async () => {
    tx.shareLink.findFirst.mockResolvedValue(null);
    await expect(service.create('agency-a', 'owner-a', {
      sourceShareLinkId: 'foreign-link', clientUserId: 'client-b', title: 'Review', prompt: 'Approve?',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.clientDecision.create).not.toHaveBeenCalled();
  });

  it('returns an allowlisted client decision projection without agency or capability identifiers', async () => {
    prisma.portal.findFirst.mockResolvedValue({ publishRevision: 4 });
    prisma.clientDecision.findMany.mockResolvedValue([{
      ...openedDecision,
      timeline: [{
        eventId: 'event-a',
        version: 1,
        revision: 4,
        workspaceId: 'agency-a',
        resourceType: 'CLIENT_DECISION',
        resourceId: 'decision-a',
        eventType: 'REQUESTED',
        actorType: 'AGENCY',
        actorId: 'owner-a',
        details: { private: 'fixture details' },
        serverTimestamp: new Date('2026-03-09T12:00:00.000Z'),
      }],
    }]);
    const result = await service.listClient('token-a', undefined, 'client-a');
    expect(result.decisions[0]).toMatchObject({ id: 'decision-a', canRespond: true, currentPortalRevision: 4 });
    const projection = JSON.stringify(result);
    expect(projection).not.toMatch(/workspaceId|sourceShareLinkId|clientUserId|snapshotDigest|actorId|private details/);
    expect(projection).toContain('event-a');
  });

  it('requires a fresh response revision when the published portal changed', async () => {
    tx.clientDecision.findFirst.mockResolvedValue(openedDecision);
    tx.shareLink.findFirst.mockResolvedValue({ id: 'link-a' });
    tx.portal.findFirst.mockResolvedValue({
      publishRevision: 5,
      publishedAt: new Date(),
      publishedSnapshot: { changed: true },
    });
    await expect(service.respond('token-a', 'decision-a', 'client-a', {
      expectedRevision: 4,
      response: ClientDecisionResponseKind.APPROVE,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.clientDecisionResponse.create).not.toHaveBeenCalled();
  });

  it('returns the same exact response on retry without appending another response or event', async () => {
    const immutableResponse = {
      responderUserId: 'client-a',
      response: ClientDecisionResponseKind.APPROVE,
      comment: 'Looks good',
      portalRevision: 4,
      createdAt: new Date('2026-03-09T14:00:00.000Z'),
    };
    tx.clientDecision.findFirst.mockResolvedValue({ ...openedDecision, status: ClientDecisionStatus.APPROVED, response: immutableResponse });
    const result = await service.respond('token-a', 'decision-a', 'client-a', {
      expectedRevision: 4,
      response: ClientDecisionResponseKind.APPROVE,
      comment: 'Looks good',
    });
    expect(result).toEqual(expect.objectContaining({ response: immutableResponse, idempotent: true }));
    expect(tx.clientDecisionResponse.create).not.toHaveBeenCalled();
    expect(tx.decisionTimelineEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a different second response instead of rewriting client history', async () => {
    tx.clientDecision.findFirst.mockResolvedValue({
      ...openedDecision,
      response: { responderUserId: 'client-a', response: ClientDecisionResponseKind.APPROVE, comment: null, portalRevision: 4 },
    });
    await expect(service.respond('token-a', 'decision-a', 'client-a', {
      expectedRevision: 4,
      response: ClientDecisionResponseKind.DECLINE,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not respond after the assigned link has expired or been revoked', async () => {
    shareLinks.requireDecisionCapability.mockRejectedValue(new ForbiddenException('expired or revoked'));
    await expect(service.respond('old-token', 'decision-a', 'client-a', {
      expectedRevision: 4,
      response: ClientDecisionResponseKind.APPROVE,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid IANA timezones and reminders without explicit opt-in', async () => {
    await expect(service.updatePolicy('agency-a', 'owner-a', {
      timeZone: 'Not/A_Zone',
    })).rejects.toThrow('valid IANA time zone');
    await expect(service.updatePolicy('agency-a', 'owner-a', {
      enabled: true,
      notificationOptIn: false,
    })).rejects.toThrow('explicit notification opt-in');
    expect(prisma.decisionEscalationPolicy.upsert).not.toHaveBeenCalled();
  });

  it('suppresses simultaneous duplicate reminder jobs with the conditional count update', async () => {
    const now = new Date('2026-03-09T13:30:00.000Z');
    const policy = {
      workspaceId: 'agency-a',
      enabled: true,
      notificationOptIn: true,
      timeZone: 'America/New_York',
      businessDays: [1, 2, 3, 4, 5],
      businessHoursStart: '09:00',
      businessHoursEnd: '17:00',
      reminderIntervalMinutes: 1440,
      maxReminders: 3,
    };
    prisma.decisionEscalationPolicy.findMany.mockResolvedValue([policy]);
    prisma.clientDecision.findMany.mockResolvedValue([openedDecision]);
    tx.shareLink.findFirst.mockResolvedValue({ token: 'fixture-link-token' });
    tx.clientDecision.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      service.processEscalations(now),
      service.processEscalations(now),
    ]);
    expect(results.reduce((sum, result) => sum + result.created, 0)).toBe(1);
    expect(tx.decisionReminder.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.decisionTimelineEvent.create).toHaveBeenCalledTimes(1);
  });
});
