import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { StreamProcessingService } from './stream-processing.service';
import { CEPEngineService } from './cep-engine.service';

@Controller('streaming')
export class StreamingController {
  constructor(
    private readonly streamService: StreamProcessingService,
    private readonly cepEngine: CEPEngineService,
  ) {}

  // Stream Endpoints
  @Get('streams')
  async getStreams() {
    return this.streamService.getStreams();
  }

  @Post('streams')
  async createStream(
    @Body()
    body: {
      name: string;
      topics: string[];
      consumerGroup?: string;
      processingMode?: 'at-least-once' | 'at-most-once' | 'exactly-once';
      parallelism?: number;
      batchSize?: number;
      windowDuration?: number;
      filters?: any[];
      transformations?: any[];
      aggregations?: any[];
      sinks?: any[];
    },
  ) {
    return this.streamService.createStream({
      name: body.name,
      topics: body.topics,
      consumerGroup: body.consumerGroup || `cg-${body.name}-${Date.now()}`,
      processingMode: body.processingMode || 'at-least-once',
      parallelism: body.parallelism || 1,
      batchSize: body.batchSize || 100,
      windowDuration: body.windowDuration || 60000,
      filters: body.filters,
      transformations: body.transformations,
      aggregations: body.aggregations,
      sinks: body.sinks,
    });
  }

  @Put('streams/:id')
  async updateStream(@Param('id') id: string, @Body() updates: any) {
    return this.streamService.updateStream(id, updates);
  }

  @Delete('streams/:id')
  async deleteStream(@Param('id') id: string) {
    await this.streamService.deleteStream(id);
    return { success: true };
  }

  @Get('streams/:id/metrics')
  async getStreamMetrics(@Param('id') id: string) {
    return this.streamService.getStreamMetrics(id);
  }

  // CEP Rule Endpoints
  @Get('cep/rules')
  async getCEPRules() {
    return this.cepEngine.getRules();
  }

  @Get('cep/rules/:id')
  async getCEPRule(@Param('id') id: string) {
    return this.cepEngine.getRule(id);
  }

  @Post('cep/rules')
  async createCEPRule(
    @Body()
    body: {
      name: string;
      description?: string;
      pattern: {
        type: 'sequence' | 'absence' | 'frequency' | 'correlation' | 'threshold' | 'trend';
        conditions: any[];
        withinWindow?: number;
        minOccurrences?: number;
        maxOccurrences?: number;
        correlationFields?: string[];
      };
      timeWindow: number;
      action: {
        type: 'alert' | 'email' | 'webhook' | 'aggregate' | 'trigger_flow' | 'emit';
        config: any;
      };
      enabled?: boolean;
      priority?: number;
    },
  ) {
    return this.cepEngine.createRule({
      name: body.name,
      description: body.description,
      pattern: body.pattern,
      timeWindow: body.timeWindow,
      action: body.action,
      enabled: body.enabled ?? true,
      priority: body.priority ?? 1,
    });
  }

  @Put('cep/rules/:id')
  async updateCEPRule(@Param('id') id: string, @Body() updates: any) {
    return this.cepEngine.updateRule(id, updates);
  }

  @Delete('cep/rules/:id')
  async deleteCEPRule(@Param('id') id: string) {
    await this.cepEngine.deleteRule(id);
    return { success: true };
  }

  @Get('cep/matches')
  getCEPMatches(@Query('limit') limit?: string) {
    return this.cepEngine.getMatchHistory(limit ? parseInt(limit) : 100);
  }

  @Get('cep/stats')
  getCEPStats() {
    return this.cepEngine.getStats();
  }

  // Topic Management
  @Get('topics')
  getTopics() {
    // In production, list Kafka topics
    return [
      { name: 'events', partitions: 12, replicationFactor: 3 },
      { name: 'user-actions', partitions: 6, replicationFactor: 3 },
      { name: 'metrics', partitions: 24, replicationFactor: 3 },
      { name: 'logs', partitions: 12, replicationFactor: 3 },
    ];
  }

  // Stream Templates
  @Get('templates')
  getStreamTemplates() {
    return [
      {
        id: 'user-activity',
        name: 'User Activity Stream',
        description: 'Track user clicks, page views, and interactions',
        config: {
          topics: ['user-events'],
          filters: [{ field: 'eventType', operator: 'neq', value: 'heartbeat' }],
          aggregations: [
            {
              windowType: 'tumbling',
              windowSize: 60000,
              groupBy: ['userId'],
              aggregations: [{ field: 'eventType', function: 'count', alias: 'eventCount' }],
            },
          ],
        },
      },
      {
        id: 'error-monitoring',
        name: 'Error Monitoring Stream',
        description: 'Monitor and alert on application errors',
        config: {
          topics: ['logs'],
          filters: [{ field: 'level', operator: 'eq', value: 'error' }],
          sinks: [
            { type: 'database', config: { table: 'error_logs' } },
            { type: 'webhook', config: { url: '/api/alerts' } },
          ],
        },
      },
      {
        id: 'realtime-metrics',
        name: 'Real-time Metrics Stream',
        description: 'Aggregate metrics for dashboards',
        config: {
          topics: ['metrics'],
          aggregations: [
            {
              windowType: 'sliding',
              windowSize: 300000,
              slideInterval: 60000,
              aggregations: [
                { field: 'value', function: 'avg', alias: 'avgValue' },
                { field: 'value', function: 'max', alias: 'maxValue' },
                { field: 'value', function: 'min', alias: 'minValue' },
              ],
            },
          ],
          sinks: [{ type: 'websocket', config: { channel: 'metrics-dashboard' } }],
        },
      },
    ];
  }
}
