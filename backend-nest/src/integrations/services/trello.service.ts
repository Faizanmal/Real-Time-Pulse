import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type Integration = any;

@Injectable()
export class TrelloService {
  private readonly logger = new Logger(TrelloService.name);
  private readonly baseUrl = 'https://api.trello.com/1';

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/members/me`, {
          params: {
            key: process.env.TRELLO_API_KEY,
            token: integration.accessToken as string,
          },
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('Trello connection test failed', error);
      return false;
    }
  }

  async fetchData(integration: Integration, dataType: string, params?: unknown): Promise<unknown> {
    const authParams = {
      key: process.env.TRELLO_API_KEY,
      token: integration.accessToken as string,
    };

    switch (dataType) {
      case 'boards':
        return this.fetchBoards(authParams);

      case 'lists':
        return this.fetchLists(authParams, params);

      case 'cards':
        return this.fetchCards(authParams, params);

      case 'members':
        return this.fetchMembers(authParams, params);

      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  private async fetchBoards(authParams: any): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/members/me/boards`, {
          params: {
            ...authParams,
            fields: 'name,desc,url,dateLastActivity,prefs',
            filter: 'open',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Trello boards', error);
      throw error;
    }
  }

  private async fetchLists(authParams: any, params?: unknown): Promise<unknown> {
    try {
      const boardId = (params as { boardId?: string })?.boardId;
      if (!boardId) {
        throw new Error('Board ID required');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/boards/${boardId}/lists`, {
          params: {
            ...authParams,
            cards: 'open',
            filter: 'open',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Trello lists', error);
      throw error;
    }
  }

  private async fetchCards(authParams: any, params?: unknown): Promise<unknown> {
    try {
      const boardId = (params as { boardId?: string })?.boardId;
      const listId = (params as { listId?: string })?.listId;

      let url = '';
      if (listId) {
        url = `${this.baseUrl}/lists/${listId}/cards`;
      } else if (boardId) {
        url = `${this.baseUrl}/boards/${boardId}/cards`;
      } else {
        throw new Error('Board ID or List ID required');
      }

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            ...authParams,
            fields: 'name,desc,due,dueComplete,labels,members,url,dateLastActivity',
            members: true,
            member_fields: 'fullName,avatarUrl',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Trello cards', error);
      throw error;
    }
  }

  private async fetchMembers(authParams: any, params?: unknown): Promise<unknown> {
    try {
      const boardId = (params as { boardId?: string })?.boardId;
      if (!boardId) {
        throw new Error('Board ID required');
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/boards/${boardId}/members`, {
          params: {
            ...authParams,
            fields: 'fullName,username,avatarUrl',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Trello members', error);
      throw error;
    }
  }
}
