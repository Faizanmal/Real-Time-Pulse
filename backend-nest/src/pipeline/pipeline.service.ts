import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PipelineExecutorService } from './pipeline-executor.service';
import type { ExecutionResult } from './pipeline-executor.service';

export interface PipelineNode {
  id: string;
  type: 'source' | 'transform' | 'destination' | 'filter' | 'join' | 'aggregate';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Pipeline {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  schedule?: string;
  timezone?: string;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'failed' | 'running';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePipelineDto {
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  schedule?: string;
  timezone?: string;
}

export interface UpdatePipelineDto {
  name?: string;
  description?: string;
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
  schedule?: string;
  timezone?: string;
  isActive?: boolean;
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly executor: PipelineExecutorService,
  ) {}

  /**
   * Create a new pipeline
   */
  async createPipeline(
    workspaceId: string,
    userId: string,
    dto: CreatePipelineDto,
  ): Promise<Pipeline> {
    // Validate pipeline structure
    this.validatePipelineStructure(dto.nodes, dto.edges);

    const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const pipeline: Pipeline = {
      id: pipelineId,
      workspaceId,
      name: dto.name,
      description: dto.description,
      nodes: dto.nodes,
      edges: dto.edges,
      schedule: dto.schedule,
      timezone: dto.timezone || 'UTC',
      isActive: false,
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save pipeline
    await this.cache.set(
      `pipeline:${workspaceId}:${pipelineId}`,
      JSON.stringify(pipeline),
      86400 * 30,
    );

    // Add to index
    const index = await this.getPipelineIndex(workspaceId);
    index.push(pipelineId);
    await this.cache.set(`pipeline:index:${workspaceId}`, JSON.stringify(index), 86400 * 30);

    this.logger.log(`Pipeline created: ${pipelineId}`);

    return pipeline;
  }

  /**
   * Get all pipelines for a workspace
   */
  async getPipelines(workspaceId: string): Promise<Pipeline[]> {
    const index = await this.getPipelineIndex(workspaceId);

    const pipelines = await Promise.all(
      index.map(async (pipelineId) => {
        const json = await this.cache.get(`pipeline:${workspaceId}:${pipelineId}`);
        return json ? JSON.parse(json) : null;
      }),
    );

    return pipelines.filter(Boolean);
  }

  /**
   * Get a pipeline by ID
   */
  async getPipeline(workspaceId: string, pipelineId: string): Promise<Pipeline> {
    const json = await this.cache.get(`pipeline:${workspaceId}:${pipelineId}`);

    if (!json) {
      throw new NotFoundException('Pipeline not found');
    }

    return JSON.parse(json);
  }

  /**
   * Update a pipeline
   */
  async updatePipeline(
    workspaceId: string,
    pipelineId: string,
    dto: UpdatePipelineDto,
  ): Promise<Pipeline> {
    const pipeline = await this.getPipeline(workspaceId, pipelineId);

    if (dto.nodes && dto.edges) {
      this.validatePipelineStructure(dto.nodes, dto.edges);
    }

    const updatedPipeline: Pipeline = {
      ...pipeline,
      ...dto,
      updatedAt: new Date(),
    };

    await this.cache.set(
      `pipeline:${workspaceId}:${pipelineId}`,
      JSON.stringify(updatedPipeline),
      86400 * 30,
    );

    return updatedPipeline;
  }

  /**
   * Delete a pipeline
   */
  async deletePipeline(workspaceId: string, pipelineId: string): Promise<void> {
    await this.cache.del(`pipeline:${workspaceId}:${pipelineId}`);

    const index = await this.getPipelineIndex(workspaceId);
    const newIndex = index.filter((id) => id !== pipelineId);
    await this.cache.set(`pipeline:index:${workspaceId}`, JSON.stringify(newIndex), 86400 * 30);

    // Delete run history
    await this.cache.del(`pipeline:runs:${workspaceId}:${pipelineId}`);
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    workspaceId: string,
    pipelineId: string,
    options?: { dryRun?: boolean },
  ): Promise<ExecutionResult> {
    const pipeline = await this.getPipeline(workspaceId, pipelineId);

    // Update status
    pipeline.lastRunStatus = 'running';
    pipeline.lastRunAt = new Date();
    await this.cache.set(
      `pipeline:${workspaceId}:${pipelineId}`,
      JSON.stringify(pipeline),
      86400 * 30,
    );

    try {
      const result = await this.executor.execute(pipeline, options);

      // Update status
      pipeline.lastRunStatus = 'success';
      await this.cache.set(
        `pipeline:${workspaceId}:${pipelineId}`,
        JSON.stringify(pipeline),
        86400 * 30,
      );

      // Save run history
      await this.saveRunHistory(workspaceId, pipelineId, {
        runId: `run_${Date.now()}`,
        status: 'success',
        startedAt: pipeline.lastRunAt,
        completedAt: new Date(),
        result,
      });

      return result;
    } catch (error: any) {
      // Update status
      pipeline.lastRunStatus = 'failed';
      await this.cache.set(
        `pipeline:${workspaceId}:${pipelineId}`,
        JSON.stringify(pipeline),
        86400 * 30,
      );

      // Save run history
      await this.saveRunHistory(workspaceId, pipelineId, {
        runId: `run_${Date.now()}`,
        status: 'failed',
        startedAt: pipeline.lastRunAt,
        completedAt: new Date(),
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get pipeline run history
   */
  async getRunHistory(workspaceId: string, pipelineId: string) {
    const json = await this.cache.get(`pipeline:runs:${workspaceId}:${pipelineId}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Validate pipeline structure
   */
  private validatePipelineStructure(nodes: PipelineNode[], edges: PipelineEdge[]): void {
    if (!nodes || nodes.length === 0) {
      throw new BadRequestException('Pipeline must have at least one node');
    }

    // Check for source nodes
    const sourceNodes = nodes.filter((n) => n.type === 'source');
    if (sourceNodes.length === 0) {
      throw new BadRequestException('Pipeline must have at least one source node');
    }

    // Check for destination nodes
    const destinationNodes = nodes.filter((n) => n.type === 'destination');
    if (destinationNodes.length === 0) {
      throw new BadRequestException('Pipeline must have at least one destination node');
    }

    // Validate edges reference valid nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        throw new BadRequestException(`Edge references invalid source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new BadRequestException(`Edge references invalid target node: ${edge.target}`);
      }
    }

    // Check for cycles (simple check)
    const visited = new Set<string>();
    const checkCycle = (nodeId: string, path: Set<string>): boolean => {
      if (path.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      path.add(nodeId);

      const outgoingEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (checkCycle(edge.target, new Set(path))) {
          return true;
        }
      }

      return false;
    };

    for (const node of sourceNodes) {
      if (checkCycle(node.id, new Set())) {
        throw new BadRequestException('Pipeline contains a cycle');
      }
    }
  }

  /**
   * Helper: Get pipeline index
   */
  private async getPipelineIndex(workspaceId: string): Promise<string[]> {
    const json = await this.cache.get(`pipeline:index:${workspaceId}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Helper: Save run history
   */
  private async saveRunHistory(workspaceId: string, pipelineId: string, run: any): Promise<void> {
    const history = await this.getRunHistory(workspaceId, pipelineId);
    history.push(run);

    // Keep last 100 runs
    const trimmed = history.slice(-100);

    await this.cache.set(
      `pipeline:runs:${workspaceId}:${pipelineId}`,
      JSON.stringify(trimmed),
      86400 * 30,
    );
  }
}
