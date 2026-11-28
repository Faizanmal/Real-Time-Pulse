import { ForbiddenException } from '@nestjs/common';

jest.mock('../share-links/share-links.service', () => ({ ShareLinksService: class ShareLinksService {} }));

import { ClientReportPublicController } from './client-report-public.controller';

describe('ClientReportPublicController', () => {
  const listDeliveredPortalReports = jest.fn();
  const requireAssignedReportCapability = jest.fn();
  let controller: ClientReportPublicController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClientReportPublicController(
      { listDeliveredPortalReports } as any,
      { requireAssignedReportCapability } as any,
    );
    requireAssignedReportCapability.mockResolvedValue({ portalId: 'portal-a', portal: { workspaceId: 'agency-a' } });
    listDeliveredPortalReports.mockResolvedValue([{ version: 1, title: 'Fictional report' }]);
  });

  it('requires a signed-in assigned client before returning a report', async () => {
    await expect(controller.list('opaque-token', {}, { user: undefined } as any, { set: jest.fn() } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(requireAssignedReportCapability).not.toHaveBeenCalled();
    expect(listDeliveredPortalReports).not.toHaveBeenCalled();
  });

  it('binds report lookup to the portal returned by the validated share link', async () => {
    await expect(controller.list('opaque-token', { password: 'fictional-secret' }, {
      user: { id: 'client-a', workspaceId: 'agency-a', role: 'MEMBER' },
    } as any, { set: jest.fn() } as any)).resolves.toEqual([{ version: 1, title: 'Fictional report' }]);
    expect(requireAssignedReportCapability).toHaveBeenCalledWith('opaque-token', 'fictional-secret', 'client-a');
    expect(listDeliveredPortalReports).toHaveBeenCalledWith('portal-a', 'agency-a');
  });

  it('does not retrieve report rows when assignment validation denies another tenant', async () => {
    requireAssignedReportCapability.mockRejectedValue(new ForbiddenException());
    await expect(controller.list('guessed-token', {}, { user: { id: 'client-b' } } as any, { set: jest.fn() } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(listDeliveredPortalReports).not.toHaveBeenCalled();
  });
});
