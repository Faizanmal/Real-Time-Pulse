import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ShopifyIntegration {
  accessToken: string;
  settings: {
    shopDomain: string;
    apiVersion?: string;
  };
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  status: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    inventory_quantity: number;
  }>;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  created_at: string;
  tags: string;
}

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(integration: ShopifyIntegration): string {
    const apiVersion = integration.settings.apiVersion || '2024-01';
    return `https://${integration.settings.shopDomain}/admin/api/${apiVersion}`;
  }

  async testConnection(integration: ShopifyIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.getBaseUrl(integration)}/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': integration.accessToken,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Shopify connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: ShopifyIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const headers = {
      'X-Shopify-Access-Token': integration.accessToken,
      'Content-Type': 'application/json',
    };
    const baseUrl = this.getBaseUrl(integration);

    switch (dataType) {
      case 'orders':
        return this.fetchOrders(baseUrl, headers, params);
      case 'products':
        return this.fetchProducts(baseUrl, headers, params);
      case 'customers':
        return this.fetchCustomers(baseUrl, headers, params);
      case 'inventory':
        return this.fetchInventory(baseUrl, headers, params);
      case 'analytics':
        return this.fetchAnalytics(baseUrl, headers, params);
      case 'shop':
        return this.fetchShopInfo(baseUrl, headers);
      case 'collections':
        return this.fetchCollections(baseUrl, headers, params);
      default:
        throw new Error(`Unsupported Shopify data type: ${dataType}`);
    }
  }

  private async fetchOrders(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<ShopifyOrder[]> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = (params?.status as string) || 'any';
      const createdAtMin = params?.createdAtMin as string;
      const createdAtMax = params?.createdAtMax as string;

      const queryParams: Record<string, unknown> = {
        limit,
        status,
        ...(createdAtMin && { created_at_min: createdAtMin }),
        ...(createdAtMax && { created_at_max: createdAtMax }),
      };

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders.json`, {
          headers,
          params: queryParams,
        }),
      );

      return response.data.orders;
    } catch (error) {
      this.logger.error('Failed to fetch Shopify orders', error);
      throw error;
    }
  }

  private async fetchProducts(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<ShopifyProduct[]> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = (params?.status as string) || 'active';

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/products.json`, {
          headers,
          params: { limit, status },
        }),
      );

      return response.data.products;
    } catch (error) {
      this.logger.error('Failed to fetch Shopify products', error);
      throw error;
    }
  }

  private async fetchCustomers(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<ShopifyCustomer[]> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/customers.json`, {
          headers,
          params: { limit },
        }),
      );

      return response.data.customers;
    } catch (error) {
      this.logger.error('Failed to fetch Shopify customers', error);
      throw error;
    }
  }

  private async fetchInventory(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const locationId = params?.locationId as string;
      
      // First get inventory levels
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/inventory_levels.json`, {
          headers,
          params: locationId ? { location_ids: locationId } : {},
        }),
      );

      return response.data.inventory_levels;
    } catch (error) {
      this.logger.error('Failed to fetch Shopify inventory', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      // Fetch orders for analytics calculation
      const days = (params?.days as number) || 30;
      const createdAtMin = new Date();
      createdAtMin.setDate(createdAtMin.getDate() - days);

      const ordersResponse = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders.json`, {
          headers,
          params: {
            limit: 250,
            status: 'any',
            created_at_min: createdAtMin.toISOString(),
          },
        }),
      );

      const orders = ordersResponse.data.orders as ShopifyOrder[];

      // Calculate analytics
      const totalRevenue = orders.reduce(
        (sum, order) => sum + parseFloat(order.total_price),
        0,
      );
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const paidOrders = orders.filter(
        (order) => order.financial_status === 'paid',
      );
      const pendingOrders = orders.filter(
        (order) => order.financial_status === 'pending',
      );
      const refundedOrders = orders.filter(
        (order) => order.financial_status === 'refunded',
      );

      const fulfilledOrders = orders.filter(
        (order) => order.fulfillment_status === 'fulfilled',
      );

      // Daily revenue breakdown
      const dailyRevenue: Record<string, number> = {};
      orders.forEach((order) => {
        const date = order.created_at.split('T')[0];
        dailyRevenue[date] =
          (dailyRevenue[date] || 0) + parseFloat(order.total_price);
      });

      return {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          period: `${days} days`,
        },
        orderStatus: {
          paid: paidOrders.length,
          pending: pendingOrders.length,
          refunded: refundedOrders.length,
        },
        fulfillment: {
          fulfilled: fulfilledOrders.length,
          unfulfilled: totalOrders - fulfilledOrders.length,
        },
        dailyRevenue,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Shopify analytics', error);
      throw error;
    }
  }

  private async fetchShopInfo(
    baseUrl: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/shop.json`, { headers }),
      );
      return response.data.shop;
    } catch (error) {
      this.logger.error('Failed to fetch Shopify shop info', error);
      throw error;
    }
  }

  private async fetchCollections(
    baseUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/custom_collections.json`, {
          headers,
          params: { limit },
        }),
      );

      return response.data.custom_collections;
    } catch (error) {
      this.logger.error('Failed to fetch Shopify collections', error);
      throw error;
    }
  }

  // Webhook registration for real-time updates
  async registerWebhook(
    integration: ShopifyIntegration,
    topic: string,
    callbackUrl: string,
  ): Promise<unknown> {
    try {
      const baseUrl = this.getBaseUrl(integration);
      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/webhooks.json`,
          {
            webhook: {
              topic,
              address: callbackUrl,
              format: 'json',
            },
          },
          {
            headers: {
              'X-Shopify-Access-Token': integration.accessToken,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      return response.data.webhook;
    } catch (error) {
      this.logger.error('Failed to register Shopify webhook', error);
      throw error;
    }
  }
}
