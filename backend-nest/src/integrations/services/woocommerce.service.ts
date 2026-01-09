import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

export interface WooCommerceIntegration {
  accessToken: string; // Consumer key
  refreshToken: string; // Consumer secret
  settings: {
    siteUrl: string;
    apiVersion?: string;
  };
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    total: string;
  }>;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  status: string;
  type: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: string;
  categories: Array<{ id: number; name: string }>;
}

@Injectable()
export class WooCommerceService {
  private readonly logger = new Logger(WooCommerceService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: WooCommerceIntegration): string {
    const apiVersion = integration.settings.apiVersion || 'wc/v3';
    return `${integration.settings.siteUrl}/wp-json/${apiVersion}`;
  }

  private getAuthHeaders(
    integration: WooCommerceIntegration,
  ): Record<string, string> {
    const credentials = Buffer.from(
      `${integration.accessToken}:${integration.refreshToken}`,
    ).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: WooCommerceIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/system_status`, {
          headers: this.getAuthHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('WooCommerce connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: WooCommerceIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const headers = this.getAuthHeaders(integration);
    const baseUrl = this.getBaseUrl(integration);

    switch (dataType) {
      case 'orders':
        return this.fetchOrders(baseUrl, headers, params);
      case 'products':
        return this.fetchProducts(baseUrl, headers, params);
      case 'customers':
        return this.fetchCustomers(baseUrl, headers, params);
      case 'analytics':
        return this.fetchAnalytics(baseUrl, headers, params);
      case 'reports':
        return this.fetchReports(baseUrl, headers, params);
      case 'coupons':
        return this.fetchCoupons(baseUrl, headers, params);
      default:
        throw new Error(`Unsupported WooCommerce data type: ${dataType}`);
    }
  }

  private async fetchOrders(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<WooCommerceOrder[]> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = (params?.status as string) || 'any';
      const after = params?.after as string;
      const before = params?.before as string;

      const queryParams: Record<string, unknown> = {
        per_page: limit,
        ...(status !== 'any' && { status }),
        ...(after && { after }),
        ...(before && { before }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders`, {
          headers,
          params: queryParams,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch WooCommerce orders', error);
      throw error;
    }
  }

  private async fetchProducts(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<WooCommerceProduct[]> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = (params?.status as string) || 'publish';

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/products`, {
          headers,
          params: { per_page: limit, status },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch WooCommerce products', error);
      throw error;
    }
  }

  private async fetchCustomers(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/customers`, {
          headers,
          params: { per_page: limit },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch WooCommerce customers', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;
      const after = new Date();
      after.setDate(after.getDate() - days);

      // Fetch orders for analytics
      const ordersResponse = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders`, {
          headers,
          params: {
            per_page: 100,
            after: after.toISOString(),
          },
        }),
      );

      const orders = ordersResponse.data as WooCommerceOrder[];

      // Calculate analytics
      const totalRevenue = orders.reduce(
        (sum, order) => sum + parseFloat(order.total),
        0,
      );
      const totalOrders = orders.length;
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Status breakdown
      const statusBreakdown: Record<string, number> = {};
      orders.forEach((order) => {
        statusBreakdown[order.status] =
          (statusBreakdown[order.status] || 0) + 1;
      });

      // Daily breakdown
      const dailyRevenue: Record<string, number> = {};
      orders.forEach((order) => {
        const date = order.date_created.split('T')[0];
        dailyRevenue[date] =
          (dailyRevenue[date] || 0) + parseFloat(order.total);
      });

      return {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          currency: orders[0]?.currency || 'USD',
          period: `${days} days`,
        },
        statusBreakdown,
        dailyRevenue,
      };
    } catch (error) {
      this.logger.error('Failed to fetch WooCommerce analytics', error);
      throw error;
    }
  }

  private async fetchReports(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const reportType = (params?.type as string) || 'sales';
      const period = (params?.period as string) || 'month';

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/reports/${reportType}`, {
          headers,
          params: { period },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch WooCommerce reports', error);
      throw error;
    }
  }

  private async fetchCoupons(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/coupons`, {
          headers,
          params: { per_page: limit },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch WooCommerce coupons', error);
      throw error;
    }
  }

  // Webhook signature verification
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    return signature === computedSignature;
  }
}
