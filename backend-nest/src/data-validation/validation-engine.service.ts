import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DataValidationService } from './data-validation.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';

@Injectable()
export class ValidationEngineService {
  private readonly logger = new Logger(ValidationEngineService.name);

  constructor(
    private prisma: PrismaService,
    private dataValidationService: DataValidationService,
    private emailService: EmailService,
    @Inject(forwardRef(() => CacheService))
    private cacheService: CacheService,
  ) {}

  // Run validation checks every 10 minutes
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runScheduledValidations() {
    this.logger.log('Running scheduled data validations...');

    const rules = await this.prisma.dataValidationRule.findMany({
      where: { enabled: true },
      include: { integration: true },
    });

    for (const rule of rules) {
      try {
        await this.validateRule(rule);
      } catch (error) {
        this.logger.error(
          `Validation failed for rule ${rule.id}: ${error.message}`,
        );
      }
    }
  }

  async validateRule(rule: any) {
    // Get data to validate
    const data = await this.fetchDataForValidation(rule);
    if (!data) {
      this.logger.warn(`No data available for validation rule ${rule.id}`);
      return;
    }

    // Extract the field value using the field path
    const value = this.getValueByPath(data, rule.fieldPath);

    // Perform validation based on rule type
    const violation = await this.performValidation(rule, value, data);

    if (violation) {
      // Record the violation
      await this.dataValidationService.recordViolation({
        ruleId: rule.id,
        fieldPath: rule.fieldPath,
        actualValue: this.stringifyValue(value),
        expectedValue: violation.expectedValue,
        violationType: violation.type,
        severity: rule.severity,
        metadata: violation.metadata,
      });

      // Send notification if enabled
      if (rule.notifyOnFailure) {
        await this.sendViolationNotification(rule, violation);
      }
    }
  }

  private async fetchDataForValidation(rule: any): Promise<any> {
    // First, try to get data from cache
    if (rule.integrationId) {
      // Get widgets using this integration
      const widgets = await this.prisma.widget.findMany({
        where: { integrationId: rule.integrationId },
        include: {
          portal: { select: { workspaceId: true } },
        },
        take: 10,
      });

      if (widgets.length > 0) {
        // Try to get cached widget data
        for (const widget of widgets) {
          const cachedData = await this.cacheService.getWidgetData(widget.id);
          if (cachedData) {
            this.logger.debug(`Using cached data for widget ${widget.id}`);
            return cachedData;
          }
        }

        // Fall back to widget config if no cached data
        const widgetWithConfig = widgets.find(
          (w) => w.config && Object.keys(w.config as object).length > 0,
        );
        if (widgetWithConfig) {
          return widgetWithConfig.config;
        }
      }
    }

    // If no integration-based data, check for portal-level data
    if (rule.portalId) {
      const portal = await this.prisma.portal.findUnique({
        where: { id: rule.portalId },
        include: {
          widgets: {
            take: 5,
            orderBy: { updatedAt: 'desc' },
          },
        },
      });

      if (portal && portal.widgets.length > 0) {
        // Aggregate data from widgets
        const aggregatedData: Record<string, any> = {};
        for (const widget of portal.widgets) {
          const cachedData = await this.cacheService.getWidgetData(widget.id);
          if (cachedData) {
            aggregatedData[widget.name] = cachedData;
          } else if (widget.config) {
            aggregatedData[widget.name] = widget.config;
          }
        }
        return aggregatedData;
      }
    }

    // Check for workspace-level metrics
    if (rule.workspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: rule.workspaceId },
        include: {
          portals: {
            take: 1,
            include: {
              widgets: { take: 3 },
            },
          },
        },
      });

      if (workspace && workspace.portals.length > 0) {
        const portal = workspace.portals[0];
        if (portal.widgets.length > 0) {
          for (const widget of portal.widgets) {
            const cachedData = await this.cacheService.getWidgetData(widget.id);
            if (cachedData) {
              return cachedData;
            }
          }
          return portal.widgets[0].config;
        }
      }
    }

    this.logger.debug(`No data available for validation rule ${rule.id}`);
    return null;
  }

  private getValueByPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return null;
      current = current[key];
    }

    return current;
  }

  private async performValidation(
    rule: any,
    value: any,
    fullData: any,
  ): Promise<{
    type: string;
    expectedValue?: string;
    metadata?: any;
  } | null> {
    const config = rule.config;

    switch (rule.ruleType) {
      case ValidationRuleType.NO_NEGATIVE_VALUES:
        return this.validateNoNegative(value);

      case ValidationRuleType.RANGE_CHECK:
        return this.validateRange(value, config);

      case ValidationRuleType.SPIKE_DETECTION:
        return await this.validateSpikeDetection(rule, value);

      case ValidationRuleType.MISSING_FIELD:
        return this.validateMissingField(value);

      case ValidationRuleType.REQUIRED_FIELD:
        return this.validateRequiredField(value);

      case ValidationRuleType.CROSS_SOURCE_CONSISTENCY:
        return await this.validateCrossSource(rule, value, fullData);

      case ValidationRuleType.CUSTOM_REGEX:
        return this.validateRegex(value, config);

      case ValidationRuleType.DATA_TYPE_CHECK:
        return this.validateDataType(value, config);

      default:
        return null;
    }
  }

  private validateNoNegative(value: any) {
    if (typeof value === 'number' && value < 0) {
      return {
        type: 'NEGATIVE_VALUE',
        expectedValue: '>= 0',
        metadata: { actualValue: value },
      };
    }
    return null;
  }

  private validateRange(value: any, config: any) {
    if (typeof value !== 'number') return null;

    const { min, max } = config;

    if (
      (min !== undefined && value < min) ||
      (max !== undefined && value > max)
    ) {
      return {
        type: 'OUT_OF_RANGE',
        expectedValue: `${min} - ${max}`,
        metadata: { actualValue: value, min, max },
      };
    }

    return null;
  }

  private async validateSpikeDetection(rule: any, value: any) {
    if (typeof value !== 'number') return null;

    // Get historical values
    const historicalViolations =
      await this.prisma.dataValidationViolation.findMany({
        where: {
          ruleId: rule.id,
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

    if (historicalViolations.length < 10) {
      // Not enough historical data
      return null;
    }

    // Calculate statistics
    const values = historicalViolations
      .map((v) => parseFloat(v.actualValue || '0'))
      .filter((v) => !isNaN(v));

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    const threshold = rule.config.standardDeviations || 3;
    const deviation = Math.abs(value - mean) / stdDev;

    if (deviation > threshold) {
      return {
        type: 'SPIKE_DETECTED',
        expectedValue: `${mean.toFixed(2)} ± ${(threshold * stdDev).toFixed(2)}`,
        metadata: {
          actualValue: value,
          mean,
          stdDev,
          deviation,
          threshold,
        },
      };
    }

    return null;
  }

  private validateMissingField(value: any) {
    if (value === null || value === undefined || value === '') {
      return {
        type: 'MISSING_FIELD',
        expectedValue: 'non-empty value',
      };
    }
    return null;
  }

  private validateRequiredField(value: any) {
    if (value === null || value === undefined) {
      return {
        type: 'REQUIRED_FIELD_MISSING',
        expectedValue: 'any value',
      };
    }
    return null;
  }

  private async validateCrossSource(rule: any, value: any, _fullData: any) {
    const { compareIntegrationId, compareFieldPath, tolerance } = rule.config;

    if (!compareIntegrationId || !compareFieldPath) return null;

    // Fetch data from comparison source
    const compareWidgets = await this.prisma.widget.findMany({
      where: { integrationId: compareIntegrationId },
      take: 1,
    });

    if (compareWidgets.length === 0) return null;

    const compareData = compareWidgets[0].config;
    const compareValue = this.getValueByPath(compareData, compareFieldPath);

    if (typeof value === 'number' && typeof compareValue === 'number') {
      const diff = Math.abs(value - compareValue);
      const percentDiff = (diff / compareValue) * 100;

      if (percentDiff > (tolerance || 10)) {
        return {
          type: 'CROSS_SOURCE_INCONSISTENCY',
          expectedValue: compareValue.toString(),
          metadata: {
            actualValue: value,
            compareValue,
            percentDiff: percentDiff.toFixed(2),
            tolerance,
          },
        };
      }
    }

    return null;
  }

  private validateRegex(value: any, config: any) {
    if (typeof value !== 'string') return null;

    const { pattern, flags } = config;
    const regex = new RegExp(pattern, flags);

    if (!regex.test(value)) {
      return {
        type: 'REGEX_MISMATCH',
        expectedValue: `matching ${pattern}`,
        metadata: { actualValue: value, pattern },
      };
    }

    return null;
  }

  private validateDataType(value: any, config: any) {
    const { expectedType } = config;
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== expectedType) {
      return {
        type: 'DATA_TYPE_MISMATCH',
        expectedValue: expectedType,
        metadata: { actualType, actualValue: this.stringifyValue(value) },
      };
    }

    return null;
  }

  private stringifyValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private async sendViolationNotification(rule: any, violation: any) {
    this.logger.warn(
      `Validation violation for rule "${rule.name}": ${violation.type}`,
    );

    const recipients = Array.isArray(rule.notifyEmails)
      ? rule.notifyEmails.filter((email: string) => !!email)
      : [];

    if (!recipients.length) {
      return;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: rule.workspaceId },
      select: { name: true },
    });

    const emailSent = await this.emailService.sendValidationViolationEmail({
      to: recipients,
      ruleName: rule.name,
      ruleSeverity: rule.severity as ValidationSeverity,
      workspaceName: workspace?.name || 'Workspace',
      fieldPath: rule.fieldPath,
      expectedValue: violation.expectedValue,
      actualValue: violation.metadata?.actualValue,
      violationType: violation.type,
    });

    if (!emailSent) {
      this.logger.warn(
        `Failed to deliver validation notification for rule ${rule.id}`,
      );
    }
  }

  async validateDataOnDemand(
    workspaceId: string,
    data: any,
    fieldPath: string,
  ) {
    const rules = await this.prisma.dataValidationRule.findMany({
      where: {
        workspaceId,
        fieldPath,
        enabled: true,
      },
    });

    const results: any[] = [];

    for (const rule of rules) {
      const value = this.getValueByPath(data, fieldPath);
      const violation = await this.performValidation(rule, value, data);

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        passed: !violation,
        violation: violation || null,
      });
    }

    return results;
  }
}
