import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface BigCommerceIntegration {
  accessToken: string;
  settings: {
    storeHash: string;
    apiVersion?: string;
  };
}

@Injectable()
export class BigCommerceService {
  private readonly logger = new Logger(BigCommerceService.name);
  private readonly baseUrl = 'https://api.bigcommerce.com';

  constructor(private readonly httpService: HttpService) {}

  private getStoreUrl(integration: BigCommerceIntegration): string {
    const apiVersion = integration.settings.apiVersion || 'v3';
    return `${this.baseUrl}/stores/${integration.settings.storeHash}/${apiVersion}`;
  }

  async testConnection(integration: BigCommerceIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.getStoreUrl(integration)}/catalog/summary`,
          {
            headers: {
              'X-Auth-Token': integration.accessToken,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('BigCommerce connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: BigCommerceIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const headers = {
      'X-Auth-Token': integration.accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const storeUrl = this.getStoreUrl(integration);

    switch (dataType) {
      case 'orders':
        return this.fetchOrders(storeUrl, headers, params);
      case 'products':
        return this.fetchProducts(storeUrl, headers, params);
      case 'customers':
        return this.fetchCustomers(storeUrl, headers, params);
      case 'analytics':
        return this.fetchAnalytics(storeUrl, headers, params);
      case 'categories':
        return this.fetchCategories(storeUrl, headers, params);
      case 'brands':
        return this.fetchBrands(storeUrl, headers, params);
      default:
        throw new Error(`Unsupported BigCommerce data type: ${dataType}`);
    }
  }

  private async fetchOrders(
    storeUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const minDateCreated = params?.minDateCreated as string;

      const v2Url = storeUrl.replace('/v3', '/v2');
      const response = await firstValueFrom(
        this.httpService.get(`${v2Url}/orders`, {
          headers,
          params: {
            limit,
            ...(minDateCreated && { min_date_created: minDateCreated }),
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch BigCommerce orders', error);
      throw error;
    }
  }

  private async fetchProducts(
    storeUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;
      const includeVariants = (params?.includeVariants as boolean) || false;

      const response = await firstValueFrom(
        this.httpService.get(`${storeUrl}/catalog/products`, {
          headers,
          params: {
            limit,
            include: includeVariants ? 'variants,images' : 'images',
          },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch BigCommerce products', error);
      throw error;
    }
  }

  private async fetchCustomers(
    storeUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${storeUrl}/customers`, {
          headers,
          params: { limit },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch BigCommerce customers', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    storeUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - days);

      const v2Url = storeUrl.replace('/v3', '/v2');
      const ordersResponse = await firstValueFrom(
        this.httpService.get(`${v2Url}/orders`, {
          headers,
          params: {
            limit: 250,
            min_date_created: minDate.toISOString(),
          },
        }),
      );

      const orders = ordersResponse.data || [];

      const totalRevenue = orders.reduce(
        (sum: number, order: any) =>
          sum + parseFloat(order.total_inc_tax || '0'),
        0,
      );
      const totalOrders = orders.length;
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const statusBreakdown: Record<string, number> = {};
      orders.forEach((order: any) => {
        const status = order.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });

      return {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          period: `${days} days`,
        },
        statusBreakdown,
      };
    } catch (error) {
      this.logger.error('Failed to fetch BigCommerce analytics', error);
      throw error;
    }
  }

  private async fetchCategories(
    storeUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${storeUrl}/catalog/categories`, {
          headers,
          params: { limit },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch BigCommerce categories', error);
      throw error;
    }
  }

  private async fetchBrands(
    storeUrl: string,
    headers: Record<string, string>,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${storeUrl}/catalog/brands`, {
          headers,
          params: { limit },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch BigCommerce brands', error);
      throw error;
    }
  }
}
