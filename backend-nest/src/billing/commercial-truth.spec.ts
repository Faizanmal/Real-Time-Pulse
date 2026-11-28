import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { CacheService } from '../cache/cache.service';
import type { PrismaService } from '../prisma/prisma.service';

import { AiUsageLimitGuard } from './ai-usage-limit.guard';
import { BillingService } from './billing.service';

describe('commercial billing truth', () => {
  const workspaceId = 'workspace-fictional-a';
  const prisma: any = {
    subscription: { findUnique: jest.fn() },
    billingEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const cache: any = { get: jest.fn(), set: jest.fn() };
  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    const prismaRef: unknown = prisma;
    const cacheRef: unknown = cache;
    service = new BillingService(
      prismaRef as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      cacheRef as CacheService,
    );
  });

  it('serves the same plan price and limits that the server enforces', () => {
    const plans = service.getPlanCatalog();
    expect(plans.find((plan) => plan.id === 'PRO')).toMatchObject({
      price: 49,
      limits: { portals: 5, users: 1, apiCalls: 1000 },
    });
    expect(plans.find((plan) => plan.id === 'AGENCY')).toMatchObject({
      price: 99,
      limits: { portals: 15, users: 5, apiCalls: 10000 },
    });
    expect(plans.find((plan) => plan.id === 'TRIAL')).toMatchObject({
      price: 0,
      limits: { portals: 5, users: 1, apiCalls: 100 },
    });
    expect(plans.filter((plan) => plan.id !== 'TRIAL').every((plan) => plan.checkoutAvailable === false)).toBe(true);
  });

  it('keeps fictional demo checkout from using a live Stripe key unless explicitly enabled', async () => {
    const prismaRef: unknown = prisma;
    const cacheRef: unknown = cache;
    const liveKeyConfig = {
      get: (key: string) => key === 'STRIPE_SECRET_KEY' ? 'sk_live_fictional_demo_key' : undefined,
    } as unknown as ConfigService;
    const liveService = new BillingService(prismaRef as PrismaService, liveKeyConfig, cacheRef as CacheService);
    expect(liveService.getPlanCatalog().find((plan) => plan.id === 'PRO')?.checkoutAvailable).toBe(false);
    await expect(liveService.createCheckoutSession(workspaceId, 'PRO', 'https://demo.invalid/success', 'https://demo.invalid/cancel'))
      .rejects.toThrow('Live Stripe billing is disabled');
  });

  it('atomically permits only the plan monthly AI quota', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ plan: 'TRIAL' });
    let used = 0;
    const tx = {
      aIUsageMeter: {
        upsert: jest.fn(),
        updateMany: jest.fn(async ({ where }: any) => {
          if (used >= where.requestCount.lt) return { count: 0 };
          used += 1;
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({ requestCount: used })),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    for (let index = 0; index < 100; index += 1) await service.consumeAiRequest(workspaceId);
    await expect(service.consumeAiRequest(workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(used).toBe(100);
  });

  it('does not let a member reserve usage against another workspace subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    const guard = new AiUsageLimitGuard(service);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { workspaceId: 'workspace-other-tenant' } }),
      }),
    } as unknown as import('@nestjs/common').ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow('Workspace subscription not found');
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-other-tenant' },
    });
  });

  it('ignores older reordered Stripe subscription snapshots and records the current event once', async () => {
    (service as any).stripe = {};
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'subscription-a',
      workspaceId,
      stripeCustomerId: 'cus_fixture',
    });
    const changedDates: Date[] = [];
    const updates: any[] = [];
    prisma.subscription.updateMany = jest.fn(async ({ where }: any) => {
      const incoming = where.OR?.[1]?.stripeStateUpdatedAt?.lt as Date | undefined;
      if (incoming) changedDates.push(incoming);
      updates.push(where);
      return { count: changedDates.length === 1 ? 1 : 0 };
    });
    prisma.billingEvent.create.mockResolvedValue({ id: 'billing-event-fixture' });

    await service.handleWebhook({
      id: 'evt_fixture_new',
      type: 'customer.subscription.updated',
      created: 200,
      data: {
        object: {
          customer: 'cus_fixture',
          status: 'active',
          current_period_end: 1800000000,
          items: { data: [{ price: { id: '' } }] },
        },
      },
    });
    await service.handleWebhook({
      id: 'evt_fixture_old',
      type: 'customer.subscription.updated',
      created: 100,
      data: {
        object: {
          customer: 'cus_fixture',
          status: 'past_due',
          current_period_end: 1700000000,
          items: { data: [{ price: { id: '' } }] },
        },
      },
    });

    expect(changedDates).toEqual([new Date(200000), new Date(100000)]);
    expect(updates[1].OR[1].stripeStateUpdatedAt.lt).toEqual(new Date(100000));
    expect(prisma.billingEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.billingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stripeEventId: 'evt_fixture_new' }),
      }),
    );
  });

  it('applies checkout plan limits and refuses to roll them back from an older subscription fixture', async () => {
    (service as any).stripe = {};
    (service as any).plans.PRO.priceId = 'price_fixture_pro';
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'subscription-a',
      workspaceId,
      stripeCustomerId: 'cus_fixture',
    });
    const writes: any[] = [];
    prisma.subscription.updateMany = jest.fn(async ({ data }: any) => {
      writes.push(data);
      return { count: writes.length === 1 ? 1 : 0 };
    });
    prisma.billingEvent.create.mockResolvedValue({ id: 'billing-event-fixture' });

    await service.handleWebhook({
      id: 'evt_checkout_new',
      type: 'checkout.session.completed',
      created: 200,
      data: { object: { metadata: { workspaceId, plan: 'PRO' }, subscription: 'sub_fixture' } },
    });
    await service.handleWebhook({
      id: 'evt_subscription_old',
      type: 'customer.subscription.updated',
      created: 100,
      data: {
        object: {
          customer: 'cus_fixture',
          status: 'past_due',
          current_period_end: 1700000000,
          items: { data: [{ price: { id: 'price_fixture_pro' } }] },
        },
      },
    });

    expect(writes[0]).toMatchObject({ plan: 'PRO', status: 'ACTIVE', maxPortals: 5, maxUsers: 1 });
    expect(writes).toHaveLength(2);
    expect(prisma.billingEvent.create).toHaveBeenCalledTimes(1);
  });

  it('treats duplicate invoice event IDs as already recorded', async () => {
    (service as any).stripe = {};
    prisma.subscription.findUnique.mockResolvedValue({ workspaceId });
    let stored = false;
    prisma.billingEvent.create.mockImplementation(async () => {
      if (stored) throw Object.assign(new Error('unique'), { code: 'P2002' });
      stored = true;
      return { id: 'invoice-event-fixture' };
    });
    await service.handleWebhook({
      id: 'evt_invoice_fixture',
      type: 'invoice.paid',
      data: { object: { customer: 'cus_fixture', id: 'in_fixture', amount_paid: 4900 } },
    });
    await service.handleWebhook({
      id: 'evt_invoice_fixture',
      type: 'invoice.paid',
      data: { object: { customer: 'cus_fixture', id: 'in_fixture', amount_paid: 4900 } },
    });
    expect(prisma.billingEvent.create).toHaveBeenCalledTimes(2);
    expect(stored).toBe(true);
  });
});
