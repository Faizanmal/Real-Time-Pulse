import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface FacebookAdsIntegration {
  accessToken: string;
  settings: {
    accountId: string;
    apiVersion?: string;
  };
}

export interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  created_time: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

export interface FacebookAdInsight {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  cpc: string;
  cpm: string;
  ctr: string;
  conversions?: string;
  date_start: string;
  date_stop: string;
}

@Injectable()
export class FacebookAdsService {
  private readonly logger = new Logger(FacebookAdsService.name);
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(private readonly httpService: HttpService) {}

  private getApiVersion(integration: FacebookAdsIntegration): string {
    return integration.settings.apiVersion || 'v18.0';
  }

  async testConnection(integration: FacebookAdsIntegration): Promise<boolean> {
    try {
      const version = this.getApiVersion(integration);
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${version}/act_${integration.settings.accountId}`,
          {
            params: {
              access_token: integration.accessToken,
              fields: 'id,name,account_status',
            },
          },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Facebook Ads connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: FacebookAdsIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const version = this.getApiVersion(integration);
    const accountId = `act_${integration.settings.accountId}`;

    switch (dataType) {
      case 'campaigns':
        return this.fetchCampaigns(
          version,
          accountId,
          integration.accessToken,
          params,
        );
      case 'adsets':
        return this.fetchAdSets(
          version,
          accountId,
          integration.accessToken,
          params,
        );
      case 'ads':
        return this.fetchAds(
          version,
          accountId,
          integration.accessToken,
          params,
        );
      case 'insights':
        return this.fetchInsights(
          version,
          accountId,
          integration.accessToken,
          params,
        );
      case 'analytics':
        return this.fetchAnalytics(
          version,
          accountId,
          integration.accessToken,
          params,
        );
      case 'audiences':
        return this.fetchAudiences(
          version,
          accountId,
          integration.accessToken,
          params,
        );
      default:
        throw new Error(`Unsupported Facebook Ads data type: ${dataType}`);
    }
  }

  private async fetchCampaigns(
    version: string,
    accountId: string,
    accessToken: string,
    params?: Record<string, unknown>,
  ): Promise<FacebookCampaign[]> {
    try {
      const limit = (params?.limit as number) || 50;
      const status = params?.status as string[];

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${version}/${accountId}/campaigns`,
          {
            params: {
              access_token: accessToken,
              fields:
                'id,name,status,objective,created_time,daily_budget,lifetime_budget,start_time,stop_time',
              limit,
              ...(status && {
                filtering: JSON.stringify([
                  { field: 'effective_status', operator: 'IN', value: status },
                ]),
              }),
            },
          },
        ),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Facebook campaigns', error);
      throw error;
    }
  }

  private async fetchAdSets(
    version: string,
    accountId: string,
    accessToken: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${version}/${accountId}/adsets`, {
          params: {
            access_token: accessToken,
            fields:
              'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal',
            limit,
          },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Facebook ad sets', error);
      throw error;
    }
  }

  private async fetchAds(
    version: string,
    accountId: string,
    accessToken: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${version}/${accountId}/ads`, {
          params: {
            access_token: accessToken,
            fields: 'id,name,status,adset_id,campaign_id,creative,created_time',
            limit,
          },
        }),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Facebook ads', error);
      throw error;
    }
  }

  private async fetchInsights(
    version: string,
    accountId: string,
    accessToken: string,
    params?: Record<string, unknown>,
  ): Promise<FacebookAdInsight[]> {
    try {
      const days = (params?.days as number) || 30;
      const level = (params?.level as string) || 'campaign';
      const datePreset = params?.datePreset as string;

      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${version}/${accountId}/insights`,
          {
            params: {
              access_token: accessToken,
              fields:
                'campaign_id,campaign_name,impressions,clicks,spend,reach,cpc,cpm,ctr,actions,conversions,cost_per_conversion',
              level,
              time_range: datePreset
                ? undefined
                : JSON.stringify({
                    since: startDate.toISOString().split('T')[0],
                    until: today.toISOString().split('T')[0],
                  }),
              ...(datePreset && { date_preset: datePreset }),
              time_increment: 1,
            },
          },
        ),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Facebook insights', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    version: string,
    accountId: string,
    accessToken: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const days = (params?.days as number) || 30;
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);

      // Fetch account-level insights
      const insightsResponse = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${version}/${accountId}/insights`,
          {
            params: {
              access_token: accessToken,
              fields:
                'impressions,clicks,spend,reach,cpc,cpm,ctr,frequency,actions',
              time_range: JSON.stringify({
                since: startDate.toISOString().split('T')[0],
                until: today.toISOString().split('T')[0],
              }),
            },
          },
        ),
      );

      // Fetch campaign count
      const campaignsResponse = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${version}/${accountId}/campaigns`,
          {
            params: {
              access_token: accessToken,
              summary: 'total_count',
              limit: 1,
            },
          },
        ),
      );

      const insights = insightsResponse.data.data?.[0] || {};
      const campaignCount = campaignsResponse.data.summary?.total_count || 0;

      return {
        summary: {
          totalSpend: parseFloat(insights.spend || '0'),
          totalImpressions: parseInt(insights.impressions || '0', 10),
          totalClicks: parseInt(insights.clicks || '0', 10),
          totalReach: parseInt(insights.reach || '0', 10),
          averageCPC: parseFloat(insights.cpc || '0'),
          averageCPM: parseFloat(insights.cpm || '0'),
          averageCTR: parseFloat(insights.ctr || '0'),
          frequency: parseFloat(insights.frequency || '0'),
          activeCampaigns: campaignCount,
          period: `${days} days`,
        },
        actions: insights.actions || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch Facebook analytics', error);
      throw error;
    }
  }

  private async fetchAudiences(
    version: string,
    accountId: string,
    accessToken: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const limit = (params?.limit as number) || 50;

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/${version}/${accountId}/customaudiences`,
          {
            params: {
              access_token: accessToken,
              fields:
                'id,name,approximate_count,subtype,time_created,time_updated',
              limit,
            },
          },
        ),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch Facebook audiences', error);
      throw error;
    }
  }
}
