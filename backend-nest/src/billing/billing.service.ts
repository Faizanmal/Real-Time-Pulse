import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  BillingEventType,
  BillingEventStatus,
} from '@prisma/client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  // Plan configurations
  private readonly plans = {
    PRO: {
      name: 'Pro',
      priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
      amount: 4900, // $49.00
      maxPortals: 5,
      maxUsers: 1,
    },
    AGENCY: {
      name: 'Agency',
      priceId: process.env.STRIPE_AGENCY_PRICE_ID || 'price_agency',
      amount: 9900, // $99.00
      maxPortals: 15,
      maxUsers: 5,
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-02-24.acacia',
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
      planDetails: plan || null,
      isTrialExpired:
        subscription.plan === 'TRIAL' &&
        subscription.trialEndsAt &&
        subscription.trialEndsAt < new Date(),
    };
  }

  /**
   * Create Stripe customer for workspace
   */
  async createCustomer(workspaceId: string, email: string, name?: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    // Check if subscription already exists
    const existing = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (existing?.stripeCustomerId) {
      return { customerId: existing.stripeCustomerId };
    }

    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      email,
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
    return { customerId: customer.id };
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
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

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
   * Create billing portal session
   */
  async createPortalSession(workspaceId: string, returnUrl: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException('Customer not found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Processing webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object as Stripe.Invoice);
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
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

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

    await this.recordBillingEvent(workspaceId, BillingEventType.SUBSCRIPTION_CANCELED);

    return { message: 'Subscription will be canceled at period end' };
  }

  /**
   * Change subscription plan
   */
  async changePlan(workspaceId: string, newPlan: 'PRO' | 'AGENCY') {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription');
    }

    const planConfig = this.plans[newPlan];
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
    const isUpgrade =
      (currentPlan === 'PRO' && newPlan === 'AGENCY') ||
      currentPlan === 'TRIAL';

    await this.recordBillingEvent(
      workspaceId,
      isUpgrade ? BillingEventType.PLAN_UPGRADED : BillingEventType.PLAN_DOWNGRADED,
    );

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
  async getInvoices(workspaceId: string) {
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
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      createdAt: new Date(invoice.created * 1000),
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

    const [portalCount, userCount] = await Promise.all([
      this.prisma.portal.count({ where: { workspaceId } }),
      this.prisma.user.count({ where: { workspaceId } }),
    ]);

    return {
      portals: {
        current: portalCount,
        max: subscription.maxPortals,
        available: subscription.maxPortals - portalCount,
        canCreate: portalCount < subscription.maxPortals,
      },
      users: {
        current: userCount,
        max: subscription.maxUsers,
        available: subscription.maxUsers - userCount,
        canAdd: userCount < subscription.maxUsers,
      },
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const workspaceId = session.metadata?.workspaceId;
    const plan = session.metadata?.plan as 'PRO' | 'AGENCY';

    if (!workspaceId || !plan) {
      this.logger.error('Missing metadata in checkout session');
      return;
    }

    const planConfig = this.plans[plan];

    await this.prisma.subscription.update({
      where: { workspaceId },
      data: {
        stripeSubscriptionId: session.subscription as string,
        plan: plan as SubscriptionPlan,
        status: 'ACTIVE' as SubscriptionStatus,
        maxPortals: planConfig.maxPortals,
        maxUsers: planConfig.maxUsers,
        trialEndsAt: null,
      },
    });

    await this.recordBillingEvent(workspaceId, BillingEventType.SUBSCRIPTION_CREATED);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
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

    await this.prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: statusMap[subscription.status] || 'ACTIVE',
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        stripePriceId: subscription.items.data[0]?.price.id,
      },
    });

    await this.recordBillingEvent(
      dbSubscription.workspaceId,
      BillingEventType.SUBSCRIPTION_UPDATED,
    );
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const dbSubscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!dbSubscription) return;

    await this.prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });

    await this.recordBillingEvent(
      dbSubscription.workspaceId,
      BillingEventType.SUBSCRIPTION_CANCELED,
    );
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) return;

    await this.recordBillingEvent(
      subscription.workspaceId,
      BillingEventType.INVOICE_PAID,
      {
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
      },
    );
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) return;

    await this.recordBillingEvent(
      subscription.workspaceId,
      BillingEventType.INVOICE_FAILED,
      {
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due,
      },
    );
  }

  private async recordBillingEvent(
    workspaceId: string,
    type: BillingEventType,
    data?: { stripeInvoiceId?: string; amount?: number },
  ) {
    await this.prisma.billingEvent.create({
      data: {
        workspaceId,
        type,
        stripeInvoiceId: data?.stripeInvoiceId,
        amount: data?.amount,
        status: BillingEventStatus.COMPLETED,
      },
    });
  }
}
