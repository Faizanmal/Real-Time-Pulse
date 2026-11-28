import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';

import { AIInsightsService } from './ai-insights.service';

describe('AIInsightsService acknowledgement security', () => {
  const actor = { id: 'owner-a', workspaceId: 'agency-a', role: 'OWNER' };
  const insight = { id: 'risk-a', workspaceId: 'agency-a', status: 'NEW' };
  let prisma: any;
  let service: AIInsightsService;

  beforeEach(() => {
    const tx = {
      aIInsight: {
        update: jest.fn().mockResolvedValue({ ...insight, status: 'ACTIONED' }),
        findFirst: jest.fn().mockResolvedValue({ ...insight, status: 'ACTIONED' }),
      },
      aIFeedback: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    };
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: actor.id }) },
      aIInsight: { findFirst: jest.fn().mockResolvedValue(insight) },
      $transaction: jest.fn((callback) => callback(tx)),
      tx,
    };
    service = new AIInsightsService(
      prisma as PrismaService,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it('denies a non-owner/admin actor before changing status', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.actionInsight('risk-a', 'member-a', 'agency-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns not found for another tenant resource IDs', async () => {
    prisma.aIInsight.findFirst.mockResolvedValue(null);
    await expect(
      service.actionInsight('guessable-other-tenant-id', 'owner-a', 'agency-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps the insight row and appends an acknowledgement audit record', async () => {
    await service.actionInsight('risk-a', actor.id, actor.workspaceId);
    expect(prisma.aIInsight.findFirst).toHaveBeenCalledWith({
      where: { id: 'risk-a', workspaceId: 'agency-a' },
    });
    expect(prisma.tx.aIInsight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'risk-a' },
        data: expect.objectContaining({ status: 'ACTIONED' }),
      }),
    );
    expect(prisma.tx.aIFeedback.create).toHaveBeenCalledWith({
      data: {
        insightId: 'risk-a',
        userId: 'owner-a',
        rating: 'acknowledged',
        actionTaken: 'ACTIONED',
      },
    });
  });

  it('does not append duplicate feedback when the same acknowledgement is retried', async () => {
    prisma.aIInsight.findFirst.mockResolvedValue({ ...insight, status: 'ACTIONED' });
    await service.actionInsight('risk-a', actor.id, actor.workspaceId);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes confidence risk lookup to the caller workspace', async () => {
    prisma.portal = { findFirst: jest.fn().mockResolvedValue(null) };
    await expect(
      service.getPortalConfidenceRisk('portal-from-another-tenant', 'agency-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.portal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'portal-from-another-tenant', workspaceId: 'agency-a', deletedAt: null },
      }),
    );
  });
});
