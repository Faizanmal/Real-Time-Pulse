import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdvancedAiService } from './advanced-ai.service';
import { AIModelType, AIProvider } from '@prisma/client';

@Controller('advanced-ai')
@UseGuards(JwtAuthGuard)
export class AdvancedAiController {
  constructor(private readonly advancedAiService: AdvancedAiService) {}

  // AI Models
  @Get('models')
  async getModels(@Req() req: any, @Query('type') type?: AIModelType) {
    return this.advancedAiService.getModels(req.user.workspaceId, type);
  }

  @Get('models/:id')
  async getModel(@Param('id') id: string) {
    return this.advancedAiService.getModel(id);
  }

  @Post('models')
  async createModel(
    @Req() req: any,
    @Body()
    data: {
      name: string;
      description?: string;
      modelType: AIModelType;
      provider: AIProvider;
      modelId: string;
      config: any;
    },
  ) {
    return this.advancedAiService.createModel({
      ...data,
      workspaceId: req.user.workspaceId,
    });
  }

  @Patch('models/:id')
  async updateModel(@Param('id') id: string, @Body() data: any) {
    return this.advancedAiService.updateModel(id, data);
  }

  // Predictions
  @Post('predictions')
  async createPrediction(
    @Req() req: any,
    @Body()
    data: {
      modelId: string;
      inputData: any;
      widgetId?: string;
      portalId?: string;
    },
  ) {
    return this.advancedAiService.createPrediction({
      ...data,
      workspaceId: req.user.workspaceId,
    });
  }

  @Get('predictions')
  async getPredictions(
    @Req() req: any,
    @Query('modelId') modelId?: string,
    @Query('portalId') portalId?: string,
    @Query('widgetId') widgetId?: string,
  ) {
    return this.advancedAiService.getPredictions(req.user.workspaceId, {
      modelId,
      portalId,
      widgetId,
    });
  }

  // Natural Language Queries
  @Post('query')
  async processNaturalLanguageQuery(
    @Req() req: any,
    @Body()
    data: {
      query: string;
      portalId?: string;
    },
  ) {
    return this.advancedAiService.processNaturalLanguageQuery(
      req.user.workspaceId,
      req.user.id,
      data.query,
      data.portalId,
    );
  }

  @Post('sql-generation')
  async generateSQL(@Req() req: any, @Body() data: { query: string }) {
    return this.advancedAiService.generateSQLFromNaturalLanguage(
      req.user.workspaceId,
      req.user.id,
      data.query,
    );
  }

  @Get('queries')
  async getQueries(@Req() req: any) {
    return this.advancedAiService.getQueries(req.user.workspaceId, req.user.id);
  }

  // Forecasting
  @Post('forecast')
  async forecastTimeSeries(
    @Req() req: any,
    @Body()
    data: {
      widgetId: string;
      historicalData: Array<{ timestamp: Date; value: number }>;
      forecastPeriods: number;
    },
  ) {
    return this.advancedAiService.forecastTimeSeries(
      req.user.workspaceId,
      data,
    );
  }

  // Anomaly Detection
  @Post('anomalies')
  async detectAnomalies(
    @Req() req: any,
    @Body()
    data: {
      widgetId?: string;
      portalId?: string;
      timeSeries: Array<{ timestamp: Date; value: number }>;
    },
  ) {
    return this.advancedAiService.detectAnomalies(req.user.workspaceId, data);
  }

  // Recommendations
  @Get('recommendations/:portalId')
  async generateRecommendations(
    @Req() req: any,
    @Param('portalId') portalId: string,
  ) {
    return this.advancedAiService.generateRecommendations(
      req.user.workspaceId,
      portalId,
    );
  }
}
