import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface TikTokAdsIntegration {
  accessToken: string;
  settings: {
    advertiserId: string;
    appId?: string;
  };
}

@Injectable()
export class TikTokAdsService {
  private readonly logger = new Logger(TikTokAdsService.name);
  private readonly baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(integration: TikTokAdsIntegration): Record<string, string> {
    return {
      'Access-Token': integration.accessToken,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(integration: TikTokAdsIntegration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/advertiser/info/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_ids: JSON.stringify([integration.settings.advertiserId]),
          },
        }),
      );
      return response.data.code === 0;
    } catch (error) {
      this.logger.error('TikTok Ads connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: TikTokAdsIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'campaigns':
        return this.fetchCampaigns(integration, params);
      case 'adGroups':
        return this.fetchAdGroups(integration, params);
      case 'ads':
        return this.fetchAds(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      case 'audiences':
        return this.fetchAudiences(integration, params);
      case 'creatives':
        return this.fetchCreatives(integration, params);
      default:
        throw new Error(`Unsupported TikTok Ads data type: ${dataType}`);
    }
  }

  private async fetchCampaigns(
    integration: TikTokAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;
      const status = params?.status as string;

      const filtering: Record<string, unknown> = {};
      if (status) {
        filtering.primary_status = status;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/campaign/get/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_id: integration.settings.advertiserId,
            page_size: pageSize,
            ...(Object.keys(filtering).length > 0 && {
              filtering: JSON.stringify(filtering),
            }),
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message);
      }

      return response.data.data?.list || [];
    } catch (error) {
      this.logger.error('Failed to fetch TikTok campaigns', error);
      throw error;
    }
  }

  private async fetchAdGroups(
    integration: TikTokAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;
      const campaignIds = params?.campaignIds as string[];

      const filtering: Record<string, unknown> = {};
      if (campaignIds && campaignIds.length > 0) {
        filtering.campaign_ids = campaignIds;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/adgroup/get/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_id: integration.settings.advertiserId,
            page_size: pageSize,
            ...(Object.keys(filtering).length > 0 && {
              filtering: JSON.stringify(filtering),
            }),
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message);
      }

      return response.data.data?.list || [];
    } catch (error) {
      this.logger.error('Failed to fetch TikTok ad groups', error);
      throw error;
    }
  }

  private async fetchAds(
    integration: TikTokAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;
      const adGroupIds = params?.adGroupIds as string[];

      const filtering: Record<string, unknown> = {};
      if (adGroupIds && adGroupIds.length > 0) {
        filtering.adgroup_ids = adGroupIds;
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/ad/get/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_id: integration.settings.advertiserId,
            page_size: pageSize,
            ...(Object.keys(filtering).length > 0 && {
              filtering: JSON.stringify(filtering),
            }),
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message);
      }

      return response.data.data?.list || [];
    } catch (error) {
      this.logger.error('Failed to fetch TikTok ads', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: TikTokAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;
      const dataLevel = (params?.level as string) || 'AUCTION_ADVERTISER';

      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/report/integrated/get/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_id: integration.settings.advertiserId,
            service_type: 'AUCTION',
            report_type: 'BASIC',
            data_level: dataLevel,
            dimensions: JSON.stringify(['stat_time_day']),
            metrics: JSON.stringify([
              'spend',
              'impressions',
              'clicks',
              'ctr',
              'cpc',
              'cpm',
              'reach',
              'conversion',
              'cost_per_conversion',
              'conversion_rate',
              'video_views',
              'video_watched_2s',
              'video_watched_6s',
              'average_video_play',
              'engaged_view',
            ]),
            start_date: startDate.toISOString().split('T')[0],
            end_date: today.toISOString().split('T')[0],
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message);
      }

      const data = response.data.data?.list || [];

      // Aggregate metrics
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalReach = 0;
      let totalVideoViews = 0;

      data.forEach((item: any) => {
        const metrics = item.metrics || {};
        totalSpend += parseFloat(metrics.spend || '0');
        totalImpressions += parseInt(metrics.impressions || '0', 10);
        totalClicks += parseInt(metrics.clicks || '0', 10);
        totalConversions += parseInt(metrics.conversion || '0', 10);
        totalReach += parseInt(metrics.reach || '0', 10);
        totalVideoViews += parseInt(metrics.video_views || '0', 10);
      });

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

      return {
        summary: {
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          totalReach,
          totalVideoViews,
          ctr,
          averageCpc: cpc,
          averageCpm: cpm,
          period: `${days} days`,
        },
        dailyData: data,
      };
    } catch (error) {
      this.logger.error('Failed to fetch TikTok analytics', error);
      throw error;
    }
  }

  private async fetchAudiences(
    integration: TikTokAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/dmp/custom_audience/list/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_id: integration.settings.advertiserId,
            page_size: pageSize,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message);
      }

      return response.data.data?.list || [];
    } catch (error) {
      this.logger.error('Failed to fetch TikTok audiences', error);
      throw error;
    }
  }

  private async fetchCreatives(
    integration: TikTokAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const pageSize = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/creative/get/`, {
          headers: this.getHeaders(integration),
          params: {
            advertiser_id: integration.settings.advertiserId,
            page_size: pageSize,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message);
      }

      return response.data.data?.list || [];
    } catch (error) {
      this.logger.error('Failed to fetch TikTok creatives', error);
      throw error;
    }
  }
}
