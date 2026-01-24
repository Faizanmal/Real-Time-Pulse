/**
 * Enhanced Billing Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import {
  createMockPrismaService,
  createMockConfigService,
  createMockRedisService,
  createTestUser,
  createTestWorkspace,
} from 'common/testing/test-utils';

describe('BillingService', () => {
  let service: BillingService;
  let prismaService: any;
  let cacheService: any;

  const mockStripe = {
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@example.com' }),
      update: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        items: { data: [{ price: { id: 'price_test' } }] },
      }),
      update: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
      cancel: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' }),
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc',
        status: 'requires_payment_method',
      }),
      retrieve: jest.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded' }),
    },
    invoices: {
      list: jest.fn().mockResolvedValue({ data: [] }),
      retrieve: jest.fn().mockResolvedValue({ id: 'in_test123' }),
      upcoming: jest.fn().mockResolvedValue({ amount_due: 2999 }),
    },
    prices: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'price_starter', unit_amount: 999, recurring: { interval: 'month' } },
          { id: 'price_pro', unit_amount: 2999, recurring: { interval: 'month' } },
          { id: 'price_enterprise', unit_amount: 9999, recurring: { interval: 'month' } },
        ],
      }),
    },
    products: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'prod_starter', name: 'Starter', active: true },
          { id: 'prod_pro', name: 'Pro', active: true },
          { id: 'prod_enterprise', name: 'Enterprise', active: true },
        ],
      }),
    },
    usageRecords: {
      create: jest.fn().mockResolvedValue({ id: 'mbur_test' }),
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/session/test' }),
      },
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/session/test',
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test' } },
      }),
    },
  };

  beforeEach(async () => {
    prismaService = createMockPrismaService();
    cacheService = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ConfigService,
          useValue: createMockConfigService({ 'stripe.secretKey': 'sk_test' }),
        },
        { provide: CacheService, useValue: cacheService },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        { provide: 'STRIPE_CLIENT', useValue: mockStripe },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('createCustomer', () => {
    it('should create a Stripe customer for a user', async () => {
      const user = createTestUser();
      prismaService.user.update.mockResolvedValue({ ...user, stripeCustomerId: 'cus_test123' });

      const result = await service.createCustomer(user.id);

      expect(result).toBe('cus_test123');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: user.email }),
      );
    });

    it('should not create duplicate customer if already exists', async () => {
      const user = createTestUser({ stripeCustomerId: 'cus_existing' });
      prismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.createCustomer(user.id);

      expect(result).toBe('cus_existing');
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });
  });

  describe('createSubscription', () => {
    it('should create a subscription for a workspace', async () => {
      const workspace = createTestWorkspace();
      const user = createTestUser({ stripeCustomerId: 'cus_test123' });
      prismaService.workspace.findUnique.mockResolvedValue(workspace);
      prismaService.user.findUnique.mockResolvedValue(user);
      prismaService.subscription.create.mockResolvedValue({
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_test123',
      });

      const result = await service.createSubscription(workspace.id, 'price_pro');

      expect(result).toBeDefined();
      expect(result.stripeSubscriptionId).toBe('sub_test123');
    });

    it('should throw error if workspace not found', async () => {
      prismaService.workspace.findUnique.mockResolvedValue(null);

      await expect(service.createSubscription('non-existent', 'price_pro')).rejects.toThrow();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const subscription = {
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      };
      prismaService.subscription.findUnique.mockResolvedValue(subscription);
      prismaService.subscription.update.mockResolvedValue({
        ...subscription,
        cancelAtPeriodEnd: true,
      });

      await service.cancelSubscription(subscription.id);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({ cancel_at_period_end: true }),
      );
    });

    it('should allow immediate cancellation', async () => {
      const subscription = {
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      };
      prismaService.subscription.findUnique.mockResolvedValue(subscription);
      prismaService.subscription.update.mockResolvedValue({ ...subscription, status: 'canceled' });

      await service.cancelSubscription(subscription.id, true);

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123');
    });
  });

  describe('getUsageMetrics', () => {
    it('should return usage metrics for a workspace', async () => {
      const workspace = createTestWorkspace();
      prismaService.workspace.findUnique.mockResolvedValue(workspace);
      prismaService.widget.count.mockResolvedValue(15);
      prismaService.portal.count.mockResolvedValue(3);
      prismaService.user.count.mockResolvedValue(5);

      const result = await service.getUsageMetrics(workspace.id);

      expect(result).toHaveProperty('widgets', 15);
      expect(result).toHaveProperty('portals', 3);
      expect(result).toHaveProperty('users', 5);
    });
  });

  describe('recordUsage', () => {
    it('should record usage for metered billing', async () => {
      const subscription = {
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_test123',
        items: [{ priceId: 'price_metered', stripeItemId: 'si_test' }],
      };
      prismaService.subscription.findUnique.mockResolvedValue(subscription);

      await service.recordUsage(subscription.id, 100, 'api_calls');

      expect(mockStripe.usageRecords.create).toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should process subscription updated event', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test123',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };
      prismaService.subscription.update.mockResolvedValue({});

      await service.handleWebhook(event);

      expect(prismaService.subscription.update).toHaveBeenCalled();
    });

    it('should process subscription deleted event', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_test123' } },
      };
      prismaService.subscription.update.mockResolvedValue({});

      await service.handleWebhook(event);

      expect(prismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: 'sub_test123' },
          data: expect.objectContaining({ status: 'canceled' }),
        }),
      );
    });

    it('should process invoice payment succeeded event', async () => {
      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test123',
            subscription: 'sub_test123',
            amount_paid: 2999,
          },
        },
      };
      prismaService.invoice.create.mockResolvedValue({});

      await service.handleWebhook(event);

      expect(prismaService.invoice.create).toHaveBeenCalled();
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      const user = createTestUser({ stripeCustomerId: 'cus_test123' });
      prismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.createPortalSession(user.id);

      expect(result).toHaveProperty('url');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_test123' }),
      );
    });
  });

  describe('getPricingPlans', () => {
    it('should return available pricing plans', async () => {
      const result = await service.getPricingPlans();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should cache pricing plans', async () => {
      cacheService.get.mockResolvedValue(JSON.stringify([{ id: 'price_cached' }]));

      const result = await service.getPricingPlans();

      expect(mockStripe.prices.list).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'price_cached' }]);
    });
  });
});
