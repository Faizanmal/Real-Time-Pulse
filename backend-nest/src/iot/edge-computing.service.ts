import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EdgeNodeConfig {
  id: string;
  name: string;
  location: string;
  processingRules: EdgeProcessingRule[];
  dataFilters: DataFilter[];
  aggregationConfig: AggregationConfig;
}

export interface EdgeProcessingRule {
  id: string;
  name: string;
  condition: string; // JavaScript expression
  action: 'forward' | 'aggregate' | 'alert' | 'transform' | 'discard';
  actionConfig?: Record<string, any>;
}

export interface DataFilter {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'regex';
  value: any;
  action: 'include' | 'exclude';
}

export interface AggregationConfig {
  interval: number; // seconds
  metrics: MetricAggregation[];
}

export interface MetricAggregation {
  field: string;
  operations: (
    | 'sum'
    | 'avg'
    | 'min'
    | 'max'
    | 'count'
    | 'p50'
    | 'p95'
    | 'p99'
  )[];
}

export interface EdgeNodeStatus {
  nodeId: string;
  status: 'active' | 'inactive' | 'maintenance';
  cpu: number;
  memory: number;
  storage: number;
  devicesConnected: number;
  messagesProcessed: number;
  lastHeartbeat: Date;
}

@Injectable()
export class EdgeComputingService {
  private readonly logger = new Logger(EdgeComputingService.name);
  private edgeNodes = new Map<string, EdgeNodeConfig>();
  private nodeStatuses = new Map<string, EdgeNodeStatus>();
  private aggregationBuffers = new Map<string, Map<string, number[]>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Register or update an edge node
   */
  async registerNode(config: EdgeNodeConfig): Promise<void> {
    this.edgeNodes.set(config.id, config);
    this.nodeStatuses.set(config.id, {
      nodeId: config.id,
      status: 'active',
      cpu: 0,
      memory: 0,
      storage: 0,
      devicesConnected: 0,
      messagesProcessed: 0,
      lastHeartbeat: new Date(),
    });

    this.logger.log(`Edge node registered: ${config.name} (${config.id})`);
    this.eventEmitter.emit('edge.node.registered', config);
  }

  /**
   * Get all edge nodes
   */
  getNodes(): EdgeNodeConfig[] {
    return Array.from(this.edgeNodes.values());
  }

  /**
   * Get edge node status
   */
  getNodeStatus(nodeId: string): EdgeNodeStatus | undefined {
    return this.nodeStatuses.get(nodeId);
  }

  /**
   * Get all node statuses
   */
  getAllNodeStatuses(): EdgeNodeStatus[] {
    return Array.from(this.nodeStatuses.values());
  }

  /**
   * Process data at the edge
   */
  async processAtEdge(
    nodeId: string,
    data: Record<string, any>,
  ): Promise<{
    forwarded: boolean;
    transformed?: Record<string, any>;
    alerts?: string[];
  }> {
    const node = this.edgeNodes.get(nodeId);
    if (!node) {
      return { forwarded: true }; // Forward if no edge rules
    }

    const result = {
      forwarded: false,
      transformed: undefined as Record<string, any> | undefined,
      alerts: [] as string[],
    };

    // Apply data filters
    if (!this.passesFilters(data, node.dataFilters)) {
      return { forwarded: false };
    }

    // Apply processing rules
    for (const rule of node.processingRules) {
      if (this.evaluateCondition(rule.condition, data)) {
        switch (rule.action) {
          case 'forward':
            result.forwarded = true;
            break;
          case 'aggregate':
            await this.aggregateData(nodeId, data, node.aggregationConfig);
            break;
          case 'alert':
            result.alerts.push(rule.name);
            this.eventEmitter.emit('edge.alert', {
              nodeId,
              rule: rule.name,
              data,
            });
            break;
          case 'transform':
            result.transformed = this.transformData(data, rule.actionConfig);
            result.forwarded = true;
            break;
          case 'discard':
            // Do nothing, data is discarded
            break;
        }
      }
    }

    // Update node stats
    const status = this.nodeStatuses.get(nodeId);
    if (status) {
      status.messagesProcessed++;
      status.lastHeartbeat = new Date();
    }

    return result;
  }

  /**
   * Check if data passes all filters
   */
  private passesFilters(
    data: Record<string, any>,
    filters: DataFilter[],
  ): boolean {
    for (const filter of filters) {
      const value = this.getNestedValue(data, filter.field);
      let matches = false;

      switch (filter.operator) {
        case 'gt':
          matches = value > filter.value;
          break;
        case 'gte':
          matches = value >= filter.value;
          break;
        case 'lt':
          matches = value < filter.value;
          break;
        case 'lte':
          matches = value <= filter.value;
          break;
        case 'eq':
          matches = value === filter.value;
          break;
        case 'neq':
          matches = value !== filter.value;
          break;
        case 'regex':
          matches = new RegExp(filter.value).test(String(value));
          break;
      }

      if (filter.action === 'include' && !matches) return false;
      if (filter.action === 'exclude' && matches) return false;
    }

    return true;
  }

  /**
   * Evaluate a JavaScript condition
   */
  private evaluateCondition(
    condition: string,
    data: Record<string, any>,
  ): boolean {
    try {
      // Create a safe evaluation context
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('data', `with(data) { return ${condition}; }`);
      return fn(data);
    } catch {
      return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Transform data based on configuration
   */
  private transformData(
    data: Record<string, any>,
    config?: Record<string, any>,
  ): Record<string, any> {
    if (!config) return data;

    const result: Record<string, any> = {};

    // Apply field mappings
    if (config.mappings) {
      for (const [from, to] of Object.entries(config.mappings)) {
        const value = this.getNestedValue(data, from);
        if (value !== undefined) {
          result[to as string] = value;
        }
      }
    }

    // Apply computed fields
    if (config.computed) {
      for (const [field, expression] of Object.entries(config.computed)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const fn = new Function(
            'data',
            `with(data) { return ${expression as string}; }`,
          );
          result[field] = fn(data);
        } catch {
          // Skip on error
        }
      }
    }

    return { ...data, ...result };
  }

  /**
   * Aggregate data locally before sending
   */
  private async aggregateData(
    nodeId: string,
    data: Record<string, any>,
    config: AggregationConfig,
  ): Promise<void> {
    const bufferKey = nodeId;
    if (!this.aggregationBuffers.has(bufferKey)) {
      this.aggregationBuffers.set(bufferKey, new Map());
    }
    const buffer = this.aggregationBuffers.get(bufferKey)!;

    // Add values to buffer
    for (const metric of config.metrics) {
      const value = this.getNestedValue(data, metric.field);
      if (typeof value === 'number') {
        if (!buffer.has(metric.field)) {
          buffer.set(metric.field, []);
        }
        buffer.get(metric.field)!.push(value);
      }
    }
  }

  /**
   * Flush aggregated data
   */
  flushAggregations(
    nodeId: string,
  ): Record<string, Record<string, number>> | null {
    const buffer = this.aggregationBuffers.get(nodeId);
    if (!buffer || buffer.size === 0) return null;

    const node = this.edgeNodes.get(nodeId);
    if (!node) return null;

    const result: Record<string, Record<string, number>> = {};

    for (const metric of node.aggregationConfig.metrics) {
      const values = buffer.get(metric.field);
      if (!values || values.length === 0) continue;

      result[metric.field] = {};

      for (const op of metric.operations) {
        switch (op) {
          case 'sum':
            result[metric.field].sum = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[metric.field].avg =
              values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            result[metric.field].min = Math.min(...values);
            break;
          case 'max':
            result[metric.field].max = Math.max(...values);
            break;
          case 'count':
            result[metric.field].count = values.length;
            break;
          case 'p50':
            result[metric.field].p50 = this.percentile(values, 50);
            break;
          case 'p95':
            result[metric.field].p95 = this.percentile(values, 95);
            break;
          case 'p99':
            result[metric.field].p99 = this.percentile(values, 99);
            break;
        }
      }
    }

    // Clear buffer
    buffer.clear();

    return result;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Update node heartbeat
   */
  updateHeartbeat(
    nodeId: string,
    resources: { cpu: number; memory: number; storage: number },
  ): void {
    const status = this.nodeStatuses.get(nodeId);
    if (status) {
      status.cpu = resources.cpu;
      status.memory = resources.memory;
      status.storage = resources.storage;
      status.lastHeartbeat = new Date();
    }
  }

  /**
   * Set node maintenance mode
   */
  setMaintenanceMode(nodeId: string, enabled: boolean): void {
    const status = this.nodeStatuses.get(nodeId);
    if (status) {
      status.status = enabled ? 'maintenance' : 'active';
    }
  }

  /**
   * Deploy processing rules to edge node
   */
  async deployRules(
    nodeId: string,
    rules: EdgeProcessingRule[],
  ): Promise<void> {
    const node = this.edgeNodes.get(nodeId);
    if (!node) {
      throw new Error('Edge node not found');
    }

    node.processingRules = rules;

    this.eventEmitter.emit('edge.rules.deployed', {
      nodeId,
      rules,
    });

    this.logger.log(`Deployed ${rules.length} rules to edge node ${nodeId}`);
  }
}
