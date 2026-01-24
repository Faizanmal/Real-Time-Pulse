import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationRuleType, ValidationSeverity, Prisma } from '@prisma/client';

@Injectable()
export class DataValidationService {
  private readonly logger = new Logger(DataValidationService.name);

  constructor(private prisma: PrismaService) {}

  async createRule(data: {
    workspaceId: string;
    name: string;
    description?: string;
    integrationId?: string;
    dataSource?: string;
    fieldPath: string;
    ruleType: ValidationRuleType;
    config: any;
    severity?: ValidationSeverity;
    notifyOnFailure?: boolean;
    notifyEmails?: string[];
  }) {
    return this.prisma.dataValidationRule.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        integrationId: data.integrationId,
        dataSource: data.dataSource,
        fieldPath: data.fieldPath,
        ruleType: data.ruleType,
        config: data.config as Prisma.InputJsonValue,
        severity: data.severity || ValidationSeverity.WARNING,
        notifyOnFailure: data.notifyOnFailure ?? true,
        notifyEmails: data.notifyEmails || [],
      },
      include: {
        integration: true,
      },
    });
  }

  async getRules(workspaceId: string, filters?: { enabled?: boolean }) {
    return this.prisma.dataValidationRule.findMany({
      where: {
        workspaceId,
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        integration: true,
        violations: {
          where: { resolved: false },
          take: 5,
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRuleById(ruleId: string) {
    return this.prisma.dataValidationRule.findUnique({
      where: { id: ruleId },
      include: {
        integration: true,
        violations: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async updateRule(
    ruleId: string,
    data: {
      name?: string;
      description?: string;
      enabled?: boolean;
      config?: any;
      severity?: ValidationSeverity;
      notifyOnFailure?: boolean;
      notifyEmails?: string[];
    },
  ) {
    return this.prisma.dataValidationRule.update({
      where: { id: ruleId },
      data: {
        ...data,
        ...(data.config && { config: data.config as Prisma.InputJsonValue }),
      },
    });
  }

  async deleteRule(ruleId: string) {
    return this.prisma.dataValidationRule.delete({
      where: { id: ruleId },
    });
  }

  async recordViolation(data: {
    ruleId: string;
    fieldPath: string;
    actualValue?: string;
    expectedValue?: string;
    violationType: string;
    severity: ValidationSeverity;
    metadata?: any;
  }) {
    return this.prisma.dataValidationViolation.create({
      data: {
        ruleId: data.ruleId,
        fieldPath: data.fieldPath,
        actualValue: data.actualValue,
        expectedValue: data.expectedValue,
        violationType: data.violationType,
        severity: data.severity,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async getViolations(
    workspaceId: string,
    filters?: {
      resolved?: boolean;
      severity?: ValidationSeverity;
      ruleId?: string;
    },
  ) {
    return this.prisma.dataValidationViolation.findMany({
      where: {
        rule: {
          workspaceId,
        },
        ...(filters?.resolved !== undefined && { resolved: filters.resolved }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.ruleId && { ruleId: filters.ruleId }),
      },
      include: {
        rule: {
          include: {
            integration: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async resolveViolation(violationId: string, resolvedBy: string, notes?: string) {
    return this.prisma.dataValidationViolation.update({
      where: { id: violationId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes: notes,
      },
    });
  }

  async getViolationStats(workspaceId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const violations = await this.prisma.dataValidationViolation.findMany({
      where: {
        rule: {
          workspaceId,
        },
        timestamp: {
          gte: startDate,
        },
      },
      include: {
        rule: true,
      },
    });

    const total = violations.length;
    const resolved = violations.filter((v) => v.resolved).length;
    const unresolved = total - resolved;

    const bySeverity = {
      CRITICAL: violations.filter((v) => v.severity === 'CRITICAL').length,
      ERROR: violations.filter((v) => v.severity === 'ERROR').length,
      WARNING: violations.filter((v) => v.severity === 'WARNING').length,
      INFO: violations.filter((v) => v.severity === 'INFO').length,
    };

    const byType: Record<string, number> = {};
    violations.forEach((v) => {
      byType[v.violationType] = (byType[v.violationType] || 0) + 1;
    });

    return {
      total,
      resolved,
      unresolved,
      bySeverity,
      byType,
      period: `${days} days`,
    };
  }

  async getActiveRulesForIntegration(integrationId: string) {
    return this.prisma.dataValidationRule.findMany({
      where: {
        integrationId,
        enabled: true,
      },
    });
  }
}
