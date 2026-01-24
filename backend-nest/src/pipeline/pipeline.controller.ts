import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PipelineService } from './pipeline.service';
import type { CreatePipelineDto, UpdatePipelineDto } from './pipeline.service';
import { PipelineConnectorService, ConnectorType } from './pipeline-connector.service';
import type { ExecutionResult } from './pipeline-executor.service';
import type { AuthenticatedRequest } from '../common/interfaces/auth.interface';

@ApiTags('Data Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pipelines')
export class PipelineController {
  constructor(
    private readonly pipelineService: PipelineService,
    private readonly connectorService: PipelineConnectorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline' })
  async createPipeline(@Request() req: AuthenticatedRequest, @Body() dto: CreatePipelineDto) {
    return this.pipelineService.createPipeline(req.user.workspaceId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all pipelines' })
  async getPipelines(@Request() req: AuthenticatedRequest) {
    return this.pipelineService.getPipelines(req.user.workspaceId);
  }

  @Get('connectors')
  @ApiOperation({ summary: 'Get available connectors' })
  getConnectors() {
    return this.connectorService.getAvailableConnectors();
  }

  @Get(':pipelineId')
  @ApiOperation({ summary: 'Get a pipeline by ID' })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  async getPipeline(@Request() req: AuthenticatedRequest, @Param('pipelineId') pipelineId: string) {
    return this.pipelineService.getPipeline(req.user.workspaceId, pipelineId);
  }

  @Put(':pipelineId')
  @ApiOperation({ summary: 'Update a pipeline' })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  async updatePipeline(
    @Request() req: AuthenticatedRequest,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.pipelineService.updatePipeline(req.user.workspaceId, pipelineId, dto);
  }

  @Delete(':pipelineId')
  @ApiOperation({ summary: 'Delete a pipeline' })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  async deletePipeline(
    @Request() req: AuthenticatedRequest,
    @Param('pipelineId') pipelineId: string,
  ) {
    await this.pipelineService.deletePipeline(req.user.workspaceId, pipelineId);
    return { success: true };
  }

  @Post(':pipelineId/execute')
  @ApiOperation({ summary: 'Execute a pipeline' })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  async executePipeline(
    @Request() req: AuthenticatedRequest,
    @Param('pipelineId') pipelineId: string,
    @Query('dryRun') dryRun?: string,
  ): Promise<ExecutionResult> {
    return this.pipelineService.executePipeline(req.user.workspaceId, pipelineId, {
      dryRun: dryRun === 'true',
    });
  }

  @Get(':pipelineId/history')
  @ApiOperation({ summary: 'Get pipeline run history' })
  @ApiParam({ name: 'pipelineId', description: 'Pipeline ID' })
  async getRunHistory(@Request() req: any, @Param('pipelineId') pipelineId: string) {
    return this.pipelineService.getRunHistory(req.user.workspaceId, pipelineId);
  }

  @Post('connectors/test')
  @ApiOperation({ summary: 'Test a connector configuration' })
  async testConnector(@Body() dto: { connectorType: ConnectorType; config: Record<string, any> }) {
    return this.connectorService.testConnection(dto.connectorType, dto.config);
  }
}
