/**
 * Usage-Based Billing Service
 * Provides metered billing, usage tracking, and tiered pricing
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

interface UsageMetric {
  id: string;
  name: string;
  displayName: string;
  unit: string;
  aggregation: 'sum' | 'max' | 'last';
  resetPeriod: 'daily' | 'monthly' | 'never';
}

interface UsageRecord {
  metricId: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PricingTier {
  upTo: number | null; // null = unlimited
  pricePerUnit: number;
  flatFee?: number;
}

interface UsagePlan {
  id: string;
  name: string;
  description: string;
  baseFee: number;
  billingPeriod: 'monthly' | 'yearly';
  metrics: {
    metricId: string;
    includedQuantity: number;
    tiers: PricingTier[];
  }[];
  features: string[];
}

interface UsageSummary {
  metricId: string;
  metricName: string;
  unit: string;
  currentUsage: number;
  includedQuantity: number;
  overageQuantity: number;
  overageCost: number;
  periodStart: Date;
  periodEnd: Date;
}

interface Invoice {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  baseFee: number;
  usageCharges: { metricId: string; quantity: number; amount: number }[];
  totalAmount: number;
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'void';
  dueDate: Date;
  paidAt?: Date;
}

@Injectable()
export class UsageBillingService {
  private stripe: Stripe;
  private metrics: UsageMetric[];
  private plans: UsagePlan[];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey') || '');
    this.initializeMetrics();
    this.initializePlans();
  }

  private initializeMetrics(): void {
    this.metrics = [
      {
        id: 'api_calls',
        name: 'api_calls',
        displayName: 'API Calls',
        unit: 'calls',
        aggregation: 'sum',
        resetPeriod: 'monthly',
      },
      {
        id: 'data_points',
        name: 'data_points',
        displayName: 'Data Points Ingested',
        unit: 'points',
        aggregation: 'sum',
        resetPeriod: 'monthly',
      },
      {
        id: 'active_users',
        name: 'active_users',
        displayName: 'Active Users',
        unit: 'users',
        aggregation: 'max',
        resetPeriod: 'monthly',
      },
      {
        id: 'storage',
        name: 'storage',
        displayName: 'Storage',
        unit: 'GB',
        aggregation: 'last',
        resetPeriod: 'never',
      },
      {
        id: 'dashboards',
        name: 'dashboards',
        displayName: 'Dashboards',
        unit: 'dashboards',
        aggregation: 'last',
        resetPeriod: 'never',
      },
      {
        id: 'ai_tokens',
        name: 'ai_tokens',
        displayName: 'AI Tokens',
        unit: 'tokens',
        aggregation: 'sum',
        resetPeriod: 'monthly',
      },
    ];
  }

  private initializePlans(): void {
    this.plans = [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Perfect for small teams getting started',
        baseFee: 49,
        billingPeriod: 'monthly',
        metrics: [
          {
            metricId: 'api_calls',
            includedQuantity: 100000,
            tiers: [
              { upTo: 100000, pricePerUnit: 0 },
              { upTo: 500000, pricePerUnit: 0.0001 },
              { upTo: null, pricePerUnit: 0.00005 },
            ],
          },
          {
            metricId: 'data_points',
            includedQuantity: 1000000,
            tiers: [
              { upTo: 1000000, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 0.00001 },
            ],
          },
          {
            metricId: 'active_users',
            includedQuantity: 5,
            tiers: [
              { upTo: 5, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 10 },
            ],
          },
          {
            metricId: 'dashboards',
            includedQuantity: 10,
            tiers: [
              { upTo: 10, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 5 },
            ],
          },
        ],
        features: ['Basic analytics', 'Email support', '7-day data retention'],
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'For growing teams with advanced needs',
        baseFee: 199,
        billingPeriod: 'monthly',
        metrics: [
          {
            metricId: 'api_calls',
            includedQuantity: 1000000,
            tiers: [
              { upTo: 1000000, pricePerUnit: 0 },
              { upTo: 10000000, pricePerUnit: 0.00005 },
              { upTo: null, pricePerUnit: 0.00002 },
            ],
          },
          {
            metricId: 'data_points',
            includedQuantity: 10000000,
            tiers: [
              { upTo: 10000000, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 0.000005 },
            ],
          },
          {
            metricId: 'active_users',
            includedQuantity: 25,
            tiers: [
              { upTo: 25, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 8 },
            ],
          },
          {
            metricId: 'dashboards',
            includedQuantity: 50,
            tiers: [
              { upTo: 50, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 3 },
            ],
          },
          {
            metricId: 'ai_tokens',
            includedQuantity: 100000,
            tiers: [
              { upTo: 100000, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 0.00006 },
            ],
          },
        ],
        features: [
          'Advanced analytics',
          'Priority support',
          '30-day data retention',
          'Custom integrations',
          'AI insights',
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For large organizations with custom needs',
        baseFee: 999,
        billingPeriod: 'monthly',
        metrics: [
          {
            metricId: 'api_calls',
            includedQuantity: 10000000,
            tiers: [
              { upTo: 10000000, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 0.00001 },
            ],
          },
          {
            metricId: 'data_points',
            includedQuantity: 100000000,
            tiers: [
              { upTo: 100000000, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 0.000001 },
            ],
          },
          {
            metricId: 'active_users',
            includedQuantity: 100,
            tiers: [
              { upTo: 100, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 5 },
            ],
          },
          {
            metricId: 'dashboards',
            includedQuantity: -1, // Unlimited
            tiers: [{ upTo: null, pricePerUnit: 0 }],
          },
          {
            metricId: 'ai_tokens',
            includedQuantity: 1000000,
            tiers: [
              { upTo: 1000000, pricePerUnit: 0 },
              { upTo: null, pricePerUnit: 0.00004 },
            ],
          },
        ],
        features: [
          'Unlimited analytics',
          '24/7 dedicated support',
          'Unlimited data retention',
          'Custom integrations',
          'Advanced AI',
          'White-labeling',
          'SSO/SAML',
          'SLA guarantee',
        ],
      },
    ];
  }

  // ==================== USAGE TRACKING ====================

  /**
   * Record usage for a metric
   */
  async recordUsage(
    organizationId: string,
    metricId: string,
    quantity: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const metric = this.metrics.find((m) => m.id === metricId);
    if (!metric) {
      throw new BadRequestException(`Unknown metric: ${metricId}`);
    }

    await this.prisma.usageRecord.create({
      data: {
        id: uuidv4(),
        organizationId,
        metricId,
        quantity,
        metadata: metadata as any,
        recordedAt: new Date(),
      },
    });

    // Update running total
    await this.updateRunningTotal(organizationId, metricId, quantity, metric.aggregation);

    // Check for usage alerts
    await this.checkUsageAlerts(organizationId, metricId);
  }

  /**
   * Batch record usage
   */
  async recordBatchUsage(organizationId: string, records: UsageRecord[]): Promise<void> {
    await this.prisma.usageRecord.createMany({
      data: records.map((r) => ({
        id: uuidv4(),
        organizationId,
        metricId: r.metricId,
        quantity: r.quantity,
        metadata: r.metadata as any,
        recordedAt: r.timestamp,
      })),
    });

    // Update running totals
    for (const record of records) {
      const metric = this.metrics.find((m) => m.id === record.metricId);
      if (metric) {
        await this.updateRunningTotal(
          organizationId,
          record.metricId,
          record.quantity,
          metric.aggregation,
        );
      }
    }
  }

  /**
   * Get current usage for an organization
   */
  async getCurrentUsage(organizationId: string): Promise<UsageSummary[]> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId, status: 'active' },
    });

    if (!subscription) {
      return [];
    }

    const plan = this.plans.find((p) => p.id === subscription.planId);
    if (!plan) {
      return [];
    }

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    const summaries: UsageSummary[] = [];

    for (const planMetric of plan.metrics) {
      const metric = this.metrics.find((m) => m.id === planMetric.metricId);
      if (!metric) continue;

      const currentUsage = await this.getAggregatedUsage(
        organizationId,
        planMetric.metricId,
        periodStart,
        periodEnd,
        metric.aggregation,
      );

      const includedQuantity = planMetric.includedQuantity;
      const overageQuantity = Math.max(0, currentUsage - includedQuantity);
      const overageCost = this.calculateOverageCost(overageQuantity, planMetric.tiers);

      summaries.push({
        metricId: planMetric.metricId,
        metricName: metric.displayName,
        unit: metric.unit,
        currentUsage,
        includedQuantity,
        overageQuantity,
        overageCost,
        periodStart,
        periodEnd,
      });
    }

    return summaries;
  }

  /**
   * Get usage history
   */
  async getUsageHistory(
    organizationId: string,
    metricId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'hourly' | 'daily' | 'monthly' = 'daily',
  ): Promise<{ timestamp: Date; quantity: number }[]> {
    const records = await this.prisma.usageRecord.findMany({
      where: {
        organizationId,
        metricId,
        recordedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { recordedAt: 'asc' },
    });

    // Aggregate by granularity
    const grouped = new Map<string, number>();

    for (const record of records) {
      const key = this.getTimeKey(record.recordedAt, granularity);
      const current = grouped.get(key) || 0;
      grouped.set(key, current + record.quantity);
    }

    return Array.from(grouped.entries()).map(([key, quantity]) => ({
      timestamp: new Date(key),
      quantity,
    }));
  }

  // ==================== BILLING & INVOICES ====================

  /**
   * Calculate current bill amount
   */
  async calculateCurrentBill(organizationId: string): Promise<{
    baseFee: number;
    usageCharges: { metricId: string; metricName: string; quantity: number; amount: number }[];
    total: number;
    projectedMonthEnd: number;
  }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId, status: 'active' },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    const plan = this.plans.find((p) => p.id === subscription.planId);
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const usageSummaries = await this.getCurrentUsage(organizationId);
    const usageCharges = usageSummaries.map((s) => ({
      metricId: s.metricId,
      metricName: s.metricName,
      quantity: s.overageQuantity,
      amount: s.overageCost,
    }));

    const totalUsageCharges = usageCharges.reduce((sum, c) => sum + c.amount, 0);
    const total = plan.baseFee + totalUsageCharges;

    // Project to end of billing period
    const now = new Date();
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const daysElapsed = Math.max(1, (now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
    const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000);
    const projectedMonthEnd = plan.baseFee + (totalUsageCharges / daysElapsed) * totalDays;

    return {
      baseFee: plan.baseFee,
      usageCharges,
      total,
      projectedMonthEnd,
    };
  }

  /**
   * Generate invoice for billing period
   */
  async generateInvoice(organizationId: string, periodEnd: Date): Promise<Invoice> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId, status: 'active' },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    const plan = this.plans.find((p) => p.id === subscription.planId);
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const periodStart = subscription.currentPeriodStart;
    const usageSummaries = await this.getCurrentUsage(organizationId);

    const usageCharges = usageSummaries.map((s) => ({
      metricId: s.metricId,
      quantity: s.overageQuantity,
      amount: s.overageCost,
    }));

    const totalUsageCharges = usageCharges.reduce((sum, c) => sum + c.amount, 0);
    const totalAmount = plan.baseFee + totalUsageCharges;

    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 15); // Due in 15 days

    const invoice = await this.prisma.invoice.create({
      data: {
        id: uuidv4(),
        organizationId,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        baseFee: plan.baseFee,
        usageCharges: usageCharges as any,
        totalAmount,
        status: 'pending',
        dueDate,
        createdAt: new Date(),
      },
    });

    // Create Stripe invoice
    await this.createStripeInvoice(organizationId, invoice as any);

    return invoice as unknown as Invoice;
  }

  /**
   * Get invoices for organization
   */
  async getInvoices(
    organizationId: string,
    options?: { status?: string; limit?: number },
  ): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 12,
    });

    return invoices as unknown as Invoice[];
  }

  // ==================== USAGE ALERTS ====================

  /**
   * Set usage alert
   */
  async setUsageAlert(
    organizationId: string,
    metricId: string,
    threshold: number,
    thresholdType: 'absolute' | 'percentage',
  ): Promise<void> {
    await this.prisma.usageAlert.upsert({
      where: {
        organizationId_metricId: { organizationId, metricId },
      },
      create: {
        id: uuidv4(),
        organizationId,
        metricId,
        threshold,
        thresholdType,
        enabled: true,
      },
      update: {
        threshold,
        thresholdType,
        enabled: true,
      },
    });
  }

  /**
   * Check and trigger usage alerts
   */
  private async checkUsageAlerts(organizationId: string, metricId: string): Promise<void> {
    const alerts = await this.prisma.usageAlert.findMany({
      where: { organizationId, metricId, enabled: true },
    });

    if (alerts.length === 0) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId, status: 'active' },
    });

    if (!subscription) return;

    const plan = this.plans.find((p) => p.id === subscription.planId);
    if (!plan) return;

    const planMetric = plan.metrics.find((m) => m.metricId === metricId);
    if (!planMetric) return;

    const metric = this.metrics.find((m) => m.id === metricId);
    if (!metric) return;

    const currentUsage = await this.getAggregatedUsage(
      organizationId,
      metricId,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      metric.aggregation,
    );

    for (const alert of alerts) {
      let shouldTrigger = false;

      if (alert.thresholdType === 'absolute') {
        shouldTrigger = currentUsage >= alert.threshold;
      } else {
        const percentage = (currentUsage / planMetric.includedQuantity) * 100;
        shouldTrigger = percentage >= alert.threshold;
      }

      if (shouldTrigger && !alert.lastTriggeredAt) {
        await this.triggerUsageAlert(organizationId, metricId, currentUsage, alert as any);
      }
    }
  }

  private async triggerUsageAlert(
    organizationId: string,
    metricId: string,
    currentUsage: number,
    alert: any,
  ): Promise<void> {
    await this.prisma.usageAlert.update({
      where: { id: alert.id },
      data: { lastTriggeredAt: new Date() },
    });

    // Send notification
    await this.prisma.notification.create({
      data: {
        id: uuidv4(),
        organizationId,
        type: 'usage_alert',
        title: 'Usage Alert Triggered',
        message: `Your ${metricId} usage has reached ${currentUsage}`,
        data: { metricId, currentUsage, threshold: alert.threshold },
        createdAt: new Date(),
      },
    });

    this.logger.log(`Usage alert triggered for ${organizationId}:${metricId}`, 'UsageBillingService');
  }

  // ==================== STRIPE INTEGRATION ====================

  /**
   * Report usage to Stripe
   */
  async reportUsageToStripe(
    organizationId: string,
    metricId: string,
    quantity: number,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId, status: 'active' },
      include: { organization: true },
    });

    if (!subscription?.stripeSubscriptionId) return;

    const subscriptionItems = await this.stripe.subscriptionItems.list({
      subscription: subscription.stripeSubscriptionId,
    });

    const meteredItem = subscriptionItems.data.find(
      (item) => item.price.lookup_key === metricId,
    );

    if (meteredItem) {
      await this.stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      });
    }
  }

  private async createStripeInvoice(organizationId: string, invoice: Invoice): Promise<void> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization?.stripeCustomerId) return;

    const stripeInvoice = await this.stripe.invoices.create({
      customer: organization.stripeCustomerId,
      auto_advance: true,
      metadata: { invoiceId: invoice.id },
    });

    // Add line items
    for (const charge of invoice.usageCharges) {
      if (charge.amount > 0) {
        await this.stripe.invoiceItems.create({
          customer: organization.stripeCustomerId,
          invoice: stripeInvoice.id,
          amount: Math.round(charge.amount * 100),
          currency: 'usd',
          description: `${charge.metricId} usage: ${charge.quantity} units`,
        });
      }
    }
  }

  // ==================== SCHEDULED TASKS ====================

  /**
   * Process end-of-period billing
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processEndOfPeriodBilling(): Promise<void> {
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: { lte: new Date() },
      },
    });

    for (const subscription of expiredSubscriptions) {
      try {
        await this.generateInvoice(subscription.organizationId, subscription.currentPeriodEnd);

        // Advance to next period
        const nextPeriodStart = subscription.currentPeriodEnd;
        const nextPeriodEnd = new Date(nextPeriodStart);
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: nextPeriodStart,
            currentPeriodEnd: nextPeriodEnd,
          },
        });

        // Reset monthly usage counters
        await this.resetMonthlyUsage(subscription.organizationId);
      } catch (error) {
        this.logger.error(
          `Failed to process billing for ${subscription.organizationId}: ${error}`,
          'UsageBillingService',
        );
      }
    }
  }

  // ==================== HELPER METHODS ====================

  private async updateRunningTotal(
    organizationId: string,
    metricId: string,
    quantity: number,
    aggregation: 'sum' | 'max' | 'last',
  ): Promise<void> {
    const existing = await this.prisma.usageTotal.findUnique({
      where: { organizationId_metricId: { organizationId, metricId } },
    });

    let newTotal: number;
    if (!existing) {
      newTotal = quantity;
    } else {
      switch (aggregation) {
        case 'sum':
          newTotal = existing.total + quantity;
          break;
        case 'max':
          newTotal = Math.max(existing.total, quantity);
          break;
        case 'last':
          newTotal = quantity;
          break;
      }
    }

    await this.prisma.usageTotal.upsert({
      where: { organizationId_metricId: { organizationId, metricId } },
      create: { organizationId, metricId, total: newTotal },
      update: { total: newTotal, updatedAt: new Date() },
    });
  }

  private async getAggregatedUsage(
    organizationId: string,
    metricId: string,
    startDate: Date,
    endDate: Date,
    aggregation: 'sum' | 'max' | 'last',
  ): Promise<number> {
    const result = await this.prisma.usageRecord.aggregate({
      where: {
        organizationId,
        metricId,
        recordedAt: { gte: startDate, lte: endDate },
      },
      _sum: { quantity: true },
      _max: { quantity: true },
    });

    switch (aggregation) {
      case 'sum':
        return result._sum.quantity || 0;
      case 'max':
        return result._max.quantity || 0;
      case 'last':
        const last = await this.prisma.usageRecord.findFirst({
          where: { organizationId, metricId },
          orderBy: { recordedAt: 'desc' },
        });
        return last?.quantity || 0;
    }
  }

  private calculateOverageCost(quantity: number, tiers: PricingTier[]): number {
    let remaining = quantity;
    let cost = 0;
    let previousLimit = 0;

    for (const tier of tiers) {
      if (remaining <= 0) break;

      const tierLimit = tier.upTo ?? Infinity;
      const tierQuantity = Math.min(remaining, tierLimit - previousLimit);

      if (tierQuantity > 0) {
        cost += tierQuantity * tier.pricePerUnit;
        if (tier.flatFee) cost += tier.flatFee;
        remaining -= tierQuantity;
      }

      previousLimit = tierLimit;
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  private getTimeKey(date: Date, granularity: 'hourly' | 'daily' | 'monthly'): string {
    const d = new Date(date);
    switch (granularity) {
      case 'hourly':
        d.setMinutes(0, 0, 0);
        break;
      case 'daily':
        d.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
    }
    return d.toISOString();
  }

  private async resetMonthlyUsage(organizationId: string): Promise<void> {
    const monthlyMetrics = this.metrics
      .filter((m) => m.resetPeriod === 'monthly')
      .map((m) => m.id);

    await this.prisma.usageTotal.deleteMany({
      where: {
        organizationId,
        metricId: { in: monthlyMetrics },
      },
    });
  }

  /**
   * Get available plans
   */
  getPlans(): UsagePlan[] {
    return this.plans;
  }

  /**
   * Get metrics definitions
   */
  getMetrics(): UsageMetric[] {
    return this.metrics;
  }
}
