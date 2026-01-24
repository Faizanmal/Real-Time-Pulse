import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ETLPipelineConfig {
  id: string;
  name: string;
  description?: string;
  nodes: ETLNode[];
  edges: ETLEdge[];
  schedule?: {
    cron: string;
    timezone: string;
    enabled: boolean;
  };
  status: 'draft' | 'active' | 'paused' | 'error';
}

export interface ETLNode {
  id: string;
  type: 'source' | 'transform' | 'filter' | 'aggregate' | 'join' | 'destination';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface ETLEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ETLExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  rowsProcessed: number;
  errors: string[];
  nodeStats: Record<string, { processed: number; errors: number; duration: number }>;
}

export interface TransformationResult {
  data: any[];
  metadata: {
    inputRows: number;
    outputRows: number;
    droppedRows: number;
    errors: string[];
  };
}

@Injectable()
export class ETLPipelineService {
  private readonly logger = new Logger(ETLPipelineService.name);
  private runningExecutions = new Map<string, ETLExecution>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new ETL pipeline
   */
  async createPipeline(
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      nodes: ETLNode[];
      edges: ETLEdge[];
      schedule?: { cron: string; timezone: string; enabled: boolean };
    },
  ): Promise<ETLPipelineConfig> {
    // Validate pipeline structure
    this.validatePipeline(data.nodes, data.edges);

    const pipeline = await this.prisma.eTLPipeline.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description,
        nodes: data.nodes as any,
        edges: data.edges as any,
        schedule: (data.schedule as any) || null,
        status: 'draft',
      },
    });

    return {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description || undefined,
      nodes: pipeline.nodes as unknown as ETLNode[],
      edges: pipeline.edges as unknown as ETLEdge[],
      schedule: pipeline.schedule as any,
      status: pipeline.status as any,
    };
  }

  /**
   * Validate pipeline structure
   */
  private validatePipeline(nodes: ETLNode[], edges: ETLEdge[]): void {
    // Check for at least one source and one destination
    const sources = nodes.filter((n) => n.type === 'source');
    const destinations = nodes.filter((n) => n.type === 'destination');

    if (sources.length === 0) {
      throw new BadRequestException('Pipeline must have at least one source node');
    }

    if (destinations.length === 0) {
      throw new BadRequestException('Pipeline must have at least one destination node');
    }

    // Check that all edges reference valid nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        throw new BadRequestException(`Invalid edge source: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new BadRequestException(`Invalid edge target: ${edge.target}`);
      }
    }

    // Check for cycles (DAG validation)
    if (this.hasCycle(nodes, edges)) {
      throw new BadRequestException('Pipeline contains a cycle');
    }
  }

  /**
   * Check if graph has a cycle
   */
  private hasCycle(nodes: ETLNode[], edges: ETLEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of nodes) {
      adjacency.set(node.id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.source).push(edge.target);
    }

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Get all pipelines for a workspace
   */
  async getPipelines(workspaceId: string): Promise<ETLPipelineConfig[]> {
    const pipelines = await this.prisma.eTLPipeline.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });

    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      nodes: p.nodes as unknown as ETLNode[],
      edges: p.edges as unknown as ETLEdge[],
      schedule: p.schedule as any,
      status: p.status as any,
    }));
  }

  /**
   * Get a single pipeline
   */
  async getPipeline(pipelineId: string, workspaceId: string): Promise<ETLPipelineConfig> {
    const pipeline = await this.prisma.eTLPipeline.findFirst({
      where: { id: pipelineId, workspaceId },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description || undefined,
      nodes: pipeline.nodes as unknown as ETLNode[],
      edges: pipeline.edges as unknown as ETLEdge[],
      schedule: pipeline.schedule as any,
      status: pipeline.status as any,
    };
  }

  /**
   * Update a pipeline
   */
  async updatePipeline(
    pipelineId: string,
    workspaceId: string,
    data: Partial<{
      name: string;
      description: string;
      nodes: ETLNode[];
      edges: ETLEdge[];
      schedule: { cron: string; timezone: string; enabled: boolean };
      status: 'draft' | 'active' | 'paused';
    }>,
  ): Promise<ETLPipelineConfig> {
    const pipeline = await this.prisma.eTLPipeline.findFirst({
      where: { id: pipelineId, workspaceId },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    if (data.nodes && data.edges) {
      this.validatePipeline(data.nodes, data.edges);
    }

    const updated = await this.prisma.eTLPipeline.update({
      where: { id: pipelineId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.nodes && { nodes: data.nodes as any }),
        ...(data.edges && { edges: data.edges as any }),
        ...(data.schedule !== undefined && { schedule: data.schedule as any }),
        ...(data.status && { status: data.status }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description || undefined,
      nodes: updated.nodes as unknown as ETLNode[],
      edges: updated.edges as unknown as ETLEdge[],
      schedule: updated.schedule as any,
      status: updated.status as any,
    };
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(pipelineId: string, workspaceId: string): Promise<ETLExecution> {
    const pipeline = await this.getPipeline(pipelineId, workspaceId);

    const execution: ETLExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pipelineId,
      status: 'running',
      startedAt: new Date(),
      rowsProcessed: 0,
      errors: [],
      nodeStats: {},
    };

    this.runningExecutions.set(execution.id, execution);

    // Run in background
    this.runPipeline(pipeline, execution).catch((error) => {
      this.logger.error(`Pipeline execution failed: ${error.message}`, error.stack);
      execution.status = 'failed';
      execution.errors.push(error.message);
      execution.completedAt = new Date();
    });

    return execution;
  }

  /**
   * Run pipeline execution
   */
  private async runPipeline(pipeline: ETLPipelineConfig, execution: ETLExecution): Promise<void> {
    const nodeOutputs = new Map<string, any[]>();

    // Sort nodes topologically
    const sortedNodes = this.topologicalSort(pipeline.nodes, pipeline.edges);

    for (const node of sortedNodes) {
      const startTime = Date.now();

      try {
        // Get input data from predecessor nodes
        const inputData = this.getNodeInput(node.id, pipeline.edges, nodeOutputs);

        // Process node
        const output = await this.processNode(node, inputData);
        nodeOutputs.set(node.id, output.data);

        // Update stats
        execution.nodeStats[node.id] = {
          processed: output.metadata.inputRows,
          errors: output.metadata.errors.length,
          duration: Date.now() - startTime,
        };
        execution.rowsProcessed += output.metadata.outputRows;

        if (output.metadata.errors.length > 0) {
          execution.errors.push(...output.metadata.errors.map((e) => `${node.name}: ${e}`));
        }

        this.eventEmitter.emit('etl.node.complete', {
          executionId: execution.id,
          nodeId: node.id,
          stats: execution.nodeStats[node.id],
        });
      } catch (error) {
        execution.nodeStats[node.id] = {
          processed: 0,
          errors: 1,
          duration: Date.now() - startTime,
        };
        execution.errors.push(`${node.name}: ${error.message}`);
        throw error;
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();

    // Save execution record
    await this.prisma.eTLExecution.create({
      data: {
        pipelineId: pipeline.id,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        rowsProcessed: execution.rowsProcessed,
        errors: execution.errors,
        nodeStats: execution.nodeStats,
      },
    });

    this.eventEmitter.emit('etl.pipeline.complete', execution);
  }

  /**
   * Topological sort of nodes
   */
  private topologicalSort(nodes: ETLNode[], edges: ETLEdge[]): ETLNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      adjacency.get(edge.source).push(edge.target);
    }

    const queue = nodes.filter((n) => inDegree.get(n.id) === 0);
    const result: ETLNode[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node);

      for (const neighbor of adjacency.get(node.id) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(nodeMap.get(neighbor));
        }
      }
    }

    return result;
  }

  /**
   * Get input data for a node from its predecessors
   */
  private getNodeInput(nodeId: string, edges: ETLEdge[], outputs: Map<string, any[]>): any[] {
    const incomingEdges = edges.filter((e) => e.target === nodeId);

    if (incomingEdges.length === 0) {
      return [];
    }

    if (incomingEdges.length === 1) {
      return outputs.get(incomingEdges[0].source) || [];
    }

    // Multiple inputs - concatenate
    return incomingEdges.flatMap((e) => outputs.get(e.source) || []);
  }

  /**
   * Process a single node
   */
  private async processNode(node: ETLNode, inputData: any[]): Promise<TransformationResult> {
    switch (node.type) {
      case 'source':
        return this.processSourceNode(node);
      case 'transform':
        return this.processTransformNode(node, inputData);
      case 'filter':
        return this.processFilterNode(node, inputData);
      case 'aggregate':
        return this.processAggregateNode(node, inputData);
      case 'join':
        return this.processJoinNode(node, inputData);
      case 'destination':
        return this.processDestinationNode(node, inputData);
      default:
        throw new Error(`Unknown node type: ${String(node.type)}`);
    }
  }

  /**
   * Process source node - fetch data from source
   */
  private async processSourceNode(node: ETLNode): Promise<TransformationResult> {
    const config = node.config;
    let data: any[] = [];

    switch (config.sourceType) {
      case 'database':
        // Would connect to database and execute query
        data = await this.fetchFromDatabase(config);
        break;
      case 'api':
        // Would fetch from API
        data = await this.fetchFromAPI(config);
        break;
      case 'file':
        // Would read from file
        data = await this.readFromFile(config);
        break;
      case 'integration':
        // Would use integration service
        data = await this.fetchFromIntegration(config);
        break;
      default:
        throw new Error(`Unknown source type: ${config.sourceType}`);
    }

    return {
      data,
      metadata: {
        inputRows: 0,
        outputRows: data.length,
        droppedRows: 0,
        errors: [],
      },
    };
  }

  /**
   * Process transform node - apply transformations
   */
  private async processTransformNode(
    node: ETLNode,
    inputData: any[],
  ): Promise<TransformationResult> {
    const config = node.config;
    const errors: string[] = [];
    const transformedData: any[] = [];

    for (let i = 0; i < inputData.length; i++) {
      try {
        const row = { ...inputData[i] };

        // Apply transformations
        for (const transform of config.transformations || []) {
          switch (transform.type) {
            case 'rename':
              row[transform.newName] = row[transform.field];
              delete row[transform.field];
              break;
            case 'map':
              row[transform.field] = this.evaluateExpression(transform.expression, row);
              break;
            case 'convert':
              row[transform.field] = this.convertType(row[transform.field], transform.toType);
              break;
            case 'extract':
              row[transform.targetField] = this.extractValue(
                row[transform.field],
                transform.pattern,
              );
              break;
            case 'concatenate':
              row[transform.targetField] = transform.fields
                .map((f: string) => row[f])
                .join(transform.separator || '');
              break;
            case 'split': {
              const parts = String(row[transform.field]).split(transform.separator);
              transform.targetFields.forEach((f: string, idx: number) => {
                row[f] = parts[idx];
              });
              break;
            }
          }
        }

        transformedData.push(row);
      } catch (error) {
        errors.push(`Row ${i}: ${error.message}`);
      }
    }

    return {
      data: transformedData,
      metadata: {
        inputRows: inputData.length,
        outputRows: transformedData.length,
        droppedRows: inputData.length - transformedData.length,
        errors,
      },
    };
  }

  /**
   * Process filter node - filter rows
   */
  private async processFilterNode(node: ETLNode, inputData: any[]): Promise<TransformationResult> {
    const config = node.config;
    const filteredData = inputData.filter((row) => {
      return config.conditions.every((condition: any) => {
        const value = row[condition.field];

        switch (condition.operator) {
          case 'eq':
            return value === condition.value;
          case 'neq':
            return value !== condition.value;
          case 'gt':
            return value > condition.value;
          case 'gte':
            return value >= condition.value;
          case 'lt':
            return value < condition.value;
          case 'lte':
            return value <= condition.value;
          case 'contains':
            return String(value).includes(condition.value);
          case 'startsWith':
            return String(value).startsWith(condition.value);
          case 'endsWith':
            return String(value).endsWith(condition.value);
          case 'isNull':
            return value === null || value === undefined;
          case 'isNotNull':
            return value !== null && value !== undefined;
          case 'in':
            return condition.value.includes(value);
          default:
            return true;
        }
      });
    });

    return {
      data: filteredData,
      metadata: {
        inputRows: inputData.length,
        outputRows: filteredData.length,
        droppedRows: inputData.length - filteredData.length,
        errors: [],
      },
    };
  }

  /**
   * Process aggregate node - group and aggregate
   */
  private async processAggregateNode(
    node: ETLNode,
    inputData: any[],
  ): Promise<TransformationResult> {
    const config = node.config;
    const groups = new Map<string, any[]>();

    // Group by specified fields
    for (const row of inputData) {
      const key = config.groupBy.map((f: string) => row[f]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(row);
    }

    // Aggregate each group
    const aggregatedData = Array.from(groups.entries()).map(([_, rows]) => {
      const result: Record<string, any> = {};

      // Add group by fields
      config.groupBy.forEach((field: string) => {
        result[field] = rows[0][field];
      });

      // Apply aggregations
      for (const agg of config.aggregations) {
        const values = rows.map((r) => r[agg.field]).filter((v) => v !== null && v !== undefined);

        switch (agg.operation) {
          case 'sum':
            result[agg.alias || `${agg.field}_sum`] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[agg.alias || `${agg.field}_avg`] =
              values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            result[agg.alias || `${agg.field}_min`] = Math.min(...values);
            break;
          case 'max':
            result[agg.alias || `${agg.field}_max`] = Math.max(...values);
            break;
          case 'count':
            result[agg.alias || `${agg.field}_count`] = values.length;
            break;
          case 'countDistinct':
            result[agg.alias || `${agg.field}_distinct`] = new Set(values).size;
            break;
          case 'first':
            result[agg.alias || `${agg.field}_first`] = values[0];
            break;
          case 'last':
            result[agg.alias || `${agg.field}_last`] = values[values.length - 1];
            break;
        }
      }

      return result;
    });

    return {
      data: aggregatedData,
      metadata: {
        inputRows: inputData.length,
        outputRows: aggregatedData.length,
        droppedRows: 0,
        errors: [],
      },
    };
  }

  /**
   * Process join node - join datasets
   */
  private async processJoinNode(node: ETLNode, inputData: any[]): Promise<TransformationResult> {
    // For simplicity, this expects concatenated input with a marker
    // In practice, you'd need separate inputs
    // const config = node.config;

    return {
      data: inputData,
      metadata: {
        inputRows: inputData.length,
        outputRows: inputData.length,
        droppedRows: 0,
        errors: [],
      },
    };
  }

  /**
   * Process destination node - write data
   */
  private async processDestinationNode(
    node: ETLNode,
    inputData: any[],
  ): Promise<TransformationResult> {
    const config = node.config;

    switch (config.destinationType) {
      case 'database':
        await this.writeToDatabase(config, inputData);
        break;
      case 'api':
        await this.writeToAPI(config, inputData);
        break;
      case 'file':
        await this.writeToFile(config, inputData);
        break;
      case 'warehouse':
        await this.writeToWarehouse(config, inputData);
        break;
    }

    return {
      data: inputData,
      metadata: {
        inputRows: inputData.length,
        outputRows: inputData.length,
        droppedRows: 0,
        errors: [],
      },
    };
  }

  // Helper methods (stubs - would be fully implemented in production)
  private async fetchFromDatabase(_config: any): Promise<any[]> {
    // Execute SQL query and return results
    return [];
  }

  private async fetchFromAPI(_config: any): Promise<any[]> {
    // Fetch from API endpoint
    return [];
  }

  private async readFromFile(_config: any): Promise<any[]> {
    // Read from file (CSV, JSON, Parquet, etc.)
    return [];
  }

  private async fetchFromIntegration(_config: any): Promise<any[]> {
    // Use integration service to fetch data
    return [];
  }

  private async writeToDatabase(_config: any, _data: any[]): Promise<void> {
    // Write to database
  }

  private async writeToAPI(_config: any, _data: any[]): Promise<void> {
    // POST to API
  }

  private async writeToFile(_config: any, _data: any[]): Promise<void> {
    // Write to file
  }

  private async writeToWarehouse(_config: any, _data: any[]): Promise<void> {
    // Write to data warehouse (Snowflake, BigQuery, etc.)
  }

  private evaluateExpression(expression: string, row: any): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('row', `with(row) { return ${expression}; }`);
      return fn(row);
    } catch {
      return null;
    }
  }

  private convertType(value: any, toType: string): any {
    switch (toType) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }

  private extractValue(value: string, pattern: string): string | null {
    const match = new RegExp(pattern).exec(value);
    return match ? match[1] || match[0] : null;
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): ETLExecution | undefined {
    return this.runningExecutions.get(executionId);
  }

  /**
   * Get execution history for a pipeline
   */
  async getExecutionHistory(pipelineId: string, limit = 10): Promise<ETLExecution[]> {
    const executions = await this.prisma.eTLExecution.findMany({
      where: { pipelineId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return executions.map((e) => ({
      id: e.id,
      pipelineId: e.pipelineId,
      status: e.status as any,
      startedAt: e.startedAt,
      completedAt: e.completedAt || undefined,
      rowsProcessed: e.rowsProcessed,
      errors: e.errors,
      nodeStats: e.nodeStats as any,
    }));
  }

  /**
   * Check scheduled pipelines and execute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledPipelines(): Promise<void> {
    const pipelines = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "etl_pipelines" 
      WHERE status = 'active' 
      AND schedule IS NOT NULL
    `;

    const pipelineIds = pipelines.map((p) => p.id);

    const fullPipelines = await this.prisma.eTLPipeline.findMany({
      where: {
        id: { in: pipelineIds },
      },
    });

    for (const pipeline of fullPipelines) {
      const schedule = pipeline.schedule as any;
      if (!schedule?.enabled) continue;

      // Check if pipeline should run (simplified - use cron-parser in production)
      // This is a placeholder - real implementation would parse cron expression
      const shouldRun = this.shouldRunSchedule(schedule.cron);

      if (shouldRun) {
        this.logger.log(`Executing scheduled pipeline: ${pipeline.name}`);
        await this.executePipeline(pipeline.id, pipeline.workspaceId);
      }
    }
  }

  private shouldRunSchedule(_cron: string): boolean {
    // Simplified - in production use cron-parser library
    return false;
  }
}
