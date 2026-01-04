import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface LinkedInAdsIntegration {
  accessToken: string;
  settings: {
    accountId: string;
  };
}

@Injectable()
export class LinkedInAdsService {
  private readonly logger = new Logger(LinkedInAdsService.name);
  private readonly baseUrl = 'https://api.linkedin.com/v2';
  private readonly adsUrl = 'https://api.linkedin.com/rest';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: LinkedInAdsIntegration): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    };
  }

  async testConnection(integration: LinkedInAdsIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/me`, {
          headers: this.getHeaders(integration),
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('LinkedIn Ads connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: LinkedInAdsIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'campaigns':
        return this.fetchCampaigns(integration, params);
      case 'campaignGroups':
        return this.fetchCampaignGroups(integration, params);
      case 'creatives':
        return this.fetchCreatives(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'conversionTracking':
        return this.fetchConversions(integration, params);
      case 'audiences':
        return this.fetchAudiences(integration, params);
      default:
        throw new Error(`Unsupported LinkedIn Ads data type: ${dataType}`);
    }
  }

  private async fetchCampaigns(
    integration: LinkedInAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const accountId = integration.settings.accountId;
      const status = params?.status as string;
      const count = (params?.limit as number) || 50;

      const searchParams: Record<string, unknown> = {
        q: 'search',
        'search.account.values[0]': `urn:li:sponsoredAccount:${accountId}`,
        count,
      };

      if (status) {
        searchParams['search.status.values[0]'] = status;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.adsUrl}/adCampaigns`, {
          headers: this.getHeaders(integration),
          params: searchParams,
        }),
      );

      return response.data.elements || [];
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn campaigns', error);
      throw error;
    }
  }

  private async fetchCampaignGroups(
    integration: LinkedInAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const accountId = integration.settings.accountId;
      const count = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.adsUrl}/adCampaignGroups`, {
          headers: this.getHeaders(integration),
          params: {
            q: 'search',
            'search.account.values[0]': `urn:li:sponsoredAccount:${accountId}`,
            count,
          },
        }),
      );

      return response.data.elements || [];
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn campaign groups', error);
      throw error;
    }
  }

  private async fetchCreatives(
    integration: LinkedInAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const accountId = integration.settings.accountId;
      const count = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.adsUrl}/adCreatives`, {
          headers: this.getHeaders(integration),
          params: {
            q: 'search',
            'search.account.values[0]': `urn:li:sponsoredAccount:${accountId}`,
            count,
          },
        }),
      );

      return response.data.elements || [];
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn creatives', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: LinkedInAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const accountId = integration.settings.accountId;
      const days = (params?.days as number) || 30;
      const granularity = (params?.granularity as string) || 'DAILY';

      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);

      const dateRange = {
        start: {
          day: startDate.getDate(),
          month: startDate.getMonth() + 1,
          year: startDate.getFullYear(),
        },
        end: {
          day: today.getDate(),
          month: today.getMonth() + 1,
          year: today.getFullYear(),
        },
      };

      const response = await firstValueFrom(
        this.httpService.get(`${this.adsUrl}/adAnalytics`, {
          headers: this.getHeaders(integration),
          params: {
            q: 'analytics',
            pivot: 'ACCOUNT',
            'dateRange.start.day': dateRange.start.day,
            'dateRange.start.month': dateRange.start.month,
            'dateRange.start.year': dateRange.start.year,
            'dateRange.end.day': dateRange.end.day,
            'dateRange.end.month': dateRange.end.month,
            'dateRange.end.year': dateRange.end.year,
            timeGranularity: granularity,
            'accounts[0]': `urn:li:sponsoredAccount:${accountId}`,
            fields: 'impressions,clicks,costInLocalCurrency,conversionValueInLocalCurrency,externalWebsiteConversions,leads,shares,follows,comments,likes',
          },
        }),
      );

      const elements = response.data.elements || [];

      // Aggregate metrics
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalCost = 0;
      let totalConversions = 0;
      let totalLeads = 0;

      elements.forEach((element: any) => {
        totalImpressions += element.impressions || 0;
        totalClicks += element.clicks || 0;
        totalCost += parseFloat(element.costInLocalCurrency || '0');
        totalConversions += element.externalWebsiteConversions || 0;
        totalLeads += element.leads || 0;
      });

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
      const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;

      return {
        summary: {
          totalSpend: totalCost,
          totalImpressions,
          totalClicks,
          totalConversions,
          totalLeads,
          ctr,
          averageCpc: cpc,
          averageCpm: cpm,
          period: `${days} days`,
        },
        dailyData: elements,
      };
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn analytics', error);
      throw error;
    }
  }

  private async fetchConversions(
    integration: LinkedInAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const accountId = integration.settings.accountId;

      const response = await firstValueFrom(
        this.httpService.get(`${this.adsUrl}/conversions`, {
          headers: this.getHeaders(integration),
          params: {
            q: 'account',
            account: `urn:li:sponsoredAccount:${accountId}`,
          },
        }),
      );

      return response.data.elements || [];
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn conversions', error);
      throw error;
    }
  }

  private async fetchAudiences(
    integration: LinkedInAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const accountId = integration.settings.accountId;
      const count = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.adsUrl}/dmpSegments`, {
          headers: this.getHeaders(integration),
          params: {
            q: 'account',
            account: `urn:li:sponsoredAccount:${accountId}`,
            count,
          },
        }),
      );

      return response.data.elements || [];
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn audiences', error);
      throw error;
    }
  }
}
