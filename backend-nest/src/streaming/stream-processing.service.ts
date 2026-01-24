import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

// Kafka consumer/producer types (using native implementation for flexibility)
interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: any;
  timestamp: string;
  headers?: Record<string, string>;
}

export interface StreamConfig {
  id: string;
  name: string;
  topics: string[];
  consumerGroup: string;
  processingMode: 'at-least-once' | 'at-most-once' | 'exactly-once';
  parallelism: number;
  batchSize: number;
  windowDuration: number; // ms
  filters?: StreamFilter[];
  transformations?: StreamTransformation[];
  aggregations?: StreamAggregation[];
  sinks?: StreamSink[];
}

interface StreamFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex';
  value: any;
}

interface StreamTransformation {
  type: 'map' | 'flatMap' | 'filter' | 'enrich' | 'parse' | 'project';
  config: Record<string, any>;
}

interface StreamAggregation {
  windowType: 'tumbling' | 'sliding' | 'session' | 'global';
  windowSize: number;
  slideInterval?: number;
  groupBy?: string[];
  aggregations: {
    field: string;
    function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last' | 'collect';
    alias: string;
  }[];
}

interface StreamSink {
  type: 'kafka' | 'database' | 'websocket' | 'webhook' | 'file';
  config: Record<string, any>;
}

interface StreamWindow {
  id: string;
  startTime: number;
  endTime: number;
  events: any[];
  aggregatedResults?: Record<string, any>;
}

@Injectable()
export class StreamProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamProcessingService.name);
  private readonly streams = new Map<string, StreamConfig>();
  private readonly windows = new Map<string, StreamWindow[]>();
  private readonly consumers = new Map<string, any>();
  private readonly producers = new Map<string, any>();
  private readonly metrics = new Map<
    string,
    {
      messagesProcessed: number;
      bytesProcessed: number;
      errorsCount: number;
      latencyMs: number[];
      lastMessageTime: Date;
    }
  >();

  private kafkaConnected = false;
  private kafkaBrokers: string[] = ['localhost:9092'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Initialize Kafka connection
    this.kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
    await this.initializeKafka();

    // Load existing stream configs
    await this.loadStreamConfigs();
  }

  async onModuleDestroy() {
    // Cleanup
    for (const consumer of this.consumers.values()) {
      await consumer?.disconnect?.();
    }
    for (const producer of this.producers.values()) {
      await producer?.disconnect?.();
    }
  }

  private async initializeKafka() {
    try {
      // In production, use actual Kafka client like kafkajs
      this.kafkaConnected = true;
      this.logger.log(`Connected to Kafka brokers: ${this.kafkaBrokers.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to connect to Kafka:', error);
    }
  }

  private async loadStreamConfigs() {
    // Load from database or config
    this.logger.log('Loading stream configurations...');
  }

  // Stream Management
  async createStream(config: Omit<StreamConfig, 'id'>): Promise<StreamConfig> {
    const id = `stream-${Date.now()}`;
    const stream: StreamConfig = { ...config, id };

    this.streams.set(id, stream);
    this.metrics.set(id, {
      messagesProcessed: 0,
      bytesProcessed: 0,
      errorsCount: 0,
      latencyMs: [],
      lastMessageTime: new Date(),
    });

    // Initialize windows for this stream
    if (stream.aggregations?.length) {
      this.windows.set(id, []);
    }

    // Start consuming
    await this.startStreamConsumer(stream);

    this.logger.log(`Created stream: ${stream.name} (${id})`);
    return stream;
  }

  async updateStream(id: string, updates: Partial<StreamConfig>): Promise<StreamConfig> {
    const stream = this.streams.get(id);
    if (!stream) throw new Error(`Stream ${id} not found`);

    const updated = { ...stream, ...updates };
    this.streams.set(id, updated);

    // Restart consumer if topics changed
    if (updates.topics) {
      await this.restartStreamConsumer(id);
    }

    return updated;
  }

  async deleteStream(id: string): Promise<void> {
    const consumer = this.consumers.get(id);
    if (consumer) {
      await consumer.disconnect?.();
      this.consumers.delete(id);
    }

    this.streams.delete(id);
    this.windows.delete(id);
    this.metrics.delete(id);
  }

  async getStreams(): Promise<StreamConfig[]> {
    return Array.from(this.streams.values());
  }

  async getStreamMetrics(id: string) {
    return this.metrics.get(id);
  }

  // Stream Processing
  private async startStreamConsumer(stream: StreamConfig) {
    if (!this.kafkaConnected) {
      this.logger.warn('Kafka not connected, using mock consumer');
      // Start mock consumer for demo
      this.startMockConsumer(stream);
      return;
    }

    // In production, create actual Kafka consumer
    // const consumer = this.kafka.consumer({ groupId: stream.consumerGroup });
    // await consumer.connect();
    // await consumer.subscribe({ topics: stream.topics, fromBeginning: false });
    //
    // await consumer.run({
    //   eachMessage: async ({ topic, partition, message }) => {
    //     await this.processMessage(stream, {
    //       topic,
    //       partition,
    //       offset: message.offset,
    //       key: message.key?.toString() || null,
    //       value: JSON.parse(message.value?.toString() || '{}'),
    //       timestamp: message.timestamp,
    //     });
    //   },
    // });
  }

  private startMockConsumer(stream: StreamConfig) {
    // Generate mock events for demo
    const interval = setInterval(() => {
      const mockMessage: KafkaMessage = {
        topic: stream.topics[0],
        partition: 0,
        offset: Date.now().toString(),
        key: `key-${Math.random().toString(36).substr(2, 9)}`,
        value: this.generateMockEvent(stream.topics[0]),
        timestamp: Date.now().toString(),
      };

      void this.processMessage(stream, mockMessage);
    }, 1000);

    this.consumers.set(stream.id, {
      disconnect: () => clearInterval(interval),
    });
  }

  private generateMockEvent(_topic: string): any {
    const eventTypes = ['click', 'page_view', 'purchase', 'signup', 'login'];
    return {
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      userId: `user-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      value: Math.random() * 1000,
      properties: {
        page: `/page-${Math.floor(Math.random() * 10)}`,
        source: ['organic', 'paid', 'social'][Math.floor(Math.random() * 3)],
      },
    };
  }

  private async restartStreamConsumer(id: string) {
    const stream = this.streams.get(id);
    if (!stream) return;

    const consumer = this.consumers.get(id);
    if (consumer) {
      await consumer.disconnect?.();
    }

    await this.startStreamConsumer(stream);
  }

  private async processMessage(stream: StreamConfig, message: KafkaMessage) {
    const startTime = Date.now();
    const metrics = this.metrics.get(stream.id);

    try {
      let data = message.value;

      // Apply filters
      if (stream.filters?.length) {
        if (!this.applyFilters(data, stream.filters)) {
          return; // Message filtered out
        }
      }

      // Apply transformations
      if (stream.transformations?.length) {
        data = await this.applyTransformations(data, stream.transformations);
        if (data === null) return; // Filtered or flattened out
      }

      // Handle windowed aggregations
      if (stream.aggregations?.length) {
        await this.handleWindowedAggregation(stream, data);
      }

      // Send to sinks
      if (stream.sinks?.length) {
        await this.sendToSinks(stream, data);
      }

      // Update metrics
      if (metrics) {
        metrics.messagesProcessed++;
        metrics.bytesProcessed += JSON.stringify(data).length;
        metrics.latencyMs.push(Date.now() - startTime);
        if (metrics.latencyMs.length > 1000) {
          metrics.latencyMs = metrics.latencyMs.slice(-1000);
        }
        metrics.lastMessageTime = new Date();
      }

      // Emit event for real-time dashboard
      this.eventEmitter.emit('stream.message', {
        streamId: stream.id,
        data,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error processing message in stream ${stream.id}:`, error);
      if (metrics) {
        metrics.errorsCount++;
      }
    }
  }

  private applyFilters(data: any, filters: StreamFilter[]): boolean {
    return filters.every((filter) => {
      const value = this.getNestedValue(data, filter.field);

      switch (filter.operator) {
        case 'eq':
          return value === filter.value;
        case 'neq':
          return value !== filter.value;
        case 'gt':
          return value > filter.value;
        case 'lt':
          return value < filter.value;
        case 'gte':
          return value >= filter.value;
        case 'lte':
          return value <= filter.value;
        case 'contains':
          return String(value).includes(filter.value);
        case 'regex':
          return new RegExp(filter.value).test(String(value));
        default:
          return true;
      }
    });
  }

  private async applyTransformations(
    data: any,
    transformations: StreamTransformation[],
  ): Promise<any> {
    let result = data;

    for (const transform of transformations) {
      switch (transform.type) {
        case 'map':
          result = this.mapTransform(result, transform.config);
          break;
        case 'filter':
          if (!this.filterTransform(result, transform.config)) {
            return null;
          }
          break;
        case 'enrich':
          result = await this.enrichTransform(result, transform.config);
          break;
        case 'parse':
          result = this.parseTransform(result, transform.config);
          break;
        case 'project':
          result = this.projectTransform(result, transform.config);
          break;
      }
    }

    return result;
  }

  private mapTransform(data: any, config: Record<string, any>): any {
    const result: any = {};

    for (const [targetField, sourceExpr] of Object.entries(config.mappings || {})) {
      if (typeof sourceExpr === 'string' && sourceExpr.startsWith('$')) {
        result[targetField] = this.getNestedValue(data, sourceExpr.slice(1));
      } else {
        result[targetField] = sourceExpr;
      }
    }

    return { ...data, ...result };
  }

  private filterTransform(data: any, config: Record<string, any>): boolean {
    const condition = config.condition;
    if (!condition) return true;

    // Simple expression evaluation
    return this.evaluateCondition(data, condition);
  }

  private async enrichTransform(data: any, config: Record<string, any>): Promise<any> {
    const enriched = { ...data };

    // Lookup enrichment from database or API
    if (config.lookupTable && config.lookupField && config.joinField) {
      const lookupValue = this.getNestedValue(data, config.joinField);
      // In production, fetch from actual data source
      enriched[config.targetField || 'enriched'] = {
        lookupTable: config.lookupTable,
        lookupValue,
      };
    }

    return enriched;
  }

  private parseTransform(data: any, config: Record<string, any>): any {
    const field = config.field || 'payload';
    const format = config.format || 'json';
    const value = this.getNestedValue(data, field);

    if (format === 'json' && typeof value === 'string') {
      try {
        return { ...data, [field]: JSON.parse(value) };
      } catch {
        return data;
      }
    }

    return data;
  }

  private projectTransform(data: any, config: Record<string, any>): any {
    const fields = config.fields || [];
    const exclude = config.exclude || [];
    const result: any = {};

    if (fields.length > 0) {
      for (const field of fields) {
        result[field] = this.getNestedValue(data, field);
      }
    } else {
      Object.assign(result, data);
      for (const field of exclude) {
        delete result[field];
      }
    }

    return result;
  }

  private async handleWindowedAggregation(stream: StreamConfig, data: any) {
    const windows = this.windows.get(stream.id) || [];
    const now = Date.now();

    for (const aggConfig of stream.aggregations || []) {
      // Get or create current window
      let currentWindow = windows.find((w) => now >= w.startTime && now < w.endTime);

      if (!currentWindow) {
        // Create new window
        const windowStart = Math.floor(now / aggConfig.windowSize) * aggConfig.windowSize;
        currentWindow = {
          id: `window-${windowStart}`,
          startTime: windowStart,
          endTime: windowStart + aggConfig.windowSize,
          events: [],
        };
        windows.push(currentWindow);

        // Cleanup old windows
        const cutoff = now - aggConfig.windowSize * 10;
        const activeWindows = windows.filter((w) => w.endTime > cutoff);
        this.windows.set(stream.id, activeWindows);
      }

      // Add event to window
      currentWindow.events.push(data);

      // Calculate running aggregation
      currentWindow.aggregatedResults = this.calculateAggregation(currentWindow.events, aggConfig);

      // Check if window should be emitted
      if (now >= currentWindow.endTime && !currentWindow.aggregatedResults?._emitted) {
        this.emitWindowResult(stream, currentWindow, aggConfig);
        currentWindow.aggregatedResults._emitted = true;
      }
    }

    this.windows.set(stream.id, windows);
  }

  private calculateAggregation(events: any[], config: StreamAggregation): Record<string, any> {
    const groups = new Map<string, any[]>();

    // Group events
    if (config.groupBy?.length) {
      for (const event of events) {
        const key = config.groupBy.map((f) => this.getNestedValue(event, f)).join('::');
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(event);
      }
    } else {
      groups.set('_all', events);
    }

    // Calculate aggregations per group
    const results: Record<string, any> = {};

    for (const [groupKey, groupEvents] of groups) {
      const groupResult: Record<string, any> = {};

      if (config.groupBy?.length) {
        const keyParts = groupKey.split('::');
        config.groupBy.forEach((field, i) => {
          groupResult[field] = keyParts[i];
        });
      }

      for (const agg of config.aggregations) {
        const values = groupEvents.map((e) => this.getNestedValue(e, agg.field));
        const numericValues = values.filter((v) => typeof v === 'number');

        switch (agg.function) {
          case 'count':
            groupResult[agg.alias] = groupEvents.length;
            break;
          case 'sum':
            groupResult[agg.alias] = numericValues.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            groupResult[agg.alias] = numericValues.length
              ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
              : 0;
            break;
          case 'min':
            groupResult[agg.alias] = Math.min(...numericValues);
            break;
          case 'max':
            groupResult[agg.alias] = Math.max(...numericValues);
            break;
          case 'first':
            groupResult[agg.alias] = values[0];
            break;
          case 'last':
            groupResult[agg.alias] = values[values.length - 1];
            break;
          case 'collect':
            groupResult[agg.alias] = values;
            break;
        }
      }

      results[groupKey] = groupResult;
    }

    return results;
  }

  private emitWindowResult(stream: StreamConfig, window: StreamWindow, config: StreamAggregation) {
    const result = {
      streamId: stream.id,
      windowId: window.id,
      windowType: config.windowType,
      startTime: new Date(window.startTime),
      endTime: new Date(window.endTime),
      eventCount: window.events.length,
      aggregations: window.aggregatedResults,
    };

    this.eventEmitter.emit('stream.window.completed', result);
    this.logger.debug(`Window completed: ${window.id}, events: ${window.events.length}`);
  }

  private async sendToSinks(stream: StreamConfig, data: any) {
    for (const sink of stream.sinks || []) {
      try {
        switch (sink.type) {
          case 'kafka':
            await this.sendToKafka(sink.config, data);
            break;
          case 'database':
            await this.sendToDatabase(sink.config, data);
            break;
          case 'websocket':
            await this.sendToWebSocket(sink.config, data);
            break;
          case 'webhook':
            await this.sendToWebhook(sink.config, data);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send to sink ${sink.type}:`, error);
      }
    }
  }

  private async sendToKafka(config: Record<string, any>, _data: any) {
    // In production, use Kafka producer
    this.logger.debug(`Sending to Kafka topic ${config.topic}`);
  }

  private async sendToDatabase(_config: Record<string, any>, _data: any) {
    // Write to database using Prisma
    // TODO: Add StreamEvent model to Prisma schema
    // await this.prisma.streamEvent?.create?.({
    //   data: {
    //     streamId: config.streamId,
    //     eventType: data.eventType,
    //     payload: data,
    //     timestamp: new Date(),
    //   },
    // });
  }

  private async sendToWebSocket(config: Record<string, any>, data: any) {
    this.eventEmitter.emit('websocket.broadcast', {
      channel: config.channel,
      event: 'stream_data',
      data,
    });
  }

  private async sendToWebhook(config: Record<string, any>, data: any) {
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
      body: JSON.stringify(data),
    });
  }

  // Helper methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private evaluateCondition(data: any, condition: string): boolean {
    // Simple condition evaluation - in production use a proper expression parser
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('data', `with(data) { return ${condition}; }`);
      return fn(data);
    } catch {
      return true;
    }
  }
}
