import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { DemoConnectorService } from '../integrations/services/demo-connector.service';
import { IntegrationService } from '../integrations/integration.service';
import { PrismaService } from '../prisma/prisma.service';

import { PortalService } from './portal.service';

jest.mock('uuid', () => ({ v4: () => 'test-share-token' }));
jest.mock('../integrations/integration.service', () => ({ IntegrationService: class {} }));

describe('PortalService demo client path', () => {
  const demoConnector = new DemoConnectorService();
  const integrationService = {
    fetchData: jest.fn().mockImplementation(async () => demoConnector.fetchData('metrics')),
  } as unknown as IntegrationService;

  it('denies a user from a different workspace before starting a create transaction', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-a', workspaceId: 'workspace-a', role: 'OWNER' }) },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integrationService, demoConnector, { invalidatePortal: jest.fn() } as any);

    await expect(service.createDemoClientPortal('workspace-b', 'user-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('denies a regular workspace member from creating the agency demo portal', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'client-a', workspaceId: 'workspace-a', role: 'MEMBER' }) },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integrationService, demoConnector, { invalidatePortal: jest.fn() } as any);

    await expect(service.createDemoClientPortal('workspace-a', 'client-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not expose a private share token through the public view endpoint', async () => {
    const prisma = {
      portal: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integrationService, demoConnector, { invalidatePortal: jest.fn() } as any);

    await expect(service.findPublicViewByShareToken('private-token')).rejects.toBeInstanceOf(NotFoundException);
    expect(integrationService.fetchData).not.toHaveBeenCalled();
  });

  it('returns only allowlisted portal fields from the legacy public token endpoint', async () => {
    const prisma = {
      portal: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'portal-a', name: 'Shared portal', description: 'Public summary',
          shareToken: 'must-not-return', workspaceId: 'private-workspace', layout: { internal: true },
          isPublic: true,
          workspace: { name: 'Agency', primaryColor: '#123456' },
          widgets: [{ id: 'widget-a', name: 'Public metric', type: 'KPI', integration: { id: 'integration-a', provider: 'DEMO' }, config: { secret: 'must-not-return' } }],
        }),
      },
    } as unknown as PrismaService;
    const service = new PortalService(prisma, integrationService, demoConnector, { invalidatePortal: jest.fn() } as any);

    const result = await service.findByShareToken('old-shared-token');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('must-not-return');
    expect(serialized).not.toContain('private-workspace');
    expect(result.widgets[0]).toMatchObject({ id: 'widget-a', name: 'Public metric', type: 'KPI' });
  });
});
