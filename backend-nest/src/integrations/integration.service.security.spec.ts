import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

jest.mock('../jobs/jobs.service', () => ({ JobsService: class JobsService {} }));

import { IntegrationService } from './integration.service';

describe('IntegrationService workspace access', () => {
  const makeService = (integration: { workspaceId: string } | null) => {
    const prisma = { integration: { findUnique: jest.fn().mockResolvedValue(integration) } } as unknown as PrismaService;
    const service = Object.create(IntegrationService.prototype) as IntegrationService;
    Object.defineProperty(service, 'prisma', { value: prisma });
    return { service, prisma };
  };

  it('denies an integration id belonging to another workspace', async () => {
    const { service } = makeService({ workspaceId: 'workspace-b' });
    await expect(service.assertWorkspaceAccess('integration-b', 'workspace-a')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for a stale integration id', async () => {
    const { service } = makeService(null);
    await expect(service.assertWorkspaceAccess('deleted-integration', 'workspace-a')).rejects.toBeInstanceOf(NotFoundException);
  });
});
