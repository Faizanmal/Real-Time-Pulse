import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GoogleAnalyticsService {
  private readonly logger = new Logger(GoogleAnalyticsService.name);
  private readonly baseUrl = 'https://analyticsdata.googleapis.com/v1beta';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: any): Promise<boolean> {
    try {
      // Test by fetching account summaries
      const response = await firstValueFrom(
        this.httpService.get(
          'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
          {
            headers: {
              Authorization: `Bearer ${integration.accessToken}`,
            },
          },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Google Analytics connection test failed', error);
      return false;
    }
  }

  async fetchData(integration: any, dataType: string, params?: any) {
    const headers = {
      Authorization: `Bearer ${integration.accessToken}`,
    };

    switch (dataType) {
      case 'report':
        return this.fetchReport(headers, params);

      case 'realtime':
        return this.fetchRealtimeData(headers, params);

      case 'properties':
        return this.fetchProperties(headers);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchReport(headers: any, params?: any) {
    try {
      const propertyId = params?.propertyId;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/properties/${propertyId}:runReport`,
          {
            dateRanges: [
              {
                startDate: params?.startDate || '30daysAgo',
                endDate: params?.endDate || 'today',
              },
            ],
            dimensions: params?.dimensions || [{ name: 'date' }],
            metrics: params?.metrics || [
              { name: 'activeUsers' },
              { name: 'sessions' },
              { name: 'pageviews' },
            ],
          },
          { headers },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Google Analytics report', error);
      throw error;
    }
  }

  private async fetchRealtimeData(headers: any, params?: any) {
    try {
      const propertyId = params?.propertyId;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/properties/${propertyId}:runRealtimeReport`,
          {
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'activeUsers' }],
          },
          { headers },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to fetch Google Analytics realtime data',
        error,
      );
      throw error;
    }
  }

  private async fetchProperties(headers: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          'https://analyticsadmin.googleapis.com/v1beta/properties',
          { headers },
        ),
      );
      return response.data.properties;
    } catch (error) {
      this.logger.error('Failed to fetch Google Analytics properties', error);
      throw error;
    }
  }
}
