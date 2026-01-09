import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface StripeConnectIntegration {
  accessToken: string; // Stripe Secret Key
  refreshToken?: string; // For OAuth connected accounts
  settings: {
    accountId?: string; // Connected account ID
    webhookSecret?: string;
  };
}

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(
    integration: StripeConnectIntegration,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (integration.settings.accountId) {
      headers['Stripe-Account'] = integration.settings.accountId;
    }

    return headers;
  }

  async testConnection(
    integration: StripeConnectIntegration,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/account`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Stripe Connect connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: StripeConnectIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'account':
        return this.fetchAccount(integration);
      case 'balance':
        return this.fetchBalance(integration);
      case 'charges':
        return this.fetchCharges(integration, params);
      case 'paymentIntents':
        return this.fetchPaymentIntents(integration, params);
      case 'customers':
        return this.fetchCustomers(integration, params);
      case 'subscriptions':
        return this.fetchSubscriptions(integration, params);
      case 'invoices':
        return this.fetchInvoices(integration, params);
      case 'payouts':
        return this.fetchPayouts(integration, params);
      case 'disputes':
        return this.fetchDisputes(integration, params);
      case 'connectedAccounts':
        return this.fetchConnectedAccounts(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported Stripe Connect data type: ${dataType}`);
    }
  }

  private async fetchAccount(
    integration: StripeConnectIntegration,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/account`, {
          headers: this.getHeaders(integration),
        }),
      );

      return {
        id: response.data.id,
        type: response.data.type,
        email: response.data.email,
        businessProfile: response.data.business_profile,
        capabilities: response.data.capabilities,
        chargesEnabled: response.data.charges_enabled,
        payoutsEnabled: response.data.payouts_enabled,
        country: response.data.country,
        defaultCurrency: response.data.default_currency,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe account', error);
      throw error;
    }
  }

  private async fetchBalance(
    integration: StripeConnectIntegration,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/balance`, {
          headers: this.getHeaders(integration),
        }),
      );

      return {
        available: response.data.available,
        pending: response.data.pending,
        connectReserved: response.data.connect_reserved,
        livemode: response.data.livemode,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe balance', error);
      throw error;
    }
  }

  private async fetchCharges(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;
      const created = params?.created as { gte?: number; lte?: number };

      const queryParams = new URLSearchParams({ limit: limit.toString() });
      if (created?.gte) queryParams.set('created[gte]', created.gte.toString());
      if (created?.lte) queryParams.set('created[lte]', created.lte.toString());

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/charges?${queryParams.toString()}`,
          {
            headers: this.getHeaders(integration),
          },
        ),
      );

      return {
        charges: response.data.data.map((charge: any) => ({
          id: charge.id,
          amount: charge.amount,
          currency: charge.currency,
          status: charge.status,
          paid: charge.paid,
          refunded: charge.refunded,
          customer: charge.customer,
          paymentMethod: charge.payment_method,
          created: new Date(charge.created * 1000).toISOString(),
          description: charge.description,
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe charges', error);
      throw error;
    }
  }

  private async fetchPaymentIntents(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/payment_intents?limit=${limit}`, {
          headers: this.getHeaders(integration),
        }),
      );

      return {
        paymentIntents: response.data.data.map((pi: any) => ({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          customer: pi.customer,
          paymentMethod: pi.payment_method,
          created: new Date(pi.created * 1000).toISOString(),
          description: pi.description,
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe payment intents', error);
      throw error;
    }
  }

  private async fetchCustomers(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;
      const email = params?.email as string;

      const queryParams = new URLSearchParams({ limit: limit.toString() });
      if (email) queryParams.set('email', email);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/customers?${queryParams.toString()}`,
          {
            headers: this.getHeaders(integration),
          },
        ),
      );

      return {
        customers: response.data.data.map((cust: any) => ({
          id: cust.id,
          email: cust.email,
          name: cust.name,
          phone: cust.phone,
          balance: cust.balance,
          currency: cust.currency,
          delinquent: cust.delinquent,
          created: new Date(cust.created * 1000).toISOString(),
          metadata: cust.metadata,
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe customers', error);
      throw error;
    }
  }

  private async fetchSubscriptions(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;
      const status = params?.status as string;

      const queryParams = new URLSearchParams({ limit: limit.toString() });
      if (status) queryParams.set('status', status);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/subscriptions?${queryParams.toString()}`,
          {
            headers: this.getHeaders(integration),
          },
        ),
      );

      return {
        subscriptions: response.data.data.map((sub: any) => ({
          id: sub.id,
          customer: sub.customer,
          status: sub.status,
          currentPeriodStart: new Date(
            sub.current_period_start * 1000,
          ).toISOString(),
          currentPeriodEnd: new Date(
            sub.current_period_end * 1000,
          ).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          items: sub.items.data.map((item: any) => ({
            id: item.id,
            priceId: item.price.id,
            quantity: item.quantity,
          })),
          created: new Date(sub.created * 1000).toISOString(),
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe subscriptions', error);
      throw error;
    }
  }

  private async fetchInvoices(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;
      const status = params?.status as string;

      const queryParams = new URLSearchParams({ limit: limit.toString() });
      if (status) queryParams.set('status', status);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/invoices?${queryParams.toString()}`,
          {
            headers: this.getHeaders(integration),
          },
        ),
      );

      return {
        invoices: response.data.data.map((inv: any) => ({
          id: inv.id,
          customer: inv.customer,
          status: inv.status,
          amountDue: inv.amount_due,
          amountPaid: inv.amount_paid,
          amountRemaining: inv.amount_remaining,
          currency: inv.currency,
          dueDate: inv.due_date
            ? new Date(inv.due_date * 1000).toISOString()
            : null,
          created: new Date(inv.created * 1000).toISOString(),
          hostedInvoiceUrl: inv.hosted_invoice_url,
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe invoices', error);
      throw error;
    }
  }

  private async fetchPayouts(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/payouts?limit=${limit}`, {
          headers: this.getHeaders(integration),
        }),
      );

      return {
        payouts: response.data.data.map((payout: any) => ({
          id: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
          arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
          method: payout.method,
          type: payout.type,
          created: new Date(payout.created * 1000).toISOString(),
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe payouts', error);
      throw error;
    }
  }

  private async fetchDisputes(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/disputes?limit=${limit}`, {
          headers: this.getHeaders(integration),
        }),
      );

      return {
        disputes: response.data.data.map((dispute: any) => ({
          id: dispute.id,
          amount: dispute.amount,
          currency: dispute.currency,
          status: dispute.status,
          reason: dispute.reason,
          charge: dispute.charge,
          isChargeRefundable: dispute.is_charge_refundable,
          created: new Date(dispute.created * 1000).toISOString(),
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe disputes', error);
      throw error;
    }
  }

  private async fetchConnectedAccounts(
    integration: StripeConnectIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 25;

      // Remove Stripe-Account header for platform-level request
      const headers = { ...this.getHeaders(integration) };
      delete headers['Stripe-Account'];

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/accounts?limit=${limit}`, {
          headers,
        }),
      );

      return {
        accounts: response.data.data.map((acc: any) => ({
          id: acc.id,
          type: acc.type,
          email: acc.email,
          businessProfile: acc.business_profile,
          chargesEnabled: acc.charges_enabled,
          payoutsEnabled: acc.payouts_enabled,
          country: acc.country,
          created: new Date(acc.created * 1000).toISOString(),
        })),
        hasMore: response.data.has_more,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe connected accounts', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: StripeConnectIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

      const [balance, charges, subscriptions, invoices, payouts, disputes] =
        await Promise.all([
          this.fetchBalance(integration),
          this.fetchCharges(integration, {
            limit: 100,
            created: { gte: thirtyDaysAgo },
          }),
          this.fetchSubscriptions(integration, { limit: 100 }),
          this.fetchInvoices(integration, { limit: 100 }),
          this.fetchPayouts(integration, { limit: 50 }),
          this.fetchDisputes(integration, { limit: 50 }),
        ]);

      const chargesArray = (charges as any).charges || [];
      const subscriptionsArray = (subscriptions as any).subscriptions || [];
      const invoicesArray = (invoices as any).invoices || [];
      const payoutsArray = (payouts as any).payouts || [];
      const disputesArray = (disputes as any).disputes || [];

      // Calculate revenue metrics
      let totalRevenue = 0;
      let successfulCharges = 0;
      let failedCharges = 0;

      chargesArray.forEach((charge: any) => {
        if (charge.status === 'succeeded') {
          totalRevenue += charge.amount;
          successfulCharges++;
        } else if (charge.status === 'failed') {
          failedCharges++;
        }
      });

      // Subscription metrics
      const activeSubscriptions = subscriptionsArray.filter(
        (s: any) => s.status === 'active',
      ).length;
      const cancelingSubscriptions = subscriptionsArray.filter(
        (s: any) => s.cancelAtPeriodEnd,
      ).length;

      // Invoice metrics
      const openInvoices = invoicesArray.filter(
        (i: any) => i.status === 'open',
      ).length;
      const paidInvoices = invoicesArray.filter(
        (i: any) => i.status === 'paid',
      ).length;

      // Payout metrics
      const pendingPayouts = payoutsArray.filter(
        (p: any) => p.status === 'pending',
      ).length;
      const totalPayoutAmount = payoutsArray
        .filter((p: any) => p.status === 'paid')
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      // Dispute metrics
      const openDisputes = disputesArray.filter(
        (d: any) =>
          d.status === 'needs_response' || d.status === 'under_review',
      ).length;

      return {
        summary: {
          totalRevenue30d: totalRevenue,
          successfulCharges,
          failedCharges,
          chargeSuccessRate:
            successfulCharges + failedCharges > 0
              ? (
                  (successfulCharges / (successfulCharges + failedCharges)) *
                  100
                ).toFixed(2)
              : '0',
          activeSubscriptions,
          cancelingSubscriptions,
          openInvoices,
          paidInvoices,
          pendingPayouts,
          totalPayoutAmount,
          openDisputes,
          period: '30 days',
        },
        balance: balance,
        recentCharges: chargesArray.slice(0, 10),
        recentPayouts: payoutsArray.slice(0, 5),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Stripe analytics', error);
      throw error;
    }
  }

  // Create a connected account
  async createConnectedAccount(
    integration: StripeConnectIntegration,
    data: {
      type: 'express' | 'standard' | 'custom';
      email?: string;
      country?: string;
      capabilities?: Record<string, { requested: boolean }>;
    },
  ): Promise<unknown> {
    try {
      const headers = { ...this.getHeaders(integration) };
      delete headers['Stripe-Account'];

      const formData = new URLSearchParams();
      formData.set('type', data.type);
      if (data.email) formData.set('email', data.email);
      if (data.country) formData.set('country', data.country);
      if (data.capabilities) {
        Object.entries(data.capabilities).forEach(([key, value]) => {
          formData.set(
            `capabilities[${key}][requested]`,
            value.requested.toString(),
          );
        });
      }

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/accounts`, formData.toString(), {
          headers,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Stripe connected account', error);
      throw error;
    }
  }

  // Create a transfer to connected account
  async createTransfer(
    integration: StripeConnectIntegration,
    data: {
      amount: number;
      currency: string;
      destination: string;
      description?: string;
    },
  ): Promise<unknown> {
    try {
      const headers = { ...this.getHeaders(integration) };
      delete headers['Stripe-Account'];

      const formData = new URLSearchParams();
      formData.set('amount', data.amount.toString());
      formData.set('currency', data.currency);
      formData.set('destination', data.destination);
      if (data.description) formData.set('description', data.description);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transfers`,
          formData.toString(),
          { headers },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Stripe transfer', error);
      throw error;
    }
  }
}
