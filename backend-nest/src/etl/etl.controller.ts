import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ETLPipelineService, ETLNode, ETLEdge } from './etl-pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface CreatePipelineDto {
  name: string;
  description?: string;
  nodes: ETLNode[];
  edges: ETLEdge[];
  schedule?: {
    cron: string;
    timezone: string;
    enabled: boolean;
  };
}

interface UpdatePipelineDto {
  name?: string;
  description?: string;
  nodes?: ETLNode[];
  edges?: ETLEdge[];
  schedule?: {
    cron: string;
    timezone: string;
    enabled: boolean;
  };
  status?: 'draft' | 'active' | 'paused';
}

@Controller('etl')
@UseGuards(JwtAuthGuard)
export class ETLController {
  constructor(private readonly etlService: ETLPipelineService) {}

  /**
   * Create a new ETL pipeline
   */
  @Post('pipelines')
  async createPipeline(@Body() dto: CreatePipelineDto, @Req() req: any) {
    return this.etlService.createPipeline(req.user.workspaceId, dto);
  }

  /**
   * Get all pipelines
   */
  @Get('pipelines')
  async getPipelines(@Req() req: any) {
    return this.etlService.getPipelines(req.user.workspaceId);
  }

  /**
   * Get a single pipeline
   */
  @Get('pipelines/:id')
  async getPipeline(@Param('id') id: string, @Req() req: any) {
    return this.etlService.getPipeline(id, req.user.workspaceId);
  }

  /**
   * Update a pipeline
   */
  @Put('pipelines/:id')
  async updatePipeline(@Param('id') id: string, @Body() dto: UpdatePipelineDto, @Req() req: any) {
    return this.etlService.updatePipeline(id, req.user.workspaceId, dto);
  }

  /**
   * Execute a pipeline
   */
  @Post('pipelines/:id/execute')
  async executePipeline(@Param('id') id: string, @Req() req: any) {
    return this.etlService.executePipeline(id, req.user.workspaceId);
  }

  /**
   * Get execution status
   */
  @Get('executions/:id')
  async getExecutionStatus(@Param('id') id: string) {
    return this.etlService.getExecutionStatus(id);
  }

  /**
   * Get execution history for a pipeline
   */
  @Get('pipelines/:id/history')
  async getExecutionHistory(@Param('id') id: string, @Query('limit') limit: string) {
    return this.etlService.getExecutionHistory(id, parseInt(limit, 10) || 10);
  }

  /**
   * Get available node types
   */
  @Get('node-types')
  getNodeTypes() {
    return {
      sources: [
        {
          type: 'database',
          label: 'Database',
          description: 'Connect to SQL databases',
          config: ['connectionString', 'query'],
        },
        {
          type: 'api',
          label: 'REST API',
          description: 'Fetch data from APIs',
          config: ['url', 'method', 'headers', 'body'],
        },
        {
          type: 'file',
          label: 'File',
          description: 'Read from CSV, JSON, Parquet files',
          config: ['path', 'format', 'delimiter'],
        },
        {
          type: 'integration',
          label: 'Integration',
          description: 'Use connected integrations',
          config: ['integrationId', 'dataType'],
        },
      ],
      transforms: [
        {
          type: 'rename',
          label: 'Rename Field',
          description: 'Rename a field',
          config: ['field', 'newName'],
        },
        {
          type: 'map',
          label: 'Map Expression',
          description: 'Apply expression to field',
          config: ['field', 'expression'],
        },
        {
          type: 'convert',
          label: 'Type Convert',
          description: 'Convert field type',
          config: ['field', 'toType'],
        },
        {
          type: 'extract',
          label: 'Extract Pattern',
          description: 'Extract using regex',
          config: ['field', 'pattern', 'targetField'],
        },
        {
          type: 'concatenate',
          label: 'Concatenate',
          description: 'Join multiple fields',
          config: ['fields', 'separator', 'targetField'],
        },
        {
          type: 'split',
          label: 'Split',
          description: 'Split field into multiple',
          config: ['field', 'separator', 'targetFields'],
        },
      ],
      filters: [
        {
          operator: 'eq',
          label: 'Equals',
        },
        {
          operator: 'neq',
          label: 'Not Equals',
        },
        {
          operator: 'gt',
          label: 'Greater Than',
        },
        {
          operator: 'gte',
          label: 'Greater Than or Equal',
        },
        {
          operator: 'lt',
          label: 'Less Than',
        },
        {
          operator: 'lte',
          label: 'Less Than or Equal',
        },
        {
          operator: 'contains',
          label: 'Contains',
        },
        {
          operator: 'isNull',
          label: 'Is Null',
        },
        {
          operator: 'in',
          label: 'In List',
        },
      ],
      aggregations: [
        { operation: 'sum', label: 'Sum' },
        { operation: 'avg', label: 'Average' },
        { operation: 'min', label: 'Minimum' },
        { operation: 'max', label: 'Maximum' },
        { operation: 'count', label: 'Count' },
        { operation: 'countDistinct', label: 'Count Distinct' },
        { operation: 'first', label: 'First' },
        { operation: 'last', label: 'Last' },
      ],
      destinations: [
        {
          type: 'database',
          label: 'Database',
          description: 'Write to SQL database',
          config: ['connectionString', 'table', 'mode'],
        },
        {
          type: 'warehouse',
          label: 'Data Warehouse',
          description: 'Write to Snowflake, BigQuery, Redshift',
          config: ['warehouse', 'schema', 'table'],
        },
        {
          type: 'api',
          label: 'REST API',
          description: 'POST data to API',
          config: ['url', 'method', 'headers', 'batchSize'],
        },
        {
          type: 'file',
          label: 'File',
          description: 'Write to CSV, JSON, Parquet',
          config: ['path', 'format'],
        },
      ],
    };
  }
}
