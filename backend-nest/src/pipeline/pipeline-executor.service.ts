import { Injectable, Logger } from '@nestjs/common';
import { Pipeline, PipelineNode, PipelineEdge } from './pipeline.service';
import { PipelineConnectorService } from './pipeline-connector.service';

interface ExecutionContext {
  data: Map<string, any[]>;
  errors: string[];
  stats: {
    rowsProcessed: number;
    rowsFiltered: number;
    rowsOutput: number;
    startTime: number;
    endTime?: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  stats: ExecutionContext['stats'];
  errors: string[];
  outputData?: any[];
}

@Injectable()
export class PipelineExecutorService {
  private readonly logger = new Logger(PipelineExecutorService.name);

  constructor(private readonly connectorService: PipelineConnectorService) {}

  /**
   * Execute a pipeline
   */
  async execute(
    pipeline: Pipeline,
    options?: { dryRun?: boolean },
  ): Promise<ExecutionResult> {
    const context: ExecutionContext = {
      data: new Map(),
      errors: [],
      stats: {
        rowsProcessed: 0,
        rowsFiltered: 0,
        rowsOutput: 0,
        startTime: Date.now(),
      },
    };

    try {
      // Build execution order (topological sort)
      const executionOrder = this.buildExecutionOrder(
        pipeline.nodes,
        pipeline.edges,
      );

      this.logger.log(
        `Executing pipeline ${pipeline.id} with ${executionOrder.length} nodes`,
      );

      // Execute nodes in order
      for (const nodeId of executionOrder) {
        const node = pipeline.nodes.find((n) => n.id === nodeId)!;
        await this.executeNode(node, pipeline.edges, context, options?.dryRun);
      }

      context.stats.endTime = Date.now();

      return {
        success: context.errors.length === 0,
        stats: context.stats,
        errors: context.errors,
        outputData: Array.from(context.data.values()).flat(),
      };
    } catch (error: any) {
      context.stats.endTime = Date.now();
      context.errors.push(error.message);

      return {
        success: false,
        stats: context.stats,
        errors: context.errors,
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: PipelineNode,
    edges: PipelineEdge[],
    context: ExecutionContext,
    dryRun?: boolean,
  ): Promise<void> {
    this.logger.debug(`Executing node: ${node.id} (${node.type})`);

    // Get input data from connected nodes
    const inputEdges = edges.filter((e) => e.target === node.id);
    const inputData: any[] = [];

    for (const edge of inputEdges) {
      const sourceData = context.data.get(edge.source);
      if (sourceData) {
        inputData.push(...sourceData);
      }
    }

    let outputData: any[] = [];

    switch (node.type) {
      case 'source':
        outputData = await this.executeSourceNode(node, dryRun);
        break;

      case 'transform':
        outputData = await this.executeTransformNode(node, inputData);
        break;

      case 'filter':
        outputData = await this.executeFilterNode(node, inputData, context);
        break;

      case 'join':
        outputData = await this.executeJoinNode(node, edges, context);
        break;

      case 'aggregate':
        outputData = await this.executeAggregateNode(node, inputData);
        break;

      case 'destination':
        await this.executeDestinationNode(node, inputData, dryRun);
        outputData = inputData;
        context.stats.rowsOutput += inputData.length;
        break;
    }

    context.data.set(node.id, outputData);
    context.stats.rowsProcessed += outputData.length;
  }

  /**
   * Execute source node
   */
  private async executeSourceNode(
    node: PipelineNode,
    dryRun?: boolean,
  ): Promise<any[]> {
    const { connectorType, ...config } = node.config;

    if (dryRun) {
      // Return sample data for dry run
      return this.connectorService.getSampleData(connectorType, config);
    }

    return this.connectorService.fetchData(connectorType, config);
  }

  /**
   * Execute transform node
   */
  private async executeTransformNode(
    node: PipelineNode,
    inputData: any[],
  ): Promise<any[]> {
    const { transformType, ...config } = node.config;

    switch (transformType) {
      case 'map':
        return this.applyMapTransform(inputData, config);

      case 'rename':
        return this.applyRenameTransform(inputData, config);

      case 'select':
        return this.applySelectTransform(inputData, config);

      case 'derive':
        return this.applyDeriveTransform(inputData, config);

      case 'sort':
        return this.applySortTransform(inputData, config);

      case 'deduplicate':
        return this.applyDeduplicateTransform(inputData, config);

      case 'flatten':
        return this.applyFlattenTransform(inputData, config);

      case 'typecast':
        return this.applyTypecastTransform(inputData, config);

      default:
        return inputData;
    }
  }

  /**
   * Execute filter node
   */
  private async executeFilterNode(
    node: PipelineNode,
    inputData: any[],
    context: ExecutionContext,
  ): Promise<any[]> {
    const { conditions, logic = 'and' } = node.config;

    const filtered = inputData.filter((row) => {
      const results = conditions.map((cond: any) =>
        this.evaluateCondition(row, cond),
      );

      if (logic === 'and') {
        return results.every(Boolean);
      } else {
        return results.some(Boolean);
      }
    });

    context.stats.rowsFiltered += inputData.length - filtered.length;

    return filtered;
  }

  /**
   * Execute join node
   */
  private async executeJoinNode(
    node: PipelineNode,
    edges: PipelineEdge[],
    context: ExecutionContext,
  ): Promise<any[]> {
    const { joinType = 'inner', leftKey, rightKey } = node.config;

    const inputEdges = edges.filter((e) => e.target === node.id);
    if (inputEdges.length < 2) {
      return [];
    }

    const leftData = context.data.get(inputEdges[0].source) || [];
    const rightData = context.data.get(inputEdges[1].source) || [];

    const result: any[] = [];

    switch (joinType) {
      case 'inner':
        for (const leftRow of leftData) {
          for (const rightRow of rightData) {
            if (leftRow[leftKey] === rightRow[rightKey]) {
              result.push({ ...leftRow, ...rightRow });
            }
          }
        }
        break;

      case 'left':
        for (const leftRow of leftData) {
          const matches = rightData.filter(
            (r) => r[rightKey] === leftRow[leftKey],
          );
          if (matches.length > 0) {
            for (const match of matches) {
              result.push({ ...leftRow, ...match });
            }
          } else {
            result.push(leftRow);
          }
        }
        break;

      case 'right':
        for (const rightRow of rightData) {
          const matches = leftData.filter(
            (l) => l[leftKey] === rightRow[rightKey],
          );
          if (matches.length > 0) {
            for (const match of matches) {
              result.push({ ...match, ...rightRow });
            }
          } else {
            result.push(rightRow);
          }
        }
        break;

      case 'full':
        const joinedRight = new Set<number>();
        for (const leftRow of leftData) {
          const matches = rightData
            .map((r, i) => ({ row: r, index: i }))
            .filter((r) => r.row[rightKey] === leftRow[leftKey]);

          if (matches.length > 0) {
            for (const match of matches) {
              result.push({ ...leftRow, ...match.row });
              joinedRight.add(match.index);
            }
          } else {
            result.push(leftRow);
          }
        }
        for (let i = 0; i < rightData.length; i++) {
          if (!joinedRight.has(i)) {
            result.push(rightData[i]);
          }
        }
        break;
    }

    return result;
  }

  /**
   * Execute aggregate node
   */
  private async executeAggregateNode(
    node: PipelineNode,
    inputData: any[],
  ): Promise<any[]> {
    const { groupBy, aggregations } = node.config;

    if (!groupBy || groupBy.length === 0) {
      // Aggregate all data
      const result: any = {};
      for (const agg of aggregations) {
        result[agg.outputField] = this.computeAggregation(inputData, agg);
      }
      return [result];
    }

    // Group by fields
    const groups = new Map<string, any[]>();

    for (const row of inputData) {
      const key = groupBy.map((field: string) => row[field]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    // Compute aggregations for each group
    const results: any[] = [];

    for (const [key, groupData] of groups) {
      const result: any = {};

      // Add group by fields
      const keyParts = key.split('|');
      groupBy.forEach((field: string, index: number) => {
        result[field] = keyParts[index];
      });

      // Compute aggregations
      for (const agg of aggregations) {
        result[agg.outputField] = this.computeAggregation(groupData, agg);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Execute destination node
   */
  private async executeDestinationNode(
    node: PipelineNode,
    inputData: any[],
    dryRun?: boolean,
  ): Promise<void> {
    const { connectorType, ...config } = node.config;

    if (dryRun) {
      this.logger.log(
        `[DRY RUN] Would write ${inputData.length} rows to ${connectorType}`,
      );
      return;
    }

    await this.connectorService.writeData(connectorType, config, inputData);
  }

  /**
   * Build execution order using topological sort
   */
  private buildExecutionOrder(
    nodes: PipelineNode[],
    edges: PipelineEdge[],
  ): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // Build adjacency list and in-degree count
    for (const edge of edges) {
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Find all nodes with no incoming edges
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes
    const order: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      order.push(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return order;
  }

  /**
   * Transform helpers
   */
  private applyMapTransform(data: any[], config: any): any[] {
    const { mappings } = config;
    return data.map((row) => {
      const newRow: any = {};
      for (const mapping of mappings) {
        if (mapping.expression) {
          newRow[mapping.target] = this.evaluateExpression(
            row,
            mapping.expression,
          );
        } else {
          newRow[mapping.target] = row[mapping.source];
        }
      }
      return newRow;
    });
  }

  private applyRenameTransform(data: any[], config: any): any[] {
    const { renames } = config;
    return data.map((row) => {
      const newRow = { ...row };
      for (const rename of renames) {
        if (rename.from in newRow) {
          newRow[rename.to] = newRow[rename.from];
          delete newRow[rename.from];
        }
      }
      return newRow;
    });
  }

  private applySelectTransform(data: any[], config: any): any[] {
    const { fields } = config;
    return data.map((row) => {
      const newRow: any = {};
      for (const field of fields) {
        if (field in row) {
          newRow[field] = row[field];
        }
      }
      return newRow;
    });
  }

  private applyDeriveTransform(data: any[], config: any): any[] {
    const { derivations } = config;
    return data.map((row) => {
      const newRow = { ...row };
      for (const derivation of derivations) {
        newRow[derivation.field] = this.evaluateExpression(
          row,
          derivation.expression,
        );
      }
      return newRow;
    });
  }

  private applySortTransform(data: any[], config: any): any[] {
    const { sortBy } = config;
    return [...data].sort((a, b) => {
      for (const sort of sortBy) {
        const aVal = a[sort.field];
        const bVal = b[sort.field];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private applyDeduplicateTransform(data: any[], config: any): any[] {
    const { keys } = config;
    const seen = new Set<string>();
    return data.filter((row) => {
      const key = keys.map((k: string) => row[k]).join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private applyFlattenTransform(data: any[], config: any): any[] {
    const { field, prefix = '' } = config;
    return data.flatMap((row) => {
      const nested = row[field];
      if (Array.isArray(nested)) {
        return nested.map((item) => ({
          ...row,
          [`${prefix}${field}`]: item,
        }));
      }
      return [row];
    });
  }

  private applyTypecastTransform(data: any[], config: any): any[] {
    const { casts } = config;
    return data.map((row) => {
      const newRow = { ...row };
      for (const cast of casts) {
        const value = newRow[cast.field];
        switch (cast.type) {
          case 'string':
            newRow[cast.field] = String(value);
            break;
          case 'number':
            newRow[cast.field] = Number(value);
            break;
          case 'boolean':
            newRow[cast.field] = Boolean(value);
            break;
          case 'date':
            newRow[cast.field] = new Date(value);
            break;
        }
      }
      return newRow;
    });
  }

  /**
   * Evaluate a filter condition
   */
  private evaluateCondition(row: any, condition: any): boolean {
    const value = row[condition.field];
    const compareValue = condition.value;

    switch (condition.operator) {
      case 'eq':
        return value === compareValue;
      case 'neq':
        return value !== compareValue;
      case 'gt':
        return value > compareValue;
      case 'gte':
        return value >= compareValue;
      case 'lt':
        return value < compareValue;
      case 'lte':
        return value <= compareValue;
      case 'contains':
        return String(value).includes(compareValue);
      case 'startsWith':
        return String(value).startsWith(compareValue);
      case 'endsWith':
        return String(value).endsWith(compareValue);
      case 'isNull':
        return value === null || value === undefined;
      case 'isNotNull':
        return value !== null && value !== undefined;
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(value);
      case 'notIn':
        return Array.isArray(compareValue) && !compareValue.includes(value);
      default:
        return true;
    }
  }

  /**
   * Evaluate a simple expression
   */
  private evaluateExpression(row: any, expression: string): any {
    // Simple field reference
    if (expression.startsWith('$')) {
      return row[expression.slice(1)];
    }

    // Simple arithmetic
    const match = expression.match(/^\$(\w+)\s*([\+\-\*\/])\s*(.+)$/);
    if (match) {
      const [, field, operator, operand] = match;
      const fieldValue = Number(row[field]);
      const operandValue = operand.startsWith('$')
        ? Number(row[operand.slice(1)])
        : Number(operand);

      switch (operator) {
        case '+':
          return fieldValue + operandValue;
        case '-':
          return fieldValue - operandValue;
        case '*':
          return fieldValue * operandValue;
        case '/':
          return operandValue !== 0 ? fieldValue / operandValue : 0;
      }
    }

    // Concatenation
    const concatMatch = expression.match(/^concat\((.+)\)$/);
    if (concatMatch) {
      const parts = concatMatch[1].split(',').map((p) => {
        const trimmed = p.trim();
        if (trimmed.startsWith('$')) {
          return row[trimmed.slice(1)];
        }
        return trimmed.replace(/['"]/g, '');
      });
      return parts.join('');
    }

    // Return expression as literal
    return expression;
  }

  /**
   * Compute aggregation
   */
  private computeAggregation(data: any[], agg: any): any {
    const values = data
      .map((row) => row[agg.field])
      .filter((v) => v !== undefined && v !== null);

    switch (agg.function) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((a, b) => Number(a) + Number(b), 0);
      case 'avg':
        return values.length > 0
          ? values.reduce((a, b) => Number(a) + Number(b), 0) / values.length
          : 0;
      case 'min':
        return Math.min(...values.map(Number));
      case 'max':
        return Math.max(...values.map(Number));
      case 'first':
        return values[0];
      case 'last':
        return values[values.length - 1];
      case 'countDistinct':
        return new Set(values).size;
      default:
        return null;
    }
  }
}
