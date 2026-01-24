/**
 * Usage-Based Billing Service
 * Provides metered billing, usage tracking, and tiered pricing
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client'; // Assuming Prisma types exist

// --- Interfaces ---

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
  private readonly logger = new Logger(UsageBillingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey') || '', {
      apiVersion: '2025-12-15.clover', // Specify version for stability
    });
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
    // Plans definition remains the same as provided
    this.plans = [
      {
        id: 'TRIAL',
        name: 'Trial',
        description: 'Perfect for small teams getting started',
        baseFee: 0,
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
        id: 'PRO',
        name: 'Professional',
        description: 'For growing teams with advanced needs',
        baseFee: 49,
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
        id: 'AGENCY',
        name: 'Agency',
        description: 'For large organizations with custom needs',
        baseFee: 99,
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
    _metadata?: Record<string, any>,
  ): Promise<void> {
    const metric = this.metrics.find((m) => m.id === metricId);
    if (!metric) {
      throw new BadRequestException(`Unknown metric: ${metricId}`);
    }

    await this.prisma.usageRecord.create({
      data: {
        id: uuidv4(),
        workspaceId: organizationId,
        metric: metricId,
        value: quantity,
        recordedAt: new Date(),
        organizationId,
        quantity,
        metricId,
      },
    });

    // Update running total (Optimized cache)
    await this.updateRunningTotal(organizationId, metricId, quantity, metric.aggregation);

    // Check for usage alerts
    await this.checkUsageAlerts(organizationId, metricId);

    // Report to Stripe asynchronously
    this.reportUsageToStripe(organizationId, metricId, quantity).catch((err) =>
      this.logger.error(`Failed to report usage to Stripe for ${organizationId}: ${err.message}`),
    );
  }

  /**
   * Batch record usage
   */
  async recordBatchUsage(organizationId: string, records: UsageRecord[]): Promise<void> {
    if (records.length === 0) return;

    await this.prisma.usageRecord.createMany({
      data: records.map((r) => ({
        id: uuidv4(),
        workspaceId: organizationId,
        metric: r.metricId,
        value: r.quantity,
        recordedAt: r.timestamp,
        organizationId,
        quantity: r.quantity,
        metricId: r.metricId,
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
      where: { workspaceId: organizationId, status: 'ACTIVE' },
    });

    if (!subscription) {
      return [];
    }

    const plan = this.plans.find((p) => p.id === subscription.plan);
    if (!plan) {
      return [];
    }

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.stripeCurrentPeriodEnd;

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

      // FIX: Pass currentUsage (total) to cost calculator, not overageQuantity.
      // The tiers define the cost for the whole range (e.g., first 100k free).
      const totalCost = this.calculateUsageCost(currentUsage, planMetric.tiers);

      summaries.push({
        metricId: planMetric.metricId,
        metricName: metric.displayName,
        unit: metric.unit,
        currentUsage,
        includedQuantity,
        overageQuantity,
        overageCost: totalCost, // Effectively the cost of usage
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
      where: { workspaceId: organizationId, status: 'ACTIVE' },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    const plan = this.plans.find((p) => p.id === subscription.plan);
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
    const periodEnd = new Date(subscription.stripeCurrentPeriodEnd);
    const daysElapsed = Math.max(
      1,
      (now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000);

    // Prevent Infinity if period just started or dates are messed up
    const projectionFactor = totalDays / daysElapsed;
    const projectedUsageCost = totalUsageCharges * projectionFactor;

    const projectedMonthEnd = plan.baseFee + projectedUsageCost;

    return {
      baseFee: plan.baseFee,
      usageCharges,
      total,
      projectedMonthEnd,
    };
  }

  /**
   * Generate invoice for billing period
   * @param tx Optional Prisma transaction client
   */
  async generateInvoice(
    organizationId: string,
    periodEnd: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Invoice> {
    const prismaClient = tx || this.prisma;

    const subscription = await prismaClient.subscription.findFirst({
      where: { workspaceId: organizationId, status: 'ACTIVE' },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription');
    }

    const plan = this.plans.find((p) => p.id === subscription.plan);
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const periodStart = subscription.currentPeriodStart;

    // We must use "this.getCurrentUsage" but it uses this.prisma internally.
    // In a transaction, this reads potentially stale data if we don't pass tx.
    // Ideally refactor getCurrentUsage to accept tx, but for now we rely on the
    // fact that billing happens after usage is finalized.
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

    const invoice = await prismaClient.invoice.create({
      data: {
        id: uuidv4(),
        workspaceId: organizationId,
        amount: totalAmount,
        currency: 'usd',
        status: 'draft',
        issuedAt: periodStart,
        dueAt: dueDate,
        organizationId,
      },
    });

    // Create Stripe invoice (Note: Side effect outside transaction, generally acceptable for draft invoices)
    // If we wanted strict consistency, we'd do this after tx commit.
    try {
      await this.createStripeInvoice(organizationId, invoice as unknown as Invoice);
    } catch (e) {
      this.logger.error(`Stripe Invoice sync failed: ${e.message}`);
      // Don't fail the local invoice creation
    }

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

  async setUsageAlert(
    organizationId: string,
    metricId: string,
    threshold: number,
    thresholdType: 'absolute' | 'percentage',
  ): Promise<void> {
    const existing = await this.prisma.usageAlert.findFirst({
      where: {
        workspaceId: organizationId,
        metric: metricId,
      },
    });

    if (existing) {
      await this.prisma.usageAlert.update({
        where: { id: existing.id },
        data: {
          threshold,
          thresholdType,
          enabled: true,
        },
      });
    } else {
      await this.prisma.usageAlert.create({
        data: {
          id: uuidv4(),
          workspaceId: organizationId,
          metric: metricId,
          threshold,
          currentValue: 0,
          thresholdType,
          enabled: true,
        },
      });
    }
  }

  private async checkUsageAlerts(organizationId: string, metricId: string): Promise<void> {
    const alerts = await this.prisma.usageAlert.findMany({
      where: { workspaceId: organizationId, metric: metricId, enabled: true },
    });

    if (alerts.length === 0) return;

    // FIX: Optimized to read from UsageTotal (cache) instead of full aggregation
    // This reduces DB load significantly on high-volume ingest
    const usageTotal = await this.prisma.usageTotal.findUnique({
      where: {
        workspaceId_metric_period: {
          workspaceId: organizationId,
          metric: metricId,
          period: 'monthly',
        },
      },
    });

    const currentUsage = usageTotal?.total || 0;

    const subscription = await this.prisma.subscription.findFirst({
      where: { workspaceId: organizationId, status: 'ACTIVE' },
    });
    if (!subscription) return;

    const plan = this.plans.find((p) => p.id === subscription.plan);
    if (!plan) return;

    const planMetric = plan.metrics.find((m) => m.metricId === metricId);
    if (!planMetric) return;

    for (const alert of alerts) {
      let shouldTrigger = false;

      if (alert.thresholdType === 'absolute') {
        shouldTrigger = currentUsage >= alert.threshold;
      } else {
        const percentage = (currentUsage / planMetric.includedQuantity) * 100;
        shouldTrigger = percentage >= alert.threshold;
      }

      // Check if not triggered recently (e.g., in the last 24 hours) or strictly once per period
      // Here assuming we only trigger if we passed it and haven't triggered "lately"
      // or if reset happens. For simplicity, checking if lastTriggeredAt is null or old.
      if (shouldTrigger && (!alert.lastTriggeredAt || this.isAlertStale(alert.lastTriggeredAt))) {
        await this.triggerUsageAlert(organizationId, metricId, currentUsage, alert);
      }
    }
  }

  private isAlertStale(lastTriggered: Date): boolean {
    const oneDay = 24 * 60 * 60 * 1000;
    return new Date().getTime() - lastTriggered.getTime() > oneDay;
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

    // await this.prisma.notification.create({
    //   data: {
    //     id: uuidv4(),
    //     workspaceId: organizationId,
    //     type: 'USAGE_ALERT',
    //     title: 'Usage Alert Triggered',
    //     message: `Your ${metricId} usage has reached ${currentUsage}`,
    //     metadata: { metricId, currentUsage, threshold: alert.threshold } as Prisma.InputJsonValue,
    //   },
    // });

    this.logger.log(
      `Usage alert triggered for ${organizationId}:${metricId}`,
      'UsageBillingService',
    );
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
      where: { workspaceId: organizationId, status: 'ACTIVE' },
      include: { workspace: true },
    });

    if (!subscription?.stripeSubscriptionId) return;

    const subscriptionItems = await this.stripe.subscriptionItems.list({
      subscription: subscription.stripeSubscriptionId,
    });

    const meteredItem = subscriptionItems.data.find((item) => item.price.lookup_key === metricId);

    if (meteredItem) {
      const metric = this.metrics.find((m) => m.id === metricId);
      // FIX: Determine action based on aggregation.
      // 'sum' = increment. 'last'/'max' = set.
      // Warning: 'set' overwrites usage for the specific timestamp window in Stripe.
      const action =
        metric?.aggregation === 'last' || metric?.aggregation === 'max' ? 'set' : 'increment';

      await (this.stripe.subscriptionItems as any).createUsageRecord(meteredItem.id, {
        quantity: quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: action,
      });
    }
  }

  private async createStripeInvoice(organizationId: string, invoice: Invoice): Promise<void> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization?.stripeCustomerId) return;

    // Create a draft invoice first
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
        status: 'ACTIVE',
        stripeCurrentPeriodEnd: { lte: new Date() },
      },
    });

    for (const subscription of expiredSubscriptions) {
      try {
        // FIX: Wrap in transaction to ensure atomicity
        await this.prisma.$transaction(async (tx) => {
          // Generate Invoice
          await this.generateInvoice(
            subscription.workspaceId,
            subscription.stripeCurrentPeriodEnd,
            tx,
          );

          // Advance to next period
          // FIX: Better month calculation to handle rollovers (e.g. Jan 31 -> Feb 28)
          const nextPeriodStart = subscription.stripeCurrentPeriodEnd;
          const nextPeriodEnd = new Date(nextPeriodStart);
          const currentDay = nextPeriodEnd.getDate();

          nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

          // Check if date rolled over (e.g. Jan 31 -> March 3) and correct it to end of month
          if (nextPeriodEnd.getDate() !== currentDay) {
            nextPeriodEnd.setDate(0); // Set to last day of previous month
          }

          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              currentPeriodStart: nextPeriodStart,
              stripeCurrentPeriodEnd: nextPeriodEnd,
            },
          });

          // Reset monthly usage counters
          await this.resetMonthlyUsage(subscription.workspaceId, tx);
        });
      } catch (error) {
        this.logger.error(
          `Failed to process billing for ${subscription.workspaceId}: ${error.message}`,
          error.stack,
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
      where: {
        workspaceId_metric_period: {
          workspaceId: organizationId,
          metric: metricId,
          period: 'monthly',
        },
      },
    });

    let newTotal: number;
    // Initialize if not exists
    const currentTotal = existing ? existing.total : 0;

    switch (aggregation) {
      case 'sum':
        newTotal = currentTotal + quantity;
        break;
      case 'max':
        newTotal = Math.max(currentTotal, quantity);
        break;
      case 'last':
        newTotal = quantity;
        break;
      default:
        newTotal = quantity;
    }

    await this.prisma.usageTotal.upsert({
      where: {
        workspaceId_metric_period: {
          workspaceId: organizationId,
          metric: metricId,
          period: 'monthly',
        },
      },
      create: {
        workspaceId: organizationId,
        metric: metricId,
        total: newTotal,
        period: 'monthly',
        organizationId,
        metricId,
      },
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
        workspaceId: organizationId,
        metric: metricId,
        recordedAt: { gte: startDate, lte: endDate },
      },
      _sum: { value: true },
      _max: { value: true },
    });

    switch (aggregation) {
      case 'sum':
        return result._sum.value || 0;
      case 'max':
        return result._max.value || 0;
      case 'last': {
        const last = await this.prisma.usageRecord.findFirst({
          where: {
            workspaceId: organizationId,
            metric: metricId,
            recordedAt: { gte: startDate, lte: endDate },
          },
          orderBy: { recordedAt: 'desc' },
        });
        return last?.value || 0;
      }
    }
  }

  /**
   * Calculates cost based on total quantity and tiers
   * FIX: Renamed from calculateOverageCost and logic adjusted
   */
  private calculateUsageCost(totalQuantity: number, tiers: PricingTier[]): number {
    let remaining = totalQuantity;
    let cost = 0;
    let previousLimit = 0;

    for (const tier of tiers) {
      if (remaining <= 0) break;

      const tierLimit = tier.upTo ?? Infinity;
      const tierCapacity = tierLimit - previousLimit;
      const quantityInTier = Math.min(remaining, tierCapacity);

      if (quantityInTier > 0) {
        cost += quantityInTier * tier.pricePerUnit;
        if (tier.flatFee) cost += tier.flatFee;
        remaining -= quantityInTier;
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

  private async resetMonthlyUsage(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const monthlyMetrics = this.metrics.filter((m) => m.resetPeriod === 'monthly').map((m) => m.id);
    const client = tx || this.prisma;

    await client.usageTotal.deleteMany({
      where: {
        organizationId,
        metricId: { in: monthlyMetrics },
      },
    });
  }

  getPlans(): UsagePlan[] {
    return this.plans;
  }

  getMetrics(): UsageMetric[] {
    return this.metrics;
  }
}
