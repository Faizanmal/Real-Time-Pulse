/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly baseUrl = 'https://slack.com/api';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/auth.test`,
          {},
          {
            headers: {
              Authorization: `Bearer ${integration.accessToken as string}`,
            },
          },
        ),
      );
      return response.data.ok === true;
    } catch (error) {
      this.logger.error('Slack connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: Integration,
    dataType: string,
    params?: unknown,
  ): Promise<unknown> {
    const headers = {
      Authorization: `Bearer ${integration.accessToken as string}`,
      'Content-Type': 'application/json',
    };

    switch (dataType) {
      case 'channels':
        return this.fetchChannels(headers);

      case 'users':
        return this.fetchUsers(headers);

      case 'messages':
        return this.fetchMessages(headers, params);

      case 'analytics':
        return this.fetchAnalytics(headers);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  /**
   * Send a message to a Slack channel
   */
  async sendMessage(
    integration: Integration,
    channel: string,
    text: string,
    blocks?: any[],
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/chat.postMessage`,
          {
            channel,
            text,
            blocks,
          },
          {
            headers: {
              Authorization: `Bearer ${integration.accessToken as string}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data;
    } catch (error) {
      this.logger.error('Failed to send Slack message', error);
      throw error;
    }
  }

  /**
   * Send notification via webhook (for alerts)
   */
  async sendWebhookMessage(
    webhookUrl: string,
    message: {
      text: string;
      blocks?: any[];
      attachments?: any[];
    },
  ): Promise<boolean> {
    try {
      await firstValueFrom(this.httpService.post(webhookUrl, message));
      return true;
    } catch (error) {
      this.logger.error('Failed to send Slack webhook message', error);
      return false;
    }
  }

  private async fetchChannels(headers: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/conversations.list`, {
          headers,
          params: {
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 100,
          },
        }),
      );

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data.channels;
    } catch (error) {
      this.logger.error('Failed to fetch Slack channels', error);
      throw error;
    }
  }

  private async fetchUsers(headers: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users.list`, {
          headers,
          params: {
            limit: 200,
          },
        }),
      );

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      // Filter out bots and deactivated users
      return response.data.members.filter(
        (user: any) => !user.is_bot && !user.deleted,
      );
    } catch (error) {
      this.logger.error('Failed to fetch Slack users', error);
      throw error;
    }
  }

  private async fetchMessages(
    headers: any,
    params?: unknown,
  ): Promise<unknown> {
    try {
      const channel = (params as { channel?: string })?.channel;
      if (!channel) {
        throw new Error('Channel ID required');
      }

      const limit = (params as { limit?: number })?.limit || 100;
      const oldest = (params as { oldest?: string })?.oldest;

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/conversations.history`, {
          headers,
          params: {
            channel,
            limit,
            ...(oldest && { oldest }),
          },
        }),
      );

      if (!response.data.ok) {
        throw new Error(response.data.error);
      }

      return response.data.messages;
    } catch (error) {
      this.logger.error('Failed to fetch Slack messages', error);
      throw error;
    }
  }

  private async fetchAnalytics(headers: any): Promise<unknown> {
    try {
      // Fetch team info and aggregate stats
      const [teamInfo, users, channels] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${this.baseUrl}/team.info`, { headers }),
        ),
        this.fetchUsers(headers),
        this.fetchChannels(headers),
      ]);

      const activeUsers = (users as any[]).filter(
        (u: any) => u.presence === 'active',
      ).length;

      return {
        team: teamInfo.data.team,
        stats: {
          totalUsers: (users as any[]).length,
          activeUsers,
          totalChannels: (channels as any[]).length,
          publicChannels: (channels as any[]).filter((c: any) => !c.is_private)
            .length,
          privateChannels: (channels as any[]).filter((c: any) => c.is_private)
            .length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch Slack analytics', error);
      throw error;
    }
  }
}
