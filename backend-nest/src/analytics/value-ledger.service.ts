import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ValueLedgerStatus } from '@prisma/client';
import type { ValueLedgerEntry } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type EvidenceInput =
  | { kind: 'SOURCE_REFERENCE'; label: string; reference: string }
  | { kind: 'HUMAN_NOTE'; label: string; note: string };

type RangeInput = { low: number; base: number; high: number; evidence: EvidenceInput };

export interface CreateValueLedgerInput {
  portalId: string;
  expectedRevision: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  timeZone: string;
  hoursSaved: RangeInput;
  loadedHourlyRate: RangeInput;
}

const FORMULA_KEY = 'time_saved_cost';
const FORMULA_VERSION = '1.0.0';
const CURRENCY = 'USD';
const SENSITIVE_TEXT =
  /password\s*[:=]|secret\s*[:=]|token\s*[:=]|api[_-]?key\s*[:=]|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;

export function calculateTimeSavedCost(input: {
  hoursSaved: RangeInput;
  loadedHourlyRate: RangeInput;
}) {
  const validateRange = (range: RangeInput, name: string) => {
    if (!range || ![range.low, range.base, range.high].every(Number.isFinite)) {
      throw new BadRequestException(`${name} must contain finite low, base and high values`);
    }
    if (range.low < 0 || range.low > range.base || range.base > range.high) {
      throw new BadRequestException(`${name} must satisfy 0 <= low <= base <= high`);
    }
  };
  validateRange(input.hoursSaved, 'Hours saved');
  validateRange(input.loadedHourlyRate, 'Loaded hourly rate');
  return {
    formula: 'hoursSaved × loadedHourlyRate',
    unit: CURRENCY,
    low: roundValue(input.hoursSaved.low * input.loadedHourlyRate.low),
    base: roundValue(input.hoursSaved.base * input.loadedHourlyRate.base),
    high: roundValue(input.hoursSaved.high * input.loadedHourlyRate.high),
  };
}

function roundValue(value: number) {
  return Number(value.toFixed(6));
}

@Injectable()
export class ValueLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string, userId: string, portalId: string) {
    await this.requireAgencyOwner(workspaceId, userId);
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!portal) throw new NotFoundException('Portal not found');
    return this.prisma.valueLedgerEntry.findMany({
      where: { workspaceId, portalId },
      orderBy: { revision: 'desc' },
    });
  }

  async createDraft(workspaceId: string, userId: string, input: CreateValueLedgerInput) {
    await this.requireAgencyOwner(workspaceId, userId);
    const portal = await this.prisma.portal.findFirst({
      where: { id: input.portalId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!portal) throw new NotFoundException('Portal not found');
    this.validateInput(input);

    const [latest, actor] = await Promise.all([
      this.prisma.valueLedgerEntry.findFirst({
        where: { workspaceId, portalId: portal.id },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      }),
      this.actor(workspaceId, userId),
    ]);
    const currentRevision = latest?.revision ?? 0;
    if (input.expectedRevision !== currentRevision) {
      throw new ConflictException('Value ledger changed. Refresh before adding a revision.');
    }

    const now = new Date();
    const assumptions = {
      hoursSaved: this.withEvidence(input.hoursSaved, 'hours', actor.label, now),
      loadedHourlyRate: this.withEvidence(input.loadedHourlyRate, 'USD/hour', actor.label, now),
    };
    const sensitivity = calculateTimeSavedCost(input);
    let entry: ValueLedgerEntry;
    try {
      entry = await this.prisma.valueLedgerEntry.create({
        data: {
          workspaceId,
          portalId: portal.id,
          revision: currentRevision + 1,
          title: input.title.trim(),
          formulaKey: FORMULA_KEY,
          formulaVersion: FORMULA_VERSION,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          timeZone: input.timeZone,
          resultValue: sensitivity.base,
          unit: CURRENCY,
          assumptions: assumptions,
          sensitivity: sensitivity,
          status: ValueLedgerStatus.DRAFT,
          createdById: userId,
          createdByLabel: actor.label,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Value ledger changed. Refresh before adding a revision.');
      }
      throw error;
    }
    await this.audit.log({
      workspaceId,
      userId,
      userEmail: actor.email,
      action: 'CREATE',
      entity: 'ValueLedgerEntry',
      entityId: entry.id,
      method: 'POST',
      endpoint: '/api/v1/analytics/value-ledger',
      newValues: {
        revision: entry.revision,
        formulaKey: FORMULA_KEY,
        formulaVersion: FORMULA_VERSION,
        status: entry.status,
      },
    });
    return entry;
  }

  async approve(
    workspaceId: string,
    userId: string,
    entryId: string,
    expectedRevision: number,
    clientVisible: boolean,
  ) {
    await this.requireAgencyOwner(workspaceId, userId);
    if (!Number.isInteger(expectedRevision) || typeof clientVisible !== 'boolean') {
      throw new BadRequestException('A revision and client visibility choice are required');
    }
    const existing = await this.prisma.valueLedgerEntry.findFirst({
      where: { id: entryId, workspaceId, portal: { deletedAt: null } },
    });
    if (!existing) throw new NotFoundException('Value ledger entry not found');
    if (existing.revision !== expectedRevision) {
      throw new ConflictException('Value claim changed. Refresh before approving.');
    }
    const latest = await this.prisma.valueLedgerEntry.findFirst({
      where: { workspaceId, portalId: existing.portalId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });
    if (latest?.revision !== existing.revision) {
      throw new ConflictException('A newer value claim exists. Refresh before approving.');
    }
    if (existing.status === ValueLedgerStatus.APPROVED) {
      if (existing.clientVisible === clientVisible) return existing;
      throw new ConflictException(
        'Approved claims are immutable; create a new revision to change sharing.',
      );
    }
    const actor = await this.actor(workspaceId, userId);
    const updated = await this.prisma.valueLedgerEntry.updateMany({
      where: {
        id: entryId,
        workspaceId,
        revision: expectedRevision,
        status: ValueLedgerStatus.DRAFT,
      },
      data: {
        status: ValueLedgerStatus.APPROVED,
        clientVisible,
        approvedById: userId,
        approvedByLabel: actor.label,
        approvedAt: new Date(),
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('Value claim changed. Refresh before approving.');
    const approved = await this.prisma.valueLedgerEntry.findFirstOrThrow({
      where: { id: entryId, workspaceId },
    });
    await this.audit.log({
      workspaceId,
      userId,
      userEmail: actor.email,
      action: 'UPDATE',
      entity: 'ValueLedgerEntry',
      entityId: entryId,
      method: 'POST',
      endpoint: '/api/v1/analytics/value-ledger/:id/approve',
      newValues: {
        revision: approved.revision,
        status: approved.status,
        clientVisible: approved.clientVisible,
      },
    });
    return approved;
  }

  async publicClaims(portalId: string) {
    const rows = await this.prisma.valueLedgerEntry.findMany({
      where: {
        portalId,
        status: ValueLedgerStatus.APPROVED,
        clientVisible: true,
        portal: { deletedAt: null },
      },
      orderBy: { revision: 'desc' },
    });
    return rows.map((row) => ({
      revision: row.revision,
      title: row.title,
      formula: `${row.formulaKey}@${row.formulaVersion}`,
      calculation: (row.sensitivity as { formula?: string }).formula ?? 'Formula unavailable',
      value: row.resultValue.toString(),
      unit: row.unit,
      period: { start: row.periodStart, end: row.periodEnd, timeZone: row.timeZone },
      assumptions: row.assumptions,
      sensitivity: row.sensitivity,
      enteredBy: row.createdByLabel,
      enteredAt: row.createdAt,
      approvedBy: row.approvedByLabel,
      approvedAt: row.approvedAt,
      limitation:
        'Scenario estimate from documented assumptions; not proof of causal attribution or guaranteed savings.',
    }));
  }

  private async requireAgencyOwner(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('Owner or admin access is required');
  }

  private async actor(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { email: true, firstName: true, lastName: true, name: true },
    });
    if (!user) throw new ForbiddenException('User is not active in this workspace');
    return {
      email: user.email,
      label:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'Agency team',
    };
  }

  private validateInput(input: CreateValueLedgerInput) {
    if (!input || typeof input !== 'object')
      throw new BadRequestException('Value claim is required');
    if (
      typeof input.title !== 'string' ||
      !input.title.trim() ||
      input.title.length > 160 ||
      SENSITIVE_TEXT.test(input.title)
    ) {
      throw new BadRequestException('A claim title of at most 160 characters is required');
    }
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new BadRequestException('expectedRevision must be a non-negative integer');
    }
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new BadRequestException('A valid start and later end time are required');
    }
    if (typeof input.timeZone !== 'string' || input.timeZone.length > 80) {
      throw new BadRequestException('An IANA time zone is required');
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timeZone });
    } catch {
      throw new BadRequestException('An IANA time zone is required');
    }
    this.validateEvidence(input.hoursSaved?.evidence);
    this.validateEvidence(input.loadedHourlyRate?.evidence);
    calculateTimeSavedCost(input);
  }

  private validateEvidence(evidence: EvidenceInput) {
    if (!evidence || !['SOURCE_REFERENCE', 'HUMAN_NOTE'].includes(evidence.kind)) {
      throw new BadRequestException('Each assumption requires a source reference or human note');
    }
    if (
      typeof evidence.label !== 'string' ||
      !evidence.label.trim() ||
      evidence.label.length > 120 ||
      SENSITIVE_TEXT.test(evidence.label)
    ) {
      throw new BadRequestException('Evidence label is required');
    }
    if (evidence.kind === 'SOURCE_REFERENCE') {
      if (
        typeof evidence.reference !== 'string' ||
        !evidence.reference.trim() ||
        evidence.reference.length > 240 ||
        /https?:\/\/|password|secret|token=|api[_-]?key/i.test(evidence.reference) ||
        SENSITIVE_TEXT.test(evidence.reference)
      ) {
        throw new BadRequestException(
          'Use a non-sensitive source identifier, not a URL or credential',
        );
      }
    } else if (
      typeof evidence.note !== 'string' ||
      !evidence.note.trim() ||
      evidence.note.length > 500 ||
      SENSITIVE_TEXT.test(evidence.note)
    ) {
      throw new BadRequestException(
        'Human note is required; do not include credentials or personal contact details',
      );
    }
  }

  private withEvidence(
    range: RangeInput,
    unit: string,
    ownerLabel: string,
    enteredAt: Date,
  ): Prisma.InputJsonObject {
    return {
      low: range.low,
      base: range.base,
      high: range.high,
      unit,
      evidence: {
        ...range.evidence,
        owner: ownerLabel,
        enteredAt: enteredAt.toISOString(),
      },
    };
  }
}
