import { NotFoundException } from '@nestjs/common';

import type { ValueLedgerService } from '../analytics/value-ledger.service';
import type { PrismaService } from '../prisma/prisma.service';

import { ExportService } from './export.service';

describe('value ledger export', () => {
  const portal = {
    id: 'portal-a',
    name: 'Fictional client',
    workspace: { name: 'Fictional agency' },
  };
  const visibleClaim = {
    revision: 2,
    title: 'Fictional savings',
    formula: 'time_saved_cost@1.0.0',
    calculation: 'hoursSaved × loadedHourlyRate',
    value: '300',
    unit: 'USD',
    period: {
      start: new Date('2026-10-01T00:00:00Z'),
      end: new Date('2026-11-01T00:00:00Z'),
      timeZone: 'UTC',
    },
    assumptions: {
      hoursSaved: {
        base: 6,
        unit: 'hours',
        evidence: {
          kind: 'HUMAN_NOTE',
          owner: 'Fictional owner',
          enteredAt: new Date().toISOString(),
          note: 'Fictional estimate',
        },
      },
    },
    sensitivity: { low: 160, base: 300, high: 480, unit: 'USD' },
    enteredBy: 'Fictional owner',
    enteredAt: new Date().toISOString(),
    approvedBy: 'Fictional admin',
    approvedAt: new Date().toISOString(),
    limitation: 'Scenario estimate only.',
  };

  function setup(foundPortal = portal) {
    const prisma = { portal: { findFirst: jest.fn().mockResolvedValue(foundPortal) } };
    const ledger = { publicClaims: jest.fn().mockResolvedValue([visibleClaim]) };
    return {
      prisma,
      ledger,
      service: new ExportService(
        prisma as unknown as PrismaService,
        ledger as unknown as ValueLedgerService,
      ),
    };
  }

  it('exports approved packet claims with formula, assumptions, period and limitations', async () => {
    const { service, prisma, ledger } = setup();
    const result = JSON.parse(
      (await service.exportClientValuePacket('portal-a', 'workspace-a')).toString('utf8'),
    );
    expect(prisma.portal.findFirst).toHaveBeenCalledWith({
      where: { id: 'portal-a', workspaceId: 'workspace-a', deletedAt: null },
      select: { id: true, name: true, workspace: { select: { name: true } } },
    });
    expect(ledger.publicClaims).toHaveBeenCalledWith('portal-a');
    expect(result.claims[0]).toMatchObject({
      formula: 'time_saved_cost@1.0.0',
      calculation: 'hoursSaved × loadedHourlyRate',
      unit: 'USD',
      sensitivity: { low: 160, base: 300, high: 480 },
      assumptions: expect.any(Object),
    });
    expect(result.calculationNotes).toHaveLength(3);
    expect(JSON.stringify(result)).not.toMatch(
      /workspaceId|createdById|approvedById|accessToken|password/i,
    );
  });

  it('does not export cross-tenant or revoked portals', async () => {
    const { service, ledger } = setup(null);
    await expect(
      service.exportClientValuePacket('foreign-portal', 'workspace-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ledger.publicClaims).not.toHaveBeenCalled();
  });
});
