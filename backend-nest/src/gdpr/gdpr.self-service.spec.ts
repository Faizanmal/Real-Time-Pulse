import { ConflictException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

import { GdprService } from './gdpr.service';

describe('GdprService self-service account controls', () => {
  const user = {
    id: 'user-a',
    workspaceId: 'workspace-a',
    email: 'a@fictional.invalid',
    name: 'Fictional Agency',
    role: 'OWNER',
  };
  let prisma: any;
  let service: GdprService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        count: jest.fn().mockResolvedValue(0),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'workspace-a',
          name: 'Sample Agency',
          slug: 'sample',
          createdAt: new Date(),
        }),
      },
      portal: { findMany: jest.fn().mockResolvedValue([]) },
      comment: { findMany: jest.fn().mockResolvedValue([]) },
      gDPRConsent: { findMany: jest.fn().mockResolvedValue([]) },
      gDPRDataRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({
          id: 'request-a',
          status: data.status,
          submittedAt: data.submittedAt,
          metadata: data.metadata,
        })),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'request-a', status: 'CANCELLED', submittedAt: new Date() }),
      },
      gDPRDataRequestAudit: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    const prismaRef: unknown = prisma;
    service = new GdprService(prismaRef as PrismaService);
  });

  it('exports only the authenticated user’s scoped records and no password/provider credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      password: 'must-not-export',
      apiKey: 'must-not-export',
    });
    const data = await service.exportSelfServiceData(user.id);
    expect(data.user).not.toHaveProperty('password');
    expect(data.user).not.toHaveProperty('apiKey');
    expect(prisma.portal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdById: user.id, workspaceId: user.workspaceId } }),
    );
    expect(JSON.stringify(data)).not.toContain('must-not-export');
  });

  it('requires ownership transfer before a workspace owner with other members can request deletion', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(service.requestSelfDeletion(user.id)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.gDPRDataRequest.create).not.toHaveBeenCalled();
  });

  it('creates an audited delayed request and only allows its owner to cancel it', async () => {
    const created = await service.requestSelfDeletion(user.id);
    expect(created.status).toBe('PENDING');
    expect((created.metadata as any).requiresBillingAndTenantReview).toBe(true);
    expect(prisma.gDPRDataRequestAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ performedBy: user.id }) }),
    );

    prisma.gDPRDataRequest.findFirst.mockResolvedValue({ id: 'request-a', status: 'PENDING' });
    const cancelled = await service.cancelSelfDeletion(user.id, 'request-a');
    expect(cancelled.status).toBe('CANCELLED');
    expect(prisma.gDPRDataRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'request-a',
          workspaceId: user.workspaceId,
          requesterEmail: user.email,
        }),
      }),
    );

    prisma.gDPRDataRequest.findFirst.mockResolvedValue(null);
    await expect(service.cancelSelfDeletion('other-user', 'request-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
