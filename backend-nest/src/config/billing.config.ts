import { registerAs } from '@nestjs/config';

export default registerAs('billing', () => ({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    apiVersion: '2024-12-18.acacia' as const,
  },
  plans: {
    free: {
      id: 'free',
      name: 'Free',
      priceId: null,
      limits: {
        portals: 3,
        widgets: 10,
        integrations: 2,
        users: 1,
        storage: 100 * 1024 * 1024, // 100MB
        apiCalls: 1000,
        scheduledReports: 0,
        aiInsights: 10,
      },
    },
    starter: {
      id: 'starter',
      name: 'Starter',
      priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
      limits: {
        portals: 10,
        widgets: 50,
        integrations: 5,
        users: 5,
        storage: 1024 * 1024 * 1024, // 1GB
        apiCalls: 10000,
        scheduledReports: 5,
        aiInsights: 100,
      },
    },
    professional: {
      id: 'professional',
      name: 'Professional',
      priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || '',
      limits: {
        portals: 50,
        widgets: 200,
        integrations: 20,
        users: 25,
        storage: 10 * 1024 * 1024 * 1024, // 10GB
        apiCalls: 100000,
        scheduledReports: 25,
        aiInsights: 500,
      },
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
      limits: {
        portals: -1, // unlimited
        widgets: -1,
        integrations: -1,
        users: -1,
        storage: -1,
        apiCalls: -1,
        scheduledReports: -1,
        aiInsights: -1,
      },
    },
  },
  trialDays: parseInt(process.env.TRIAL_DAYS || '14', 10),
  billingPortalReturnUrl: process.env.BILLING_PORTAL_RETURN_URL || 'http://localhost:3000/settings/billing',
  checkoutSuccessUrl: process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/settings/billing?success=true',
  checkoutCancelUrl: process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/settings/billing?canceled=true',
}));
