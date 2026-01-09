import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GoogleAdsIntegration {
  accessToken: string;
  refreshToken?: string;
  settings: {
    customerId: string;
    developerToken: string;
    loginCustomerId?: string;
  };
}

@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);
  private readonly baseUrl = 'https://googleads.googleapis.com/v15';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(
    integration: GoogleAdsIntegration,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${integration.accessToken}`,
      'developer-token': integration.settings.developerToken,
      'Content-Type': 'application/json',
      ...(integration.settings.loginCustomerId && {
        'login-customer-id': integration.settings.loginCustomerId,
      }),
    };
  }

  async testConnection(integration: GoogleAdsIntegration): Promise<boolean> {
    try {
      const customerId = integration.settings.customerId.replace(/-/g, '');
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/customers/${customerId}/googleAds:searchStream`,
          {
            query:
              'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1',
          },
          { headers: this.getHeaders(integration) },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Google Ads connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: GoogleAdsIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const customerId = integration.settings.customerId.replace(/-/g, '');

    switch (dataType) {
      case 'campaigns':
        return this.fetchCampaigns(customerId, integration, params);
      case 'adGroups':
        return this.fetchAdGroups(customerId, integration, params);
      case 'ads':
        return this.fetchAds(customerId, integration, params);
      case 'keywords':
        return this.fetchKeywords(customerId, integration, params);
      case 'metrics':
        return this.fetchMetrics(customerId, integration, params);
      case 'analytics':
        return this.fetchAnalytics(customerId, integration, params);
      case 'conversions':
        return this.fetchConversions(customerId, integration, params);
      default:
        throw new Error(`Unsupported Google Ads data type: ${dataType}`);
    }
  }

  private async executeQuery(
    customerId: string,
    query: string,
    integration: GoogleAdsIntegration,
  ): Promise<unknown[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/customers/${customerId}/googleAds:searchStream`,
          { query },
          { headers: this.getHeaders(integration) },
        ),
      );

      // Parse streaming response
      const results: unknown[] = [];
      if (Array.isArray(response.data)) {
        response.data.forEach((batch: { results?: unknown[] }) => {
          if (batch.results) {
            results.push(...batch.results);
          }
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to execute Google Ads query', error);
      throw error;
    }
  }

  private async fetchCampaigns(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const status = params?.status as string;
    const statusFilter = status ? `AND campaign.status = '${status}'` : '';

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.start_date,
        campaign.end_date,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ${statusFilter}
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    return this.executeQuery(customerId, query, integration);
  }

  private async fetchAdGroups(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const campaignId = params?.campaignId as string;
    const campaignFilter = campaignId ? `AND campaign.id = ${campaignId}` : '';

    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM ad_group
      WHERE ad_group.status != 'REMOVED'
      ${campaignFilter}
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    return this.executeQuery(customerId, query, integration);
  }

  private async fetchAds(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const adGroupId = params?.adGroupId as string;
    const adGroupFilter = adGroupId ? `AND ad_group.id = ${adGroupId}` : '';

    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status,
        ad_group_ad.ad.type,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM ad_group_ad
      WHERE ad_group_ad.status != 'REMOVED'
      ${adGroupFilter}
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    return this.executeQuery(customerId, query, integration);
  }

  private async fetchKeywords(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const adGroupId = params?.adGroupId as string;
    const adGroupFilter = adGroupId ? `AND ad_group.id = ${adGroupId}` : '';

    const query = `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.quality_info.quality_score,
        ad_group.id,
        campaign.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM keyword_view
      WHERE ad_group_criterion.status != 'REMOVED'
      ${adGroupFilter}
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    return this.executeQuery(customerId, query, integration);
  }

  private async fetchMetrics(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const days = (params?.days as number) || 30;
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endStr = today.toISOString().split('T')[0].replace(/-/g, '');

    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm
      FROM customer
      WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
      ORDER BY segments.date DESC
    `;

    return this.executeQuery(customerId, query, integration);
  }

  private async fetchAnalytics(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const days = (params?.days as number) || 30;
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endStr = today.toISOString().split('T')[0].replace(/-/g, '');

    // Fetch overall metrics
    const metricsQuery = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversion_value
      FROM customer
      WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
    `;

    // Fetch campaign count
    const campaignsQuery = `
      SELECT campaign.id
      FROM campaign
      WHERE campaign.status = 'ENABLED'
    `;

    const [metricsResults, campaignsResults] = await Promise.all([
      this.executeQuery(customerId, metricsQuery, integration),
      this.executeQuery(customerId, campaignsQuery, integration),
    ]);

    // Aggregate metrics
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = 0;
    let totalConversions = 0;
    let totalConversionValue = 0;

    metricsResults.forEach((result: any) => {
      const metrics = result.metrics || {};
      totalImpressions += parseInt(metrics.impressions || '0', 10);
      totalClicks += parseInt(metrics.clicks || '0', 10);
      totalCostMicros += parseInt(metrics.costMicros || '0', 10);
      totalConversions += parseFloat(metrics.conversions || '0');
      totalConversionValue += parseFloat(metrics.conversionValue || '0');
    });

    const totalSpend = totalCostMicros / 1000000;
    const ctr =
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm =
      totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const costPerConversion =
      totalConversions > 0 ? totalSpend / totalConversions : 0;

    return {
      summary: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalConversionValue,
        ctr,
        averageCpc: avgCpc,
        averageCpm: avgCpm,
        costPerConversion,
        activeCampaigns: campaignsResults.length,
        period: `${days} days`,
      },
    };
  }

  private async fetchConversions(
    customerId: string,
    integration: GoogleAdsIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const days = (params?.days as number) || 30;
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endStr = today.toISOString().split('T')[0].replace(/-/g, '');

    const query = `
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.category,
        conversion_action.type,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion
      FROM conversion_action
      WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
      ORDER BY metrics.conversions DESC
      LIMIT 50
    `;

    return this.executeQuery(customerId, query, integration);
  }
}
