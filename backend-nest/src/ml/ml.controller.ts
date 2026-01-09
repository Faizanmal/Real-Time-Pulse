import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { MLModelService } from './ml-model.service';
import { CausalInferenceService } from './causal-inference.service';

@Controller('ml')
export class MLController {
  constructor(
    private readonly mlService: MLModelService,
    private readonly causalService: CausalInferenceService,
  ) {}

  // ML Model Endpoints
  @Get('models')
  async getModels() {
    return this.mlService.getModels();
  }

  @Get('models/:id')
  async getModel(@Param('id') id: string) {
    return this.mlService.getModel(id);
  }

  @Post('models')
  async createModel(
    @Body()
    body: {
      name: string;
      type:
        | 'classification'
        | 'regression'
        | 'clustering'
        | 'timeseries'
        | 'anomaly'
        | 'nlp';
      framework: 'sklearn' | 'tensorflow' | 'pytorch' | 'xgboost' | 'custom';
      features: string[];
      target?: string;
    },
  ) {
    return this.mlService.createModel(body);
  }

  @Delete('models/:id')
  async deleteModel(@Param('id') id: string) {
    await this.mlService.deleteModel(id);
    return { success: true };
  }

  @Post('models/:id/train')
  async trainModel(
    @Param('id') id: string,
    @Body()
    body: {
      data: any[];
      config: {
        algorithm: string;
        hyperparameters?: Record<string, any>;
        validationSplit?: number;
        automl?: boolean;
      };
    },
  ) {
    return this.mlService.trainModel(id, body.data, body.config);
  }

  @Post('models/:id/predict')
  async predict(
    @Param('id') id: string,
    @Body()
    body: {
      features: Record<string, any>;
      options?: {
        explain?: boolean;
        threshold?: number;
      };
    },
  ) {
    return this.mlService.predict({
      modelId: id,
      features: body.features,
      options: body.options,
    });
  }

  @Post('models/:id/batch-predict')
  async batchPredict(
    @Param('id') id: string,
    @Body()
    body: {
      data: Record<string, any>[];
    },
  ) {
    return this.mlService.batchPredict(id, body.data);
  }

  @Post('features/analyze')
  async analyzeFeatures(@Body() body: { data: any[]; targetColumn: string }) {
    return this.mlService.analyzeFeatures(body.data, body.targetColumn);
  }

  // Causal Inference Endpoints
  @Get('causal/graphs')
  async getCausalGraphs() {
    return this.causalService.getCausalGraphs();
  }

  @Get('causal/graphs/:id')
  async getCausalGraph(@Param('id') id: string) {
    return this.causalService.getCausalGraph(id);
  }

  @Post('causal/graphs')
  async createCausalGraph(
    @Body() body: { name: string; variables: any[]; edges: any[] },
  ) {
    return this.causalService.createCausalGraph(body);
  }

  @Put('causal/graphs/:id')
  async updateCausalGraph(@Param('id') id: string, @Body() updates: any) {
    return this.causalService.updateCausalGraph(id, updates);
  }

  @Delete('causal/graphs/:id')
  async deleteCausalGraph(@Param('id') id: string) {
    await this.causalService.deleteCausalGraph(id);
    return { success: true };
  }

  @Post('causal/estimate')
  async estimateCausalEffect(
    @Body()
    body: {
      graphId: string;
      data: any[];
      treatment: string;
      outcome: string;
      estimand?: 'ate' | 'att' | 'atc' | 'cate';
      method?: string;
      confounders?: string[];
    },
  ) {
    return this.causalService.estimateCausalEffect(body.data, {
      graphId: body.graphId,
      treatment: body.treatment,
      outcome: body.outcome,
      estimand: body.estimand,
      method: body.method as any,
      confounders: body.confounders,
    });
  }

  @Post('causal/counterfactual')
  async computeCounterfactual(
    @Body()
    body: {
      graphId: string;
      data: any[];
      observation: Record<string, any>;
      intervention: Record<string, any>;
      outcomeVariable: string;
    },
  ) {
    return this.causalService.computeCounterfactual(body.data, {
      graphId: body.graphId,
      observation: body.observation,
      intervention: body.intervention,
      outcomeVariable: body.outcomeVariable,
    });
  }

  @Post('causal/ab-test')
  async analyzeABTest(
    @Body()
    body: {
      testId: string;
      treatmentData: any[];
      controlData: any[];
      metric: string;
      alpha?: number;
      method?: 'ttest' | 'bayesian' | 'cuped';
    },
  ) {
    return this.causalService.analyzeABTest(body);
  }

  @Post('causal/sensitivity')
  async performSensitivityAnalysis(
    @Body()
    body: {
      graphId: string;
      data: any[];
      treatment: string;
      outcome: string;
      unmeasuredConfoundingStrength: number[];
    },
  ) {
    return this.causalService.performSensitivityAnalysis(body.data, {
      graphId: body.graphId,
      treatment: body.treatment,
      outcome: body.outcome,
      unmeasuredConfoundingStrength: body.unmeasuredConfoundingStrength,
    });
  }

  @Post('causal/mediation')
  async performMediationAnalysis(
    @Body()
    body: {
      data: any[];
      treatment: string;
      mediator: string;
      outcome: string;
    },
  ) {
    return this.causalService.performMediationAnalysis(body.data, {
      treatment: body.treatment,
      mediator: body.mediator,
      outcome: body.outcome,
    });
  }
}
