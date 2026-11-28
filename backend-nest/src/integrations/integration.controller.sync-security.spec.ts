import { ForbiddenException } from '@nestjs/common';

jest.mock('../jobs/jobs.service', () => ({ JobsService: class JobsService {} }));

import { IntegrationController } from './integration.controller';

describe('IntegrationController sync tenant boundaries', () => {
  it('denies sync metrics for another workspace before consulting the service', async () => {
    const integrationService = { getSyncFreshness: jest.fn() };
    const controller = new IntegrationController(integrationService as any);
    await expect(controller.getSyncFreshness('workspace-b', { workspaceId: 'workspace-a' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(integrationService.getSyncFreshness).not.toHaveBeenCalled();
  });

  it('rejects stale connector identifiers before triggering replay', async () => {
    const integrationService = {
      assertWorkspaceAccess: jest.fn().mockRejectedValue(new Error('Integration not found')),
      triggerSync: jest.fn(),
    };
    const controller = new IntegrationController(integrationService as any);
    await expect(controller.triggerSync('stale-connector-id', { syncType: 'full' }, { workspaceId: 'workspace-a' } as any)).rejects.toThrow('Integration not found');
    expect(integrationService.triggerSync).not.toHaveBeenCalled();
  });
});
