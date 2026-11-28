import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { ClientReportService } from './client-report.service';

describe('ClientReportService tenant scoping', () => {
  let prisma: any;
  let service: ClientReportService;

  beforeEach(() => {
    prisma = {
      clientReport: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'report-a', workspaceId: 'agency-a', status: 'DRAFT' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'report-new' }),
      },
      project: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'project-a', clientName: 'Fictional Client A' }),
      },
      portal: { findFirst: jest.fn().mockResolvedValue({ id: 'portal-a' }) },
      clientReportRevision: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new ClientReportService(prisma as PrismaService);
  });

  it('returns no report for a guessed ID from another tenant', async () => {
    prisma.clientReport.findFirst.mockResolvedValue(null);
    await expect(service.getReportById('guessable-report-b', 'agency-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.clientReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'guessable-report-b', workspaceId: 'agency-a' },
      }),
    );
  });

  it('rejects editing a report that is outside the caller workspace', async () => {
    prisma.clientReport.findFirst.mockResolvedValue(null);
    await expect(
      service.updateReport('report-b', 'agency-a', { executiveSummary: 'edited' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clientReport.updateMany).not.toHaveBeenCalled();
  });

  it('rejects project IDs belonging to another workspace when creating a draft', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(
      service.createReport({
        workspaceId: 'agency-a',
        projectId: 'project-b',
        title: 'Fictional briefing',
        clientName: 'Fictional B',
        reportType: 'WEEKLY' as any,
        recipientEmails: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clientReport.create).not.toHaveBeenCalled();
  });

  it('rejects a portal ID belonging to another workspace when creating a client-visible report', async () => {
    prisma.portal.findFirst.mockResolvedValue(null);
    await expect(service.createReport({
      workspaceId: 'agency-a', portalId: 'portal-b', title: 'Fictional briefing', clientName: 'Fictional A',
      reportType: 'WEEKLY' as any, recipientEmails: [],
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clientReport.create).not.toHaveBeenCalled();
  });

  it('filters client portal history to sent, consented revisions within its tenant and portal', async () => {
    await service.listDeliveredPortalReports('portal-a', 'agency-a');
    expect(prisma.clientReportRevision.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        notificationConsent: true,
        report: { portalId: 'portal-a', workspaceId: 'agency-a' },
        delivery: { status: 'SENT' },
      }),
      take: 50,
    }));
  });

  it('scopes an approved revision download through its owning workspace', async () => {
    await expect(service.getApprovedRevision('guessable-report-b', 1, 'agency-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clientReportRevision.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { reportId: 'guessable-report-b', version: 1, report: { workspaceId: 'agency-a' } },
    }));
  });
});
