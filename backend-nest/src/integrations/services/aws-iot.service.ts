import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

interface AwsIotIntegration {
  accessToken: string; // AWS Access Key ID
  refreshToken: string; // AWS Secret Access Key
  settings: {
    region: string;
    iotEndpoint?: string; // Custom IoT endpoint
  };
}

@Injectable()
export class AwsIotService {
  private readonly logger = new Logger(AwsIotService.name);

  constructor(private readonly httpService: HttpService) {}

  private getIotApiUrl(integration: AwsIotIntegration): string {
    const region = integration.settings.region || 'us-east-1';
    return `https://iot.${region}.amazonaws.com`;
  }

  private getIotDataUrl(integration: AwsIotIntegration): string {
    if (integration.settings.iotEndpoint) {
      return `https://${integration.settings.iotEndpoint}`;
    }
    const region = integration.settings.region || 'us-east-1';
    return `https://data-ats.iot.${region}.amazonaws.com`;
  }

  private async signRequest(
    integration: AwsIotIntegration,
    method: string,
    url: string,
    body: string,
    service: string,
  ): Promise<Record<string, string>> {
    const region = integration.settings.region || 'us-east-1';
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = datetime.substring(0, 8);

    const host = new URL(url).host;
    const path = new URL(url).pathname;
    const canonicalHeaders = `host:${host}\nx-amz-date:${datetime}\n`;
    const signedHeaders = 'host;x-amz-date';

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      datetime,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const kDate = crypto
      .createHmac('sha256', `AWS4${integration.refreshToken}`)
      .update(date)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization = [
      `AWS4-HMAC-SHA256 Credential=${integration.accessToken}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    return {
      Authorization: authorization,
      'X-Amz-Date': datetime,
      'Content-Type': 'application/json',
      Host: host,
    };
  }

  async testConnection(integration: AwsIotIntegration): Promise<boolean> {
    try {
      const result = await this.fetchThings(integration, { maxResults: 1 });
      return true;
    } catch (error) {
      this.logger.error('AWS IoT connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: AwsIotIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'things':
        return this.fetchThings(integration, params);
      case 'thingTypes':
        return this.fetchThingTypes(integration, params);
      case 'thingGroups':
        return this.fetchThingGroups(integration, params);
      case 'thingShadow':
        return this.getThingShadow(integration, params);
      case 'policies':
        return this.fetchPolicies(integration, params);
      case 'certificates':
        return this.fetchCertificates(integration, params);
      case 'jobs':
        return this.fetchJobs(integration, params);
      case 'topicRules':
        return this.fetchTopicRules(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported AWS IoT data type: ${dataType}`);
    }
  }

  private async fetchThings(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/things`;
      const maxResults = (params?.maxResults as number) || 50;
      const nextToken = params?.nextToken as string;

      const queryParams = new URLSearchParams({ maxResults: maxResults.toString() });
      if (nextToken) queryParams.set('nextToken', nextToken);

      const fullUrl = `${url}?${queryParams.toString()}`;
      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        things: response.data.things || [],
        nextToken: response.data.nextToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT things', error);
      throw error;
    }
  }

  private async fetchThingTypes(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/thing-types`;
      const maxResults = (params?.maxResults as number) || 50;

      const fullUrl = `${url}?maxResults=${maxResults}`;
      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        thingTypes: response.data.thingTypes || [],
        nextToken: response.data.nextToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT thing types', error);
      throw error;
    }
  }

  private async fetchThingGroups(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/thing-groups`;
      const maxResults = (params?.maxResults as number) || 50;

      const fullUrl = `${url}?maxResults=${maxResults}`;
      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        thingGroups: response.data.thingGroups || [],
        nextToken: response.data.nextToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT thing groups', error);
      throw error;
    }
  }

  private async getThingShadow(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const thingName = params?.thingName as string;
      if (!thingName) {
        throw new Error('Thing name is required');
      }

      const shadowName = params?.shadowName as string;
      let url = `${this.getIotDataUrl(integration)}/things/${thingName}/shadow`;
      if (shadowName) {
        url = `${this.getIotDataUrl(integration)}/things/${thingName}/shadow?name=${shadowName}`;
      }

      const headers = await this.signRequest(integration, 'GET', url, '', 'iotdata');

      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get AWS IoT thing shadow', error);
      throw error;
    }
  }

  private async fetchPolicies(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/policies`;
      const maxResults = (params?.maxResults as number) || 50;

      const fullUrl = `${url}?pageSize=${maxResults}`;
      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        policies: response.data.policies || [],
        nextMarker: response.data.nextMarker,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT policies', error);
      throw error;
    }
  }

  private async fetchCertificates(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/certificates`;
      const maxResults = (params?.maxResults as number) || 50;

      const fullUrl = `${url}?pageSize=${maxResults}`;
      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        certificates: response.data.certificates || [],
        nextMarker: response.data.nextMarker,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT certificates', error);
      throw error;
    }
  }

  private async fetchJobs(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/jobs`;
      const maxResults = (params?.maxResults as number) || 50;
      const status = params?.status as string;

      let fullUrl = `${url}?maxResults=${maxResults}`;
      if (status) fullUrl += `&status=${status}`;

      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        jobs: response.data.jobs || [],
        nextToken: response.data.nextToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT jobs', error);
      throw error;
    }
  }

  private async fetchTopicRules(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/rules`;
      const maxResults = (params?.maxResults as number) || 50;

      const fullUrl = `${url}?maxResults=${maxResults}`;
      const headers = await this.signRequest(integration, 'GET', fullUrl, '', 'iot');

      const response = await firstValueFrom(
        this.httpService.get(fullUrl, { headers }),
      );

      return {
        rules: response.data.rules || [],
        nextToken: response.data.nextToken,
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT topic rules', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: AwsIotIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [things, thingTypes, thingGroups, policies, certificates, jobs, rules] =
        await Promise.all([
          this.fetchThings(integration, { maxResults: 100 }),
          this.fetchThingTypes(integration, { maxResults: 100 }),
          this.fetchThingGroups(integration, { maxResults: 100 }),
          this.fetchPolicies(integration, { maxResults: 100 }),
          this.fetchCertificates(integration, { maxResults: 100 }),
          this.fetchJobs(integration, { maxResults: 100 }),
          this.fetchTopicRules(integration, { maxResults: 100 }),
        ]);

      const thingsArray = (things as any).things || [];
      const thingTypesArray = (thingTypes as any).thingTypes || [];
      const thingGroupsArray = (thingGroups as any).thingGroups || [];
      const policiesArray = (policies as any).policies || [];
      const certificatesArray = (certificates as any).certificates || [];
      const jobsArray = (jobs as any).jobs || [];
      const rulesArray = (rules as any).rules || [];

      // Count certificates by status
      const certsByStatus: Record<string, number> = {};
      certificatesArray.forEach((cert: any) => {
        const status = cert.status || 'UNKNOWN';
        certsByStatus[status] = (certsByStatus[status] || 0) + 1;
      });

      // Count jobs by status
      const jobsByStatus: Record<string, number> = {};
      jobsArray.forEach((job: any) => {
        const status = job.status || 'UNKNOWN';
        jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
      });

      return {
        summary: {
          totalThings: thingsArray.length,
          totalThingTypes: thingTypesArray.length,
          totalThingGroups: thingGroupsArray.length,
          totalPolicies: policiesArray.length,
          totalCertificates: certificatesArray.length,
          activeCertificates: certsByStatus['ACTIVE'] || 0,
          totalJobs: jobsArray.length,
          totalTopicRules: rulesArray.length,
        },
        certificatesByStatus: certsByStatus,
        jobsByStatus,
        recentThings: thingsArray.slice(0, 10).map((t: any) => ({
          thingName: t.thingName,
          thingTypeName: t.thingTypeName,
          attributes: t.attributes,
        })),
        recentJobs: jobsArray.slice(0, 5).map((j: any) => ({
          jobId: j.jobId,
          status: j.status,
          createdAt: j.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch AWS IoT analytics', error);
      throw error;
    }
  }

  // Create thing
  async createThing(
    integration: AwsIotIntegration,
    data: {
      thingName: string;
      thingTypeName?: string;
      attributes?: Record<string, string>;
    },
  ): Promise<unknown> {
    try {
      const url = `${this.getIotApiUrl(integration)}/things/${data.thingName}`;

      const body: Record<string, unknown> = {};
      if (data.thingTypeName) body.thingTypeName = data.thingTypeName;
      if (data.attributes) body.attributePayload = { attributes: data.attributes };

      const bodyStr = JSON.stringify(body);
      const headers = await this.signRequest(integration, 'POST', url, bodyStr, 'iot');

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create AWS IoT thing', error);
      throw error;
    }
  }

  // Update thing shadow
  async updateThingShadow(
    integration: AwsIotIntegration,
    data: {
      thingName: string;
      shadowName?: string;
      state: {
        desired?: Record<string, unknown>;
        reported?: Record<string, unknown>;
      };
    },
  ): Promise<unknown> {
    try {
      let url = `${this.getIotDataUrl(integration)}/things/${data.thingName}/shadow`;
      if (data.shadowName) {
        url += `?name=${data.shadowName}`;
      }

      const body = { state: data.state };
      const bodyStr = JSON.stringify(body);
      const headers = await this.signRequest(integration, 'POST', url, bodyStr, 'iotdata');

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to update AWS IoT thing shadow', error);
      throw error;
    }
  }

  // Publish to topic
  async publish(
    integration: AwsIotIntegration,
    data: {
      topic: string;
      payload: Record<string, unknown> | string;
      qos?: 0 | 1;
    },
  ): Promise<unknown> {
    try {
      const url = `${this.getIotDataUrl(integration)}/topics/${encodeURIComponent(data.topic)}?qos=${data.qos || 0}`;

      const payload =
        typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload);
      const headers = await this.signRequest(integration, 'POST', url, payload, 'iotdata');
      headers['Content-Type'] = 'application/json';

      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers }),
      );

      return { success: true, topic: data.topic };
    } catch (error) {
      this.logger.error('Failed to publish to AWS IoT topic', error);
      throw error;
    }
  }
}
