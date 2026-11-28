jest.mock('../integrations/integration.service', () => ({
  IntegrationService: class IntegrationService {},
}));

import { ForbiddenException } from '@nestjs/common';

import type { CacheService } from '../cache/cache.service';
import type { IntegrationService } from '../integrations/integration.service';
import type { PrismaService } from '../prisma/prisma.service';

import { CreateWidgetDto } from './dto/widget.dto';
import { WidgetService } from './widget.service';

describe('WidgetService commercial limits', () => {
  const dto = {
    portalId: 'portal-a',
    name: 'Sample widget',
    type: 'CHART',
    config: {},
  } as CreateWidgetDto;
  let prisma: any;
  let service: WidgetService;

  beforeEach(() => {
    prisma = {
      portal: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'portal-a', workspaceId: 'workspace-a', deletedAt: null }),
      },
      subscription: { findUnique: jest.fn().mockResolvedValue({ plan: 'TRIAL' }) },
      widget: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'widget-a',
          name: dto.name,
          type: dto.type,
          config: {},
          portalId: dto.portalId,
        }),
      },
    };
    const prismaRef: unknown = prisma;
    service = new WidgetService(
      prismaRef as PrismaService,
      { invalidatePortal: jest.fn() } as unknown as CacheService,
      {} as IntegrationService,
    );
  });

  it('enforces the server-side widget cap even when the caller bypasses UI controls', async () => {
    prisma.widget.count.mockResolvedValue(25);
    await expect(service.create('workspace-a', dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.widget.create).not.toHaveBeenCalled();
  });

  it('denies a guessed portal ID from another tenant before checking limits or creating data', async () => {
    prisma.portal.findUnique.mockResolvedValue({
      id: 'portal-a',
      workspaceId: 'workspace-b',
      deletedAt: null,
    });
    await expect(service.create('workspace-a', dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
    expect(prisma.widget.create).not.toHaveBeenCalled();
  });

  it('permits a valid tenant request under its plan cap', async () => {
    await expect(service.create('workspace-a', dto)).resolves.toMatchObject({ id: 'widget-a' });
    expect(prisma.widget.count).toHaveBeenCalledWith({
      where: { portal: { workspaceId: 'workspace-a' } },
    });
  });
});
