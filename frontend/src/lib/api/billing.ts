'use client';

import { apiClient } from './client';

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
  limits: {
    portals: number;
    widgets: number;
    users: number;
    dataRetentionDays: number;
    apiCalls: number;
  };
  stripePriceId: string;
}

export interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  plan: BillingPlan;
  planId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'draft' | 'uncollectible';
  invoicePdf?: string;
  pdfUrl?: string;
  date: string;
  createdAt: string;
  paidAt?: string;
  description?: string;
}

export interface UsageLimits {
  portals: { used: number; limit: number };
  widgets: { used: number; limit: number };
  users: { used: number; limit: number };
  apiCalls: { used: number; limit: number };
  storage: { used: number; limit: number };
}

export const billingApi = {
  getPlans: async (): Promise<BillingPlan[]> => {
    return apiClient.get<BillingPlan[]>('/billing/plans');
  },

  getSubscription: async (): Promise<Subscription | null> => {
    return apiClient.get<Subscription | null>('/billing/subscription');
  },

  getCurrentSubscription: async (): Promise<Subscription | null> => {
    return apiClient.get<Subscription | null>('/billing/subscription');
  },

  createCustomer: async (): Promise<{ customerId: string }> => {
    return apiClient.post<{ customerId: string }>('/billing/customer');
  },

  createCheckout: async (priceId: string): Promise<{ url: string; sessionId: string }> => {
    return apiClient.post<{ url: string; sessionId: string }>('/billing/checkout', { priceId });
  },

  createCheckoutSession: async (planId: string): Promise<{ url: string; sessionId: string }> => {
    return apiClient.post<{ url: string; sessionId: string }>('/billing/checkout', { planId });
  },

  createPortalSession: async (returnUrl?: string): Promise<{ url: string }> => {
    return apiClient.post<{ url: string }>('/billing/portal', { returnUrl });
  },

  cancelSubscription: async (immediately?: boolean): Promise<{ success: boolean }> => {
    return apiClient.post<{ success: boolean }>(`/billing/cancel${immediately ? '?immediately=true' : ''}`);
  },

  changePlan: async (newPriceId: string): Promise<Subscription> => {
    return apiClient.post<Subscription>('/billing/change-plan', { newPriceId });
  },

  getBillingHistory: async (limit?: number): Promise<Invoice[]> => {
    return apiClient.get<Invoice[]>(`/billing/history${limit ? `?limit=${limit}` : ''}`);
  },

  getInvoices: async (): Promise<Invoice[]> => {
    return apiClient.get<Invoice[]>('/billing/invoices');
  },

  getUsageLimits: async (): Promise<UsageLimits> => {
    return apiClient.get<UsageLimits>('/billing/limits');
  },
};

