import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, Producer, Admin, KafkaMessage, EachMessagePayload } from 'kafkajs';

interface KafkaIntegration {
  accessToken?: string; // For SASL authentication
  refreshToken?: string; // SASL password
  settings: {
    brokers: string[];
    clientId: string;
    groupId?: string;
    ssl?: boolean;
    sasl?: {
      mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
      username: string;
      password: string;
    };
    schemaRegistryUrl?: string;
  };
}

interface KafkaConnectionPool {
  kafka: Kafka;
  admin?: Admin;
  producer?: Producer;
  consumers: Map<string, Consumer>;
}

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private connectionPool: Map<string, KafkaConnectionPool> = new Map();

  async onModuleDestroy() {
    // Cleanup all connections
    for (const [, pool] of this.connectionPool) {
      try {
        if (pool.producer) await pool.producer.disconnect();
        if (pool.admin) await pool.admin.disconnect();
        for (const consumer of pool.consumers.values()) {
          await consumer.disconnect();
        }
      } catch (error) {
        this.logger.error('Error disconnecting Kafka clients', error);
      }
    }
    this.connectionPool.clear();
  }

  private getConnectionKey(integration: KafkaIntegration): string {
    return `${integration.settings.brokers.join(',')}_${integration.settings.clientId}`;
  }

  private getKafkaClient(integration: KafkaIntegration): Kafka {
    const key = this.getConnectionKey(integration);
    let pool = this.connectionPool.get(key);

    if (!pool) {
      const kafkaConfig: any = {
        clientId: integration.settings.clientId,
        brokers: integration.settings.brokers,
        retry: {
          retries: 5,
          initialRetryTime: 300,
          maxRetryTime: 30000,
        },
      };

      if (integration.settings.ssl) {
        kafkaConfig.ssl = true;
      }

      if (integration.settings.sasl || (integration.accessToken && integration.refreshToken)) {
        kafkaConfig.sasl = integration.settings.sasl || {
          mechanism: 'plain',
          username: integration.accessToken,
          password: integration.refreshToken,
        };
      }

      pool = {
        kafka: new Kafka(kafkaConfig),
        consumers: new Map(),
      };
      this.connectionPool.set(key, pool);
    }

    return pool.kafka;
  }

  private async getAdmin(integration: KafkaIntegration): Promise<Admin> {
    const key = this.getConnectionKey(integration);
    let pool = this.connectionPool.get(key);

    if (!pool) {
      this.getKafkaClient(integration);
      pool = this.connectionPool.get(key)!;
    }

    if (!pool.admin) {
      pool.admin = pool.kafka.admin();
      await pool.admin.connect();
    }

    return pool.admin;
  }

  private async getProducer(integration: KafkaIntegration): Promise<Producer> {
    const key = this.getConnectionKey(integration);
    let pool = this.connectionPool.get(key);

    if (!pool) {
      this.getKafkaClient(integration);
      pool = this.connectionPool.get(key)!;
    }

    if (!pool.producer) {
      pool.producer = pool.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
      });
      await pool.producer.connect();
    }

    return pool.producer;
  }

  async testConnection(integration: KafkaIntegration): Promise<boolean> {
    try {
      const admin = await this.getAdmin(integration);
      await admin.listTopics();
      return true;
    } catch (error) {
      this.logger.error('Kafka connection test failed', error);
      return false;
    }
  }

  async fetchData(
    integration: KafkaIntegration,
    dataType: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (dataType) {
      case 'topics':
        return this.fetchTopics(integration);
      case 'topicMetadata':
        return this.fetchTopicMetadata(integration, params);
      case 'consumerGroups':
        return this.fetchConsumerGroups(integration);
      case 'consumerGroupOffsets':
        return this.fetchConsumerGroupOffsets(integration, params);
      case 'messages':
        return this.consumeMessages(integration, params);
      case 'clusterInfo':
        return this.fetchClusterInfo(integration);
      case 'analytics':
        return this.fetchAnalytics(integration, params);
      default:
        throw new Error(`Unsupported Kafka data type: ${dataType}`);
    }
  }

  private async fetchTopics(integration: KafkaIntegration): Promise<unknown> {
    try {
      const admin = await this.getAdmin(integration);
      const topics = await admin.listTopics();

      const topicMetadata = await admin.fetchTopicMetadata({ topics });

      return topicMetadata.topics.map((topic) => ({
        name: topic.name,
        partitions: topic.partitions.length,
        partitionDetails: topic.partitions.map((p) => ({
          partitionId: p.partitionId,
          leader: p.leader,
          replicas: p.replicas,
          isr: p.isr,
        })),
      }));
    } catch (error) {
      this.logger.error('Failed to fetch Kafka topics', error);
      throw error;
    }
  }

  private async fetchTopicMetadata(
    integration: KafkaIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const topic = params?.topic as string;
      if (!topic) {
        throw new Error('Topic name is required');
      }

      const admin = await this.getAdmin(integration);

      const [metadata, offsets] = await Promise.all([
        admin.fetchTopicMetadata({ topics: [topic] }),
        admin.fetchTopicOffsets(topic),
      ]);

      const topicInfo = metadata.topics[0];

      return {
        name: topic,
        partitions: topicInfo.partitions.map((p, idx) => ({
          partitionId: p.partitionId,
          leader: p.leader,
          replicas: p.replicas,
          isr: p.isr,
          offset: offsets[idx]?.offset,
          high: offsets[idx]?.high,
          low: offsets[idx]?.low,
        })),
        totalPartitions: topicInfo.partitions.length,
        replicationFactor: topicInfo.partitions[0]?.replicas.length || 0,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Kafka topic metadata', error);
      throw error;
    }
  }

  private async fetchConsumerGroups(integration: KafkaIntegration): Promise<unknown> {
    try {
      const admin = await this.getAdmin(integration);
      const groups = await admin.listGroups();

      const groupDetails = await Promise.all(
        groups.groups.map(async (group) => {
          try {
            const description = await admin.describeGroups([group.groupId]);
            return {
              groupId: group.groupId,
              protocolType: group.protocolType,
              state: description.groups[0]?.state,
              members: description.groups[0]?.members.length || 0,
              protocol: description.groups[0]?.protocol,
            };
          } catch {
            return {
              groupId: group.groupId,
              protocolType: group.protocolType,
            };
          }
        }),
      );

      return groupDetails;
    } catch (error) {
      this.logger.error('Failed to fetch Kafka consumer groups', error);
      throw error;
    }
  }

  private async fetchConsumerGroupOffsets(
    integration: KafkaIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const groupId = params?.groupId as string;
      const topics = params?.topics as string[];

      if (!groupId) {
        throw new Error('Group ID is required');
      }

      const admin = await this.getAdmin(integration);

      const topicsToFetch = topics || (await admin.listTopics());
      const offsets = await admin.fetchOffsets({
        groupId,
        topics: topicsToFetch,
      });

      // Get topic high watermarks for lag calculation
      const lagInfo = await Promise.all(
        offsets.map(async (topicOffset) => {
          try {
            const highWatermarks = await admin.fetchTopicOffsets(topicOffset.topic);

            const partitions = topicOffset.partitions.map((p) => {
              const hw = highWatermarks.find((h) => h.partition === p.partition);
              const currentOffset = parseInt(p.offset) || 0;
              const highWatermark = parseInt(hw?.high || '0');

              return {
                partition: p.partition,
                offset: p.offset,
                highWatermark: hw?.high,
                lag: highWatermark - currentOffset,
              };
            });

            return {
              topic: topicOffset.topic,
              partitions,
              totalLag: partitions.reduce((sum, p) => sum + p.lag, 0),
            };
          } catch {
            return {
              topic: topicOffset.topic,
              partitions: topicOffset.partitions,
              totalLag: null,
            };
          }
        }),
      );

      return lagInfo;
    } catch (error) {
      this.logger.error('Failed to fetch Kafka consumer group offsets', error);
      throw error;
    }
  }

  private async consumeMessages(
    integration: KafkaIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const topic = params?.topic as string;
    const partition = (params?.partition as number) ?? 0;
    const limit = (params?.limit as number) || 10;
    const fromBeginning = (params?.fromBeginning as boolean) ?? false;

    if (!topic) {
      throw new Error('Topic name is required');
    }

    try {
      const kafka = this.getKafkaClient(integration);
      const groupId =
        integration.settings.groupId || `temp-consumer-${Date.now()}`;

      const consumer = kafka.consumer({ groupId });
      await consumer.connect();

      const messages: any[] = [];
      let messageCount = 0;

      await consumer.subscribe({ topic, fromBeginning });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(async () => {
          await consumer.disconnect();
          resolve(messages);
        }, 10000); // 10 second timeout

        consumer
          .run({
            eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
              if (messageCount < limit) {
                messages.push({
                  topic,
                  partition,
                  offset: message.offset,
                  key: message.key?.toString(),
                  value: message.value?.toString(),
                  timestamp: message.timestamp,
                  headers: message.headers,
                });
                messageCount++;

                if (messageCount >= limit) {
                  clearTimeout(timeout);
                  await consumer.disconnect();
                  resolve(messages);
                }
              }
            },
          })
          .catch(async (err) => {
            clearTimeout(timeout);
            await consumer.disconnect();
            reject(err);
          });
      });
    } catch (error) {
      this.logger.error('Failed to consume Kafka messages', error);
      throw error;
    }
  }

  private async fetchClusterInfo(integration: KafkaIntegration): Promise<unknown> {
    try {
      const admin = await this.getAdmin(integration);
      const cluster = await admin.describeCluster();

      return {
        clusterId: cluster.clusterId,
        controller: cluster.controller,
        brokers: cluster.brokers.map((b) => ({
          nodeId: b.nodeId,
          host: b.host,
          port: b.port,
          rack: b.rack,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Kafka cluster info', error);
      throw error;
    }
  }

  private async fetchAnalytics(
    integration: KafkaIntegration,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const [topics, consumerGroups, clusterInfo] = await Promise.all([
        this.fetchTopics(integration),
        this.fetchConsumerGroups(integration),
        this.fetchClusterInfo(integration),
      ]);

      const topicsArray = topics as any[];
      const groupsArray = consumerGroups as any[];
      const cluster = clusterInfo as any;

      // Calculate total partitions
      const totalPartitions = topicsArray.reduce(
        (sum, t) => sum + (t.partitions || 0),
        0,
      );

      // Count active vs inactive groups
      const activeGroups = groupsArray.filter(
        (g) => g.state === 'Stable' || g.state === 'PreparingRebalance',
      ).length;

      return {
        summary: {
          totalTopics: topicsArray.length,
          totalPartitions,
          totalConsumerGroups: groupsArray.length,
          activeConsumerGroups: activeGroups,
          totalBrokers: cluster.brokers?.length || 0,
          controllerId: cluster.controller,
        },
        topicSummary: topicsArray.slice(0, 10).map((t) => ({
          name: t.name,
          partitions: t.partitions,
        })),
        consumerGroupSummary: groupsArray.slice(0, 10).map((g) => ({
          groupId: g.groupId,
          state: g.state,
          members: g.members,
        })),
        brokers: cluster.brokers || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch Kafka analytics', error);
      throw error;
    }
  }

  // Produce messages
  async produceMessages(
    integration: KafkaIntegration,
    data: {
      topic: string;
      messages: { key?: string; value: string; headers?: Record<string, string> }[];
      acks?: -1 | 0 | 1;
    },
  ): Promise<unknown> {
    try {
      const producer = await this.getProducer(integration);

      const result = await producer.send({
        topic: data.topic,
        messages: data.messages.map((m) => ({
          key: m.key,
          value: m.value,
          headers: m.headers,
        })),
        acks: data.acks ?? -1,
      });

      return {
        success: true,
        recordsProduced: data.messages.length,
        topicPartitions: result,
      };
    } catch (error) {
      this.logger.error('Failed to produce Kafka messages', error);
      throw error;
    }
  }

  // Create topic
  async createTopic(
    integration: KafkaIntegration,
    data: {
      topic: string;
      numPartitions?: number;
      replicationFactor?: number;
      configEntries?: { name: string; value: string }[];
    },
  ): Promise<unknown> {
    try {
      const admin = await this.getAdmin(integration);

      await admin.createTopics({
        topics: [
          {
            topic: data.topic,
            numPartitions: data.numPartitions || 1,
            replicationFactor: data.replicationFactor || 1,
            configEntries: data.configEntries,
          },
        ],
      });

      return { success: true, topic: data.topic };
    } catch (error) {
      this.logger.error('Failed to create Kafka topic', error);
      throw error;
    }
  }

  // Delete topic
  async deleteTopic(
    integration: KafkaIntegration,
    topic: string,
  ): Promise<unknown> {
    try {
      const admin = await this.getAdmin(integration);
      await admin.deleteTopics({ topics: [topic] });

      return { success: true, topic };
    } catch (error) {
      this.logger.error('Failed to delete Kafka topic', error);
      throw error;
    }
  }
}
