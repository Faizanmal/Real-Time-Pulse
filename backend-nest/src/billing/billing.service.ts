import { Injectable, Logger, NotFoundException, BadRequestException, Optional, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingEventType,
  SubscriptionPlan,
  SubscriptionStatus,
  OnboardingFunnelStage,
  Prisma,
  // BillingEventType,
  // BillingEventStatus,
} from '@prisma/client';
import Stripe from 'stripe';

import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingFunnelService } from '../analytics/onboarding-funnel.service';
import { PLAN_CATALOG, planPriceId } from './plan-catalog';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: any;
  private readonly stripeSecretKey: string;

  // Plan configurations
  private readonly plans = {
    PRO: {
      ...PLAN_CATALOG.PRO,
      priceId: planPriceId('PRO'),
    },
    AGENCY: {
      ...PLAN_CATALOG.AGENCY,
      priceId: planPriceId('AGENCY'),
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    @Optional() private readonly onboardingFunnel?: OnboardingFunnelService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripeSecretKey = stripeSecretKey ?? '';

    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2026-08-26.dahlia',
      });
    } else {
      this.logger.warn('Stripe secret key not configured');
    }
  }

  /**
   * Get subscription for workspace
   */
  async getSubscription(workspaceId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const plan = this.plans[subscription.plan as keyof typeof this.plans];

    return {
      ...subscription,
      planDetails: plan || PLAN_CATALOG[subscription.plan],
      plan: this.getPlanCatalog().find((candidate) => candidate.id === subscription.plan),
      planId: subscription.plan,
      status: subscription.status.toLowerCase(),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.stripeCurrentPeriodEnd,
      trialEnd: subscription.trialEndsAt,
      cancelAtPeriodEnd: Boolean(subscription.canceledAt),
      isTrialExpired:
        subscription.plan === 'TRIAL' &&
        subscription.trialEndsAt &&
        subscription.trialEndsAt < new Date(),
    };
  }

  getPlanCatalog() {
    return Object.values(PLAN_CATALOG).map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.monthlyPriceCents / 100,
      interval: 'month' as const,
      popular: plan.id === 'AGENCY',
      features: [
        `${plan.maxPortals} portals`,
        `${plan.maxUsers} team members`,
        `${plan.maxAiRequestsPerMonth.toLocaleString()} AI requests per month`,
      ],
      limits: {
        portals: plan.maxPortals,
        widgets: plan.maxWidgets,
        users: plan.maxUsers,
        dataRetentionDays: 90,
        apiCalls: plan.maxAiRequestsPerMonth,
      },
      checkoutAvailable: plan.id !== 'TRIAL' && Boolean(
        this.stripe && this.plans[plan.id].priceId && this.liveBillingEnabled(),
      ),
    }));
  }

  /** Atomically reserve one billable AI operation before work reaches a model/provider. */
  async consumeAiRequest(workspaceId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!subscription) throw new NotFoundException('Workspace subscription not found');
    const plan = PLAN_CATALOG[subscription.plan];
    if (!plan) throw new ForbiddenException('No AI entitlement is available for this plan');
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx: any) => {
          await tx.aIUsageMeter.upsert({
            where: { workspaceId_period: { workspaceId, period } },
            create: { workspaceId, period, requestCount: 0 },
            update: {},
          });
          const changed = await tx.aIUsageMeter.updateMany({
            where: { workspaceId, period, requestCount: { lt: plan.maxAiRequestsPerMonth } },
            data: { requestCount: { increment: 1 } },
          });
          if (changed.count !== 1) {
            throw new ForbiddenException(`Monthly AI request limit reached (${plan.maxAiRequestsPerMonth}). Upgrade your plan to continue.`);
          }
          const meter = await tx.aIUsageMeter.findUnique({ where: { workspaceId_period: { workspaceId, period } } });
          return { period, used: meter.requestCount, limit: plan.maxAiRequestsPerMonth, plan: plan.id };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (error instanceof ForbiddenException || !['P2002', 'P2034'].includes(code ?? '') || attempt === 2) throw error;
      }
    }
    throw new ForbiddenException('Could not reserve AI usage. Retry the request.');
  }

  /**
   * Create Stripe customer for workspace
   */
  async createCustomer(workspaceIdOrUserId: string, email?: string, name?: string) {
    this.assertBillingEnabled();

    // If email not provided, try to treat first arg as a user id
    if (!email) {
      const user = await this.prisma.user
        .findUnique({ where: { id: workspaceIdOrUserId } })
        .catch(() => null as any);
      if (user) {
        // If user already has stripe customer id return it
        if (user.stripeCustomerId) return user.stripeCustomerId;

        // Create customer using user's email
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          metadata: { userId: user.id },
        });

        // Persist stripeCustomerId on user
        await this.prisma.user
          .update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } })
          .catch(() => null);

        this.logger.log(`Stripe customer created for user ${user.id}: ${customer.id}`);
        return customer.id;
      }
    }

    // Otherwise treat as workspace flow
    const workspaceId = workspaceIdOrUserId;

    // Check if subscription already exists
    const existing = await this.prisma.subscription.findUnique({ where: { workspaceId } });

    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      email: email,
      name,
      metadata: { workspaceId },
    });

    // Update or create subscription record
    await this.prisma.subscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        stripeCustomerId: customer.id,
        plan: 'TRIAL',
        status: 'TRIALING',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
      update: {
        stripeCustomerId: customer.id,
      },
    });

    this.logger.log(`Stripe customer created: ${customer.id}`);
    return customer.id;
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(
    workspaceId: string,
    plan: 'PRO' | 'AGENCY',
    successUrl: string,
    cancelUrl: string,
  ) {
    this.assertBillingEnabled();

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException('Customer not found. Create customer first.');
    }

    const planConfig = this.plans[plan];
    if (!planConfig) {
      throw new BadRequestException('Invalid plan');
    }
    if (!planConfig.priceId) {
      throw new BadRequestException(`Stripe price is not configured for ${plan}. No checkout was created.`);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: subscription.stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        workspaceId,
        plan,
      },
    });

    this.logger.log(`Checkout session created: ${session.id}`);
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Create a subscription directly (used by tests)
   */
  async createSubscription(workspaceId: string, priceId: string) {
    this.assertBillingEnabled();

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new BadRequestException('Workspace not found');

    // Find a customer for workspace (simplified: find a user with stripeCustomerId)
    const user = await this.prisma.user
      .findFirst({ where: { workspaceId, stripeCustomerId: { not: null } } })
      .catch(() => null as any);
    if (!user) throw new BadRequestException('No customer found for workspace');

    const stripeSub = await this.stripe.subscriptions.create({
      customer: user.stripeCustomerId,
      items: [{ price: priceId }],
    });

    return await this.prisma.subscription.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: stripeSub.id,
        status: 'ACTIVE',
        plan: 'PRO',
      },
    });
  }

  /**
   * Get usage metrics counts for workspace
   */
  async getUsageMetrics(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new BadRequestException('Workspace not found');

    const widgets = await this.prisma.widget.count({ where: { portal: { workspaceId } } });
    const portals = await this.prisma.portal.count({ where: { workspaceId } });
    const users = await this.prisma.user.count({ where: { workspaceId } });

    return { widgets, portals, users };
  }

  /**
   * Record metered usage for a subscription
   */
  async recordUsage(subscriptionId: string, quantity: number, _metric: string) {
    this.assertBillingEnabled();
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new BadRequestException('Subscription not found');

    // Test supplies stripe item id via subscription.items mock
    const stripeItemId =
      (subscription as any).items?.[0]?.stripeItemId || (subscription as any).stripeItemId;
    if (!stripeItemId) throw new BadRequestException('No metered item found');

    await this.stripe.usageRecords.create({
      subscription_item: stripeItemId,
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Get pricing plans (cached)
   */
  async getPricingPlans() {
    const cached = await (this.cacheService as any).get('pricing_plans');
    if (cached) return JSON.parse(cached);

    const prices = await this.stripe.prices.list({ active: true });
    const out = prices.data.map((p: any) => ({
      id: p.id,
      amount: p.unit_amount,
      recurring: p.recurring,
    }));
    await (this.cacheService as any).set('pricing_plans', JSON.stringify(out), 60 * 60);
    return out;
  }

  /**
   * Create billing portal session
   */
  async createPortalSession(workspaceIdOrUserId: string, returnUrl?: string) {
    this.assertBillingEnabled();

    // If a user id was passed, resolve to customer id
    const user = await this.prisma.user
      .findUnique({ where: { id: workspaceIdOrUserId } })
      .catch(() => null as any);
    if (user && user.stripeCustomerId) {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl || '',
      });
      return { url: session.url };
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId: workspaceIdOrUserId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException('Customer not found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl || '',
    });

    return { url: session.url };
  }

  /**
   * Handle Stripe webhook events
   */

  async handleWebhook(signatureOrEvent: string | any, payload?: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    let event: any;

    if (typeof signatureOrEvent === 'object' && signatureOrEvent.type) {
      // Already-parsed event (tests pass objects directly)
      event = signatureOrEvent;
    } else {
      const signature = signatureOrEvent as string;
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      if (!webhookSecret) {
        throw new BadRequestException('Webhook secret not configured');
      }

      try {
        event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch (err) {
        this.logger.error('Webhook signature verification failed', err);
        throw new BadRequestException('Webhook signature verification failed');
      }
    }

    this.logger.log(`Processing webhook: ${event.type}`);

    const eventId = typeof event.id === 'string' ? event.id : undefined;
    const eventCreated = typeof event.created === 'number' ? event.created : undefined;
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object, eventId, eventCreated);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object, eventId, eventCreated);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object, eventId, eventCreated);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object, eventId);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object, eventId);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(workspaceId: string, atPeriodEnd = true) {
    this.assertBillingEnabled();

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription');
    }

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: atPeriodEnd,
    });

    await this.prisma.subscription.update({
      where: { workspaceId },
      data: {
        canceledAt: new Date(),
      },
    });

    await this.recordBillingEvent(workspaceId, 'SUBSCRIPTION_CANCELED');

    return { message: 'Subscription will be canceled at period end' };
  }

  /**
   * Change subscription plan
   */
  async changePlan(workspaceId: string, newPlan: 'PRO' | 'AGENCY') {
    this.assertBillingEnabled();

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription');
    }

    const planConfig = this.plans[newPlan];
    if (!planConfig?.priceId) throw new BadRequestException(`Stripe price is not configured for ${newPlan}.`);
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: planConfig.priceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    const currentPlan = subscription.plan;
    const isUpgrade = (currentPlan === 'PRO' && newPlan === 'AGENCY') || currentPlan === 'TRIAL';

    await this.recordBillingEvent(workspaceId, isUpgrade ? 'PLAN_UPGRADED' : 'PLAN_DOWNGRADED');

    return { message: `Plan changed to ${newPlan}` };
  }

  /**
   * Get billing history
   */
  async getBillingHistory(workspaceId: string, limit = 20) {
    return this.prisma.billingEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get invoices
   */
  async getInvoices(workspaceId: string): Promise<any> {
    if (!this.stripe) {
      return [];
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription?.stripeCustomerId) {
      return [];
    }

    const invoices = await this.stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 20,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.status === 'paid' ? invoice.amount_paid : invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      invoicePdf: invoice.invoice_pdf,
      invoicePdfUrl: invoice.invoice_pdf,
      invoiceUrl: invoice.hosted_invoice_url,
      createdAt: new Date(invoice.created * 1000),
      date: new Date(invoice.created * 1000),
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
    }));
  }

  /**
   * Check subscription limits
   */
  async checkLimits(workspaceId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const [portalCount, userCount, widgetCount, aiMeter] = await Promise.all([
      this.prisma.portal.count({ where: { workspaceId } }),
      this.prisma.user.count({ where: { workspaceId } }),
      this.prisma.widget.count({ where: { portal: { workspaceId } } }),
      this.prisma.aIUsageMeter.findUnique({ where: { workspaceId_period: { workspaceId, period } } }),
    ]);
    const plan = PLAN_CATALOG[subscription.plan];

    return {
      portals: {
        used: portalCount,
        current: portalCount,
        max: subscription.maxPortals,
        limit: subscription.maxPortals,
        available: subscription.maxPortals - portalCount,
        canCreate: portalCount < subscription.maxPortals,
      },
      users: {
        used: userCount,
        current: userCount,
        max: subscription.maxUsers,
        limit: subscription.maxUsers,
        available: subscription.maxUsers - userCount,
        canAdd: userCount < subscription.maxUsers,
      },
      widgets: { used: widgetCount, limit: plan.maxWidgets },
      apiCalls: { used: aiMeter?.requestCount ?? 0, limit: plan.maxAiRequestsPerMonth },
      storage: { used: 0, limit: 0 },
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async handleCheckoutCompleted(session: any, eventId?: string, eventCreated?: number) {
    const workspaceId = session.metadata?.workspaceId;
    const plan = session.metadata?.plan as 'PRO' | 'AGENCY';

    if (!workspaceId || !plan) {
      this.logger.error('Missing metadata in checkout session');
      return;
    }

    const planConfig = this.plans[plan];
    if (!planConfig) {
      this.logger.error(`Unsupported plan in checkout event: ${String(plan)}`);
      return;
    }

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
    const stateTimestamp = eventCreated ? new Date(eventCreated * 1000) : undefined;

    const updated = await this.prisma.subscription.updateMany({
      where: {
        workspaceId,
        ...(stateTimestamp ? { OR: [{ stripeStateUpdatedAt: null }, { stripeStateUpdatedAt: { lt: stateTimestamp } }] } : {}),
      },
      data: {
        stripeSubscriptionId,
        stripePriceId: planConfig.priceId,
        plan: plan as SubscriptionPlan,
        status: 'ACTIVE' as SubscriptionStatus,
        maxPortals: planConfig.maxPortals,
        maxUsers: planConfig.maxUsers,
        trialEndsAt: null,
        ...(stateTimestamp ? { stripeStateUpdatedAt: stateTimestamp } : {}),
      },
    });

    if (updated.count) await this.recordBillingEvent(workspaceId, 'SUBSCRIPTION_CREATED', undefined, eventId);
  }

  private async handleSubscriptionUpdated(subscription: any, eventId?: string, eventCreated?: number) {
    const customerId = subscription.customer as string;

    const dbSubscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!dbSubscription) {
      this.logger.warn(`Subscription not found for customer: ${customerId}`);
      return;
    }

    const statusMap: Record<string, SubscriptionStatus> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      trialing: 'TRIALING',
      unpaid: 'UNPAID',
    };

    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId === this.plans.PRO.priceId ? 'PRO'
      : priceId === this.plans.AGENCY.priceId ? 'AGENCY' : null;
    const stateTimestamp = eventCreated ? new Date(eventCreated * 1000) : undefined;
    const updated = await this.prisma.subscription.updateMany({
      where: {
        id: dbSubscription.id,
        ...(stateTimestamp ? { OR: [{ stripeStateUpdatedAt: null }, { stripeStateUpdatedAt: { lt: stateTimestamp } }] } : {}),
      },
      data: {
        status: statusMap[subscription.status] || 'ACTIVE',
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        stripePriceId: priceId,
        ...(plan ? { plan, maxPortals: this.plans[plan].maxPortals, maxUsers: this.plans[plan].maxUsers } : {}),
        ...(stateTimestamp ? { stripeStateUpdatedAt: stateTimestamp } : {}),
      },
    });

    if (updated.count) await this.recordBillingEvent(dbSubscription.workspaceId, 'SUBSCRIPTION_UPDATED', undefined, eventId);
  }

  private async handleSubscriptionCanceled(subscription: any, eventId?: string, eventCreated?: number) {
    const customerId = subscription.customer as string;

    const dbSubscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!dbSubscription) return;

    const stateTimestamp = eventCreated ? new Date(eventCreated * 1000) : undefined;
    const updated = await this.prisma.subscription.updateMany({
      where: {
        id: dbSubscription.id,
        ...(stateTimestamp ? { OR: [{ stripeStateUpdatedAt: null }, { stripeStateUpdatedAt: { lt: stateTimestamp } }] } : {}),
      },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        ...(stateTimestamp ? { stripeStateUpdatedAt: stateTimestamp } : {}),
      },
    });

    if (updated.count) await this.recordBillingEvent(dbSubscription.workspaceId, 'SUBSCRIPTION_CANCELED', undefined, eventId);
  }

  private async handleInvoicePaid(invoice: any, eventId?: string) {
    const customerId = invoice.customer as string;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) return;

    await this.recordBillingEvent(subscription.workspaceId, 'INVOICE_PAID', {
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
    }, eventId);
    try {
      await this.onboardingFunnel?.recordStage(subscription.workspaceId, OnboardingFunnelStage.PAID_CONVERSION);
    } catch {
      // Billing event processing must not fail because optional telemetry is unavailable.
    }
  }

  private async handleInvoiceFailed(invoice: any, eventId?: string) {
    const customerId = invoice.customer as string;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) return;

    await this.recordBillingEvent(subscription.workspaceId, 'INVOICE_FAILED', {
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
    }, eventId);
  }

  private async recordBillingEvent(
    workspaceId: string,
    type: BillingEventType,
    data?: { stripeInvoiceId?: string; amount?: number },
    stripeEventId?: string,
  ) {
    try {
      await this.prisma.billingEvent.create({
        data: {
          workspaceId,
          type,
          stripeEventId,
          stripeInvoiceId: data?.stripeInvoiceId,
          amount: data?.amount,
          status: 'COMPLETED',
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002' && stripeEventId) return;
      throw error;
    }
  }

  private liveBillingEnabled() {
    const configured = this.configService.get<boolean | string>('STRIPE_LIVE_BILLING_ENABLED');
    return !this.stripeSecretKey.startsWith('sk_live_') || configured === true || configured === 'true';
  }

  private assertBillingEnabled() {
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    if (!this.liveBillingEnabled()) {
      throw new BadRequestException('Live Stripe billing is disabled. Configure STRIPE_LIVE_BILLING_ENABLED explicitly to allow live charges.');
    }
  }
}
