import { SubscriptionPlan } from '@prisma/client';

export interface CommercialPlan {
  id: SubscriptionPlan;
  name: string;
  description: string;
  monthlyPriceCents: number;
  maxPortals: number;
  maxUsers: number;
  maxAiRequestsPerMonth: number;
  maxWidgets: number;
}

/** One server-side catalog drives advertised prices and enforced limits. */
export const PLAN_CATALOG: Record<SubscriptionPlan, CommercialPlan> = {
  TRIAL: {
    id: 'TRIAL',
    name: 'Trial',
    description: 'Explore Real-Time Pulse with sample data.',
    monthlyPriceCents: 0,
    maxPortals: 5,
    maxUsers: 1,
    maxAiRequestsPerMonth: 100,
    maxWidgets: 25,
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    description: 'Advanced tools for growing agencies.',
    monthlyPriceCents: 4900,
    maxPortals: 5,
    maxUsers: 1,
    maxAiRequestsPerMonth: 1000,
    maxWidgets: 100,
  },
  AGENCY: {
    id: 'AGENCY',
    name: 'Agency',
    description: 'Higher limits for agency teams.',
    monthlyPriceCents: 9900,
    maxPortals: 15,
    maxUsers: 5,
    maxAiRequestsPerMonth: 10000,
    maxWidgets: 1000,
  },
};

export function planPriceId(plan: 'PRO' | 'AGENCY') {
  return plan === 'PRO'
    ? process.env.STRIPE_PRO_PRICE_ID || ''
    : process.env.STRIPE_AGENCY_PRICE_ID || '';
}
