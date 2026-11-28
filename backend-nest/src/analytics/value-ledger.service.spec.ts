import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';

import { calculateTimeSavedCost, ValueLedgerService } from './value-ledger.service';

describe('value ledger', () => {
  const owner = {
    id: 'owner-a',
    workspaceId: 'workspace-a',
    role: 'OWNER',
    email: 'owner@example.test',
    firstName: 'Fictional',
    lastName: 'Owner',
    name: null,
  };
  const draftInput = {
    portalId: 'portal-a',
    expectedRevision: 0,
    title: 'Fictional monthly workflow savings',
    periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-11-01T00:00:00.000Z',
    timeZone: 'America/New_York',
    hoursSaved: {
      low: 4,
      base: 6,
      high: 8,
      evidence: {
        kind: 'HUMAN_NOTE' as const,
        label: 'Agency time study',
        note: 'Fictional estimate from a client workshop.',
      },
    },
    loadedHourlyRate: {
      low: 40,
      base: 50,
      high: 60,
      evidence: {
        kind: 'SOURCE_REFERENCE' as const,
        label: 'Fictional rate card',
        reference: 'rate-card:v3',
      },
    },
  };

  function setup() {
    let row: Record<string, unknown> | null = null;
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(owner) },
      portal: { findFirst: jest.fn().mockResolvedValue({ id: 'portal-a' }) },
      valueLedgerEntry: {
        findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          if ('id' in where) return Promise.resolve(row);
          return Promise.resolve(row ? { revision: row.revision } : null);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(row ? [row] : [])),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          row = { id: 'claim-a', ...data };
          return Promise.resolve(row);
        }),
        updateMany: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          if (!row || row.status !== 'DRAFT') return Promise.resolve({ count: 0 });
          row = { ...row, ...data };
          return Promise.resolve({ count: 1 });
        }),
        findFirstOrThrow: jest.fn().mockImplementation(() => Promise.resolve(row)),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return {
      prisma,
      audit,
      service: new ValueLedgerService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
      ),
      getRow: () => row,
    };
  }

  it('calculates fixed low/base/high scenarios and rounds deterministically', () => {
    expect(calculateTimeSavedCost(draftInput)).toEqual({
      formula: 'hoursSaved × loadedHourlyRate',
      unit: 'USD',
      low: 160,
      base: 300,
      high: 480,
    });
    expect(() =>
      calculateTimeSavedCost({
        ...draftInput,
        hoursSaved: { ...draftInput.hoursSaved, low: 7 },
      }),
    ).toThrow('0 <= low <= base <= high');
  });

  it('creates a versioned draft with actor/date evidence and refuses a stale retry', async () => {
    const { service, getRow, audit } = setup();
    const created = await service.createDraft('workspace-a', 'owner-a', draftInput);
    expect(created).toMatchObject({
      revision: 1,
      formulaKey: 'time_saved_cost',
      resultValue: 300,
      status: 'DRAFT',
    });
    expect(created.assumptions).toMatchObject({
      hoursSaved: {
        unit: 'hours',
        evidence: { owner: 'Fictional Owner', enteredAt: expect.any(String) },
      },
      loadedHourlyRate: { unit: 'USD/hour', evidence: { reference: 'rate-card:v3' } },
    });
    expect(audit.log).toHaveBeenCalledTimes(1);
    await expect(service.createDraft('workspace-a', 'owner-a', draftInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(getRow()?.revision).toBe(1);
  });

  it('appends a later baseline revision rather than overwriting the prior report', async () => {
    const { service, prisma } = setup();
    await service.createDraft('workspace-a', 'owner-a', draftInput);
    const revisedInput = {
      ...draftInput,
      expectedRevision: 1,
      title: 'Revised fictional baseline',
      formulaKey: 'arbitrary_roi',
    };
    const revised = await service.createDraft('workspace-a', 'owner-a', revisedInput);
    expect(revised).toMatchObject({
      revision: 2,
      title: 'Revised fictional baseline',
      formulaKey: 'time_saved_cost',
    });
    expect(prisma.valueLedgerEntry.create).toHaveBeenCalledTimes(2);
    expect(prisma.valueLedgerEntry.create.mock.calls.map(([call]) => call.data.revision)).toEqual([
      1, 2,
    ]);
  });

  it('denies members and hides another tenant or revoked portal', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.createDraft('workspace-a', 'member-a', draftInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.user.findFirst.mockResolvedValue(owner);
    prisma.portal.findFirst.mockResolvedValue(null);
    await expect(
      service.createDraft('workspace-b', 'owner-a', { ...draftInput, portalId: 'portal-b' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.list('workspace-b', 'owner-a', 'portal-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects invalid periods, unsupported timezone, unsupported formulas and unproven assumptions', async () => {
    const { service } = setup();
    await expect(
      service.createDraft('workspace-a', 'owner-a', {
        ...draftInput,
        periodEnd: draftInput.periodStart,
      }),
    ).rejects.toThrow('later end time');
    await expect(
      service.createDraft('workspace-a', 'owner-a', { ...draftInput, timeZone: 'Mars/Olympus' }),
    ).rejects.toThrow('IANA time zone');
    await expect(
      service.createDraft('workspace-a', 'owner-a', {
        ...draftInput,
        hoursSaved: {
          ...draftInput.hoursSaved,
          evidence: { kind: 'HUMAN_NOTE', label: 'Note', note: 'password=not-a-secret' },
        },
      }),
    ).rejects.toThrow('credentials or personal contact details');
    await expect(
      service.createDraft('workspace-a', 'owner-a', {
        ...draftInput,
        loadedHourlyRate: {
          ...draftInput.loadedHourlyRate,
          evidence: {
            kind: 'SOURCE_REFERENCE',
            label: 'Source',
            reference: 'https://private.invalid/?token=abc',
          },
        },
      }),
    ).rejects.toThrow('source identifier');
    await expect(
      service.createDraft('workspace-a', 'owner-a', {
        ...draftInput,
        title: 'Claim for owner@example.invalid',
      }),
    ).rejects.toThrow('claim title');
  });

  it('approves once, blocks stale drafts and keeps approved content immutable', async () => {
    const { service, audit } = setup();
    await service.createDraft('workspace-a', 'owner-a', draftInput);
    const approved = await service.approve('workspace-a', 'owner-a', 'claim-a', 1, true);
    expect(approved).toMatchObject({
      status: 'APPROVED',
      clientVisible: true,
      approvedByLabel: 'Fictional Owner',
    });
    await expect(service.approve('workspace-a', 'owner-a', 'claim-a', 1, true)).resolves.toEqual(
      approved,
    );
    await expect(
      service.approve('workspace-a', 'owner-a', 'claim-a', 1, false),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).toHaveBeenCalledTimes(2);
  });

  it('publishes only approved client-visible claims and omits tenant/user internals', async () => {
    const { service } = setup();
    await service.createDraft('workspace-a', 'owner-a', draftInput);
    await service.approve('workspace-a', 'owner-a', 'claim-a', 1, true);
    const [claim] = await service.publicClaims('portal-a');
    expect(claim).toMatchObject({
      revision: 1,
      value: '300',
      formula: 'time_saved_cost@1.0.0',
      calculation: 'hoursSaved × loadedHourlyRate',
      enteredBy: 'Fictional Owner',
      assumptions: expect.objectContaining({
        hoursSaved: expect.objectContaining({
          evidence: expect.objectContaining({
            note: expect.any(String),
            owner: 'Fictional Owner',
            enteredAt: expect.any(String),
          }),
        }),
      }),
    });
    expect(claim).not.toHaveProperty('workspaceId');
    expect(claim).not.toHaveProperty('createdById');
    expect(claim).not.toHaveProperty('approvedById');
  });
});
