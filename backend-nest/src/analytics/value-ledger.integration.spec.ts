import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import { ValueLedgerService } from './value-ledger.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const approvedTestDatabase = Boolean(
  parsedUrl &&
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname) &&
  parsedUrl.pathname.replace(/^\//, '') === 'pulse_test',
);
const suite =
  process.env.RUN_DB_INTEGRATION === 'true' && approvedTestDatabase ? describe : describe.skip;

suite('value ledger database contract', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new ValueLedgerService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  const workspaceId = '00000000-0000-4000-8000-000000000001';
  const otherWorkspaceId = '00000000-0000-4000-8000-000000000002';
  const portalId = '00000000-0000-4000-8000-000000000032';
  const foreignPortalId = '00000000-0000-4000-8000-000000000031';
  const userId = '00000000-0000-4000-8000-000000000011';
  const input = {
    portalId,
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
        label: 'Workshop estimate',
        note: 'Fictional client workshop assumption.',
      },
    },
    loadedHourlyRate: {
      low: 40,
      base: 50,
      high: 60,
      evidence: {
        kind: 'SOURCE_REFERENCE' as const,
        label: 'Rate card',
        reference: 'fixture:rate-card-v2',
      },
    },
  };

  beforeAll(async () => {
    await prisma.valueLedgerEntry.deleteMany({ where: { portalId } });
  });

  afterAll(async () => {
    await prisma.valueLedgerEntry.deleteMany({ where: { portalId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it('persists a new revision without overwriting the approved packet and enforces tenant scope', async () => {
    const first = await service.createDraft(workspaceId, userId, input);
    expect(first.revision).toBe(1);
    expect(first.resultValue.toString()).toBe('300');
    await service.approve(workspaceId, userId, first.id, 1, true);

    await expect(service.createDraft(workspaceId, userId, input)).rejects.toThrow(
      'Refresh before adding a revision',
    );
    const second = await service.createDraft(workspaceId, userId, {
      ...input,
      expectedRevision: 1,
      title: 'Revised fictional baseline',
    });
    expect(second.revision).toBe(2);
    expect(await prisma.valueLedgerEntry.count({ where: { portalId } })).toBe(2);
    await expect(service.approve(workspaceId, userId, second.id, 1, true)).rejects.toThrow(
      'changed',
    );

    await expect(
      service.createDraft(workspaceId, userId, { ...input, portalId: foreignPortalId }),
    ).rejects.toThrow('Portal not found');
    await expect(service.list(otherWorkspaceId, userId, portalId)).rejects.toThrow(
      'Owner or admin access',
    );
    const clientClaims = await service.publicClaims(portalId);
    expect(clientClaims).toHaveLength(1);
    expect(clientClaims[0]).toMatchObject({
      revision: 1,
      value: '300',
      enteredBy: 'Northstar Owner',
    });
    expect(clientClaims[0]).not.toHaveProperty('workspaceId');
    expect(clientClaims[0]).not.toHaveProperty('createdById');
  });
});
