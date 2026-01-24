import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MLMarketplaceService } from './ml-marketplace.service';

@ApiTags('ML Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ml')
export class MLMarketplaceController {
  constructor(private readonly mlService: MLMarketplaceService) {}

  @Get('models')
  @ApiOperation({ summary: 'Get available ML models' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isPremium', required: false })
  async getModels(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('isPremium') isPremium?: string,
  ) {
    return this.mlService.getModels({
      category,
      search,
      isPremium: isPremium ? isPremium === 'true' : undefined,
    });
  }

  @Get('models/:modelId')
  @ApiOperation({ summary: 'Get model details' })
  @ApiParam({ name: 'modelId', description: 'Model ID' })
  async getModel(@Param('modelId') modelId: string) {
    return this.mlService.getModel(modelId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get model categories' })
  getCategories() {
    return this.mlService.getCategories();
  }

  @Post('deployments')
  @ApiOperation({ summary: 'Deploy a model' })
  async deployModel(
    @Request() req: any,
    @Body()
    dto: { modelId: string; widgetId?: string; config?: Record<string, any> },
  ) {
    return this.mlService.deployModel(req.user.workspaceId, dto.modelId, dto);
  }

  @Get('deployments')
  @ApiOperation({ summary: 'Get workspace deployments' })
  async getDeployments(@Request() req: any) {
    return this.mlService.getDeployments(req.user.workspaceId);
  }

  @Post('deployments/:deploymentId/predict')
  @ApiOperation({ summary: 'Run prediction' })
  @ApiParam({ name: 'deploymentId', description: 'Deployment ID' })
  async predict(
    @Request() req: any,
    @Param('deploymentId') deploymentId: string,
    @Body() input: Record<string, any>,
  ) {
    return this.mlService.predict(req.user.workspaceId, deploymentId, input);
  }

  @Post('training')
  @ApiOperation({ summary: 'Start training job' })
  async startTraining(
    @Request() req: any,
    @Body()
    dto: {
      modelId: string;
      trainingData: { source: string; config: Record<string, any> };
      config?: Record<string, any>;
    },
  ) {
    return this.mlService.startTrainingJob(req.user.workspaceId, dto);
  }

  @Get('training')
  @ApiOperation({ summary: 'Get training jobs' })
  async getTrainingJobs(@Request() req: any) {
    return this.mlService.getTrainingJobs(req.user.workspaceId);
  }
}
