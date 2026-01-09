import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';

export interface MqttIntegration {
  accessToken?: string; // Username
  refreshToken?: string; // Password
  settings: {
    brokerUrl: string; // e.g., mqtt://localhost:1883, mqtts://broker.hivemq.com:8883
    clientId?: string;
    keepalive?: number;
    clean?: boolean;
    reconnectPeriod?: number;
    connectTimeout?: number;
    qos?: 0 | 1 | 2;
    will?: {
      topic: string;
      payload: string;
      qos?: 0 | 1 | 2;
      retain?: boolean;
    };
    tls?: {
      ca?: string;
      cert?: string;
      key?: string;
      rejectUnauthorized?: boolean;
    };
  };
}

interface MqttConnectionPool {
  client: mqtt.MqttClient;
  subscriptions: Map<
    string,
    { qos: 0 | 1 | 2; callback?: (topic: string, message: Buffer) => void }
  >;
  messageBuffer: Map<
    string,
    { topic: string; message: string; timestamp: number }[]
  >;
}

@Injectable()
export class MqttService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private connectionPool: Map<string, MqttConnectionPool> = new Map();
  private readonly maxBufferSize = 1000;

  async onModuleDestroy() {
    for (const [, pool] of this.connectionPool) {
      try {
        pool.client.end(true);
      } catch (error) {
        this.logger.error('Error disconnecting MQTT client', error);
      }
    }
    this.connectionPool.clear();
  }

  private getConnectionKey(integration: MqttIntegration): string {
    return `${integration.settings.brokerUrl}_${integration.settings.clientId || 'default'}`;
  }

  private async getClient(
    integration: MqttIntegration,
  ): Promise<MqttConnectionPool> {
    const key = this.getConnectionKey(integration);
    let pool = this.connectionPool.get(key);

    if (pool && pool.client.connected) {
      return pool;
    }

    return new Promise((resolve, reject) => {
      const clientId =
        integration.settings.clientId ||
        `mqtt_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const options: mqtt.IClientOptions = {
        clientId,
        keepalive: integration.settings.keepalive || 60,
        clean: integration.settings.clean ?? true,
        reconnectPeriod: integration.settings.reconnectPeriod || 5000,
        connectTimeout: integration.settings.connectTimeout || 30000,
      };

      if (integration.accessToken) {
        options.username = integration.accessToken;
      }
      if (integration.refreshToken) {
        options.password = integration.refreshToken;
      }

      if (integration.settings.will) {
        options.will = {
          topic: integration.settings.will.topic,
          payload: Buffer.from(integration.settings.will.payload),
          qos: integration.settings.will.qos || 0,
          retain: integration.settings.will.retain || false,
        };
      }

      if (integration.settings.tls) {
        options.rejectUnauthorized =
          integration.settings.tls.rejectUnauthorized ?? true;
        if (integration.settings.tls.ca)
          options.ca = integration.settings.tls.ca;
        if (integration.settings.tls.cert)
          options.cert = integration.settings.tls.cert;
        if (integration.settings.tls.key)
          options.key = integration.settings.tls.key;
      }

      const client = mqtt.connect(integration.settings.brokerUrl, options);

      pool = {
        client,
        subscriptions: new Map(),
        messageBuffer: new Map(),
      };

      client.on('connect', () => {
        this.logger.log(`MQTT connected to ${integration.settings.brokerUrl}`);
        this.connectionPool.set(key, pool!);
        resolve(pool!);
      });

      client.on('error', (error) => {
        this.logger.error('MQTT connection error', error);
        reject(error);
      });

      client.on('message', (topic: string, message: Buffer) => {
        this.handleMessage(key, topic, message);
      });

      client.on('close', () => {
        this.logger.warn(
          `MQTT connection closed: ${integration.settings.brokerUrl}`,
        );
      });

      client.on('reconnect', () => {
        this.logger.log(
          `MQTT reconnecting to ${integration.settings.brokerUrl}`,
        );
      });
    });
  }

  private handleMessage(connectionKey: string, topic: string, message: Buffer) {
    const pool = this.connectionPool.get(connectionKey);
    if (!pool) return;

    const messageStr = message.toString();
    const timestamp = Date.now();

    // Store in buffer
    if (!pool.messageBuffer.has(topic)) {
      pool.messageBuffer.set(topic, []);
    }

    const buffer = pool.messageBuffer.get(topic)!;
    buffer.push({ topic, message: messageStr, timestamp });

    // Limit buffer size
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }

    // Emit event for real-time listeners
    this.emit('message', { topic, message: messageStr, timestamp });

    // Call subscription callback if exists
    const subscription = pool.subscriptions.get(topic);
    if (subscription?.callback) {
      subscription.callback(topic, message);
    }
  }

  async testConnection(integration: MqttIntegration): Promise<boolean> {
    try {
      const pool = await this.getClient(integration);
      return pool.client.connected;
    } catch (error) {
      this.logger.error('MQTT connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: MqttIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'status':
        return this.getConnectionStatus(integration);
      case 'subscriptions':
        return this.getSubscriptions(integration);
      case 'messages':
        return this.getBufferedMessages(integration, params);
      case 'subscribe':
        return this.subscribe(integration, params);
      case 'unsubscribe':
        return this.unsubscribe(integration, params);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported MQTT data type: ${dataType}`);
    }
  }

  private async getConnectionStatus(
    integration: MqttIntegration,
  ): Promise<unknown> {
    try {
      const pool = await this.getClient(integration);

      return {
        connected: pool.client.connected,
        reconnecting: pool.client.reconnecting,
        brokerUrl: integration.settings.brokerUrl,
        clientId: integration.settings.clientId,
        subscriptionCount: pool.subscriptions.size,
        bufferedTopics: pool.messageBuffer.size,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getSubscriptions(
    integration: MqttIntegration,
  ): Promise<unknown> {
    const key = this.getConnectionKey(integration);
    const pool = this.connectionPool.get(key);

    if (!pool) {
      return [];
    }

    return Array.from(pool.subscriptions.entries()).map(([topic, sub]) => ({
      topic,
      qos: sub.qos,
    }));
  }

  private async getBufferedMessages(
    integration: MqttIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const key = this.getConnectionKey(integration);
    const pool = this.connectionPool.get(key);

    if (!pool) {
      return [];
    }

    const topic = params?.topic as string;
    const limit = (params?.limit as number) || 100;
    const since = params?.since as number;

    if (topic) {
      const messages = pool.messageBuffer.get(topic) || [];
      let filtered = messages;

      if (since) {
        filtered = messages.filter((m) => m.timestamp > since);
      }

      return filtered.slice(-limit);
    }

    // Return messages from all topics
    const allMessages: { topic: string; message: string; timestamp: number }[] =
      [];

    for (const [, messages] of pool.messageBuffer) {
      allMessages.push(...messages);
    }

    allMessages.sort((a, b) => b.timestamp - a.timestamp);

    let filtered = allMessages;
    if (since) {
      filtered = allMessages.filter((m) => m.timestamp > since);
    }

    return filtered.slice(0, limit);
  }

  async subscribe(
    integration: MqttIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const topic = params?.topic as string;
    const topics = params?.topics as string[];
    const qos = (params?.qos as 0 | 1 | 2) || integration.settings.qos || 0;

    if (!topic && !topics) {
      throw new Error('Topic or topics array is required');
    }

    try {
      const pool = await this.getClient(integration);
      const topicsToSubscribe = topics || [topic];

      return new Promise((resolve, reject) => {
        const subscribeOptions: { [topic: string]: { qos: 0 | 1 | 2 } } = {};
        topicsToSubscribe.forEach((t) => {
          subscribeOptions[t] = { qos };
        });

        pool.client.subscribe(subscribeOptions, (err, granted) => {
          if (err) {
            reject(err);
            return;
          }

          // Track subscriptions
          granted?.forEach((g) => {
            pool.subscriptions.set(g.topic, { qos: g.qos as 0 | 1 | 2 });
          });

          resolve({
            success: true,
            subscribed: granted?.map((g) => ({ topic: g.topic, qos: g.qos })),
          });
        });
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to MQTT topic', error);
      throw error;
    }
  }

  async unsubscribe(
    integration: MqttIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const topic = params?.topic as string;
    const topics = params?.topics as string[];

    if (!topic && !topics) {
      throw new Error('Topic or topics array is required');
    }

    try {
      const pool = await this.getClient(integration);
      const topicsToUnsubscribe = topics || [topic];

      return new Promise((resolve, reject) => {
        pool.client.unsubscribe(topicsToUnsubscribe, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Remove from tracking
          topicsToUnsubscribe.forEach((t) => {
            pool.subscriptions.delete(t);
            pool.messageBuffer.delete(t);
          });

          resolve({
            success: true,
            unsubscribed: topicsToUnsubscribe,
          });
        });
      });
    } catch (error) {
      this.logger.error('Failed to unsubscribe from MQTT topic', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: MqttIntegration,
    _params?: Record<string, unknown>,
  ): Promise<unknown> {
    const key = this.getConnectionKey(integration);
    const pool = this.connectionPool.get(key);

    const status = await this.getConnectionStatus(integration);

    if (!pool) {
      return {
        status,
        summary: {
          totalMessages: 0,
          topicCount: 0,
          subscriptionCount: 0,
        },
      };
    }

    // Calculate message statistics
    let totalMessages = 0;
    const topicStats: {
      topic: string;
      messageCount: number;
      lastMessage?: number;
    }[] = [];

    for (const [topic, messages] of pool.messageBuffer) {
      totalMessages += messages.length;
      topicStats.push({
        topic,
        messageCount: messages.length,
        lastMessage:
          messages.length > 0
            ? messages[messages.length - 1].timestamp
            : undefined,
      });
    }

    // Sort by message count
    topicStats.sort((a, b) => b.messageCount - a.messageCount);

    return {
      status,
      summary: {
        totalMessages,
        topicCount: pool.messageBuffer.size,
        subscriptionCount: pool.subscriptions.size,
        connected: pool.client.connected,
      },
      topicStats: topicStats.slice(0, 20),
    };
  }

  // Publish message
  async publish(
    integration: MqttIntegration,
    data: {
      topic: string;
      message: string | Buffer;
      qos?: 0 | 1 | 2;
      retain?: boolean;
    },
  ): Promise<unknown> {
    try {
      const pool = await this.getClient(integration);

      return new Promise((resolve, reject) => {
        pool.client.publish(
          data.topic,
          data.message,
          {
            qos: data.qos || integration.settings.qos || 0,
            retain: data.retain || false,
          },
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              success: true,
              topic: data.topic,
              qos: data.qos || 0,
              retain: data.retain || false,
            });
          },
        );
      });
    } catch (error) {
      this.logger.error('Failed to publish MQTT message', error);
      throw error;
    }
  }

  // Publish batch messages
  async publishBatch(
    integration: MqttIntegration,
    messages: {
      topic: string;
      message: string | Buffer;
      qos?: 0 | 1 | 2;
      retain?: boolean;
    }[],
  ): Promise<unknown> {
    const results = await Promise.allSettled(
      messages.map((msg) => this.publish(integration, msg)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      total: messages.length,
      successful,
      failed,
      results: results.map((r, i) => ({
        topic: messages[i].topic,
        success: r.status === 'fulfilled',
        error: r.status === 'rejected' ? r.reason?.message : undefined,
      })),
    };
  }
}
