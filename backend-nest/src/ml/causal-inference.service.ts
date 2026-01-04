import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface CausalVariable {
  name: string;
  type: 'treatment' | 'outcome' | 'confounder' | 'mediator' | 'instrument';
  dataType: 'continuous' | 'binary' | 'categorical';
}

interface CausalGraph {
  id: string;
  name: string;
  variables: CausalVariable[];
  edges: { from: string; to: string; type: 'causal' | 'confounding' | 'mediation' }[];
}

interface CausalEffect {
  treatment: string;
  outcome: string;
  estimand: 'ate' | 'att' | 'atc' | 'cate';
  estimate: number;
  standardError: number;
  confidenceInterval: [number, number];
  pValue: number;
  method: string;
}

interface CounterfactualResult {
  originalOutcome: number;
  counterfactualOutcome: number;
  causalEffect: number;
  scenario: Record<string, any>;
}

interface ABTestAnalysis {
  testId: string;
  treatment: string;
  control: string;
  metric: string;
  sampleSize: { treatment: number; control: number };
  meanEffect: number;
  confidenceInterval: [number, number];
  pValue: number;
  isSignificant: boolean;
  power: number;
  requiredSampleSize?: number;
}

@Injectable()
export class CausalInferenceService {
  private readonly logger = new Logger(CausalInferenceService.name);
  private readonly graphs = new Map<string, CausalGraph>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // Causal Graph Management
  async createCausalGraph(config: Omit<CausalGraph, 'id'>): Promise<CausalGraph> {
    const id = `graph-${Date.now()}`;
    const graph: CausalGraph = { ...config, id };
    
    this.graphs.set(id, graph);
    this.logger.log(`Created causal graph: ${graph.name}`);
    
    return graph;
  }

  async getCausalGraphs(): Promise<CausalGraph[]> {
    return Array.from(this.graphs.values());
  }

  async getCausalGraph(id: string): Promise<CausalGraph | undefined> {
    return this.graphs.get(id);
  }

  async updateCausalGraph(id: string, updates: Partial<CausalGraph>): Promise<CausalGraph> {
    const graph = this.graphs.get(id);
    if (!graph) throw new Error(`Graph ${id} not found`);

    const updated = { ...graph, ...updates };
    this.graphs.set(id, updated);
    
    return updated;
  }

  async deleteCausalGraph(id: string): Promise<void> {
    this.graphs.delete(id);
  }

  // Causal Effect Estimation
  async estimateCausalEffect(
    data: any[],
    config: {
      graphId: string;
      treatment: string;
      outcome: string;
      estimand?: 'ate' | 'att' | 'atc' | 'cate';
      method?: 'propensity_score' | 'inverse_propensity' | 'doubly_robust' | 'instrumental_variable' | 'regression_discontinuity';
      confounders?: string[];
    }
  ): Promise<CausalEffect> {
    const graph = this.graphs.get(config.graphId);
    if (!graph) throw new Error(`Graph ${config.graphId} not found`);

    const method = config.method || 'doubly_robust';
    const estimand = config.estimand || 'ate';

    this.logger.log(`Estimating causal effect: ${config.treatment} -> ${config.outcome}`);

    // Identify confounders from graph if not specified
    const confounders = config.confounders || this.identifyConfounders(graph, config.treatment, config.outcome);

    // Execute causal estimation
    const result = await this.executeEstimation(data, {
      treatment: config.treatment,
      outcome: config.outcome,
      confounders,
      method,
      estimand,
    });

    this.eventEmitter.emit('causal.effect.estimated', {
      graphId: config.graphId,
      treatment: config.treatment,
      outcome: config.outcome,
      effect: result.estimate,
    });

    return result;
  }

  private identifyConfounders(graph: CausalGraph, treatment: string, outcome: string): string[] {
    // Simple backdoor criterion implementation
    const confounders = graph.variables
      .filter(v => v.type === 'confounder')
      .map(v => v.name);

    // Add common causes from graph edges
    const commonCauses = new Set<string>();
    
    for (const edge of graph.edges) {
      if (edge.to === treatment || edge.to === outcome) {
        const variable = graph.variables.find(v => v.name === edge.from);
        if (variable && variable.type !== 'mediator') {
          commonCauses.add(edge.from);
        }
      }
    }

    return [...new Set([...confounders, ...commonCauses])];
  }

  private async executeEstimation(data: any[], config: {
    treatment: string;
    outcome: string;
    confounders: string[];
    method: string;
    estimand: string;
  }): Promise<CausalEffect> {
    // In production, use actual causal inference library (DoWhy, CausalML, EconML)
    await this.simulateDelay(1000);

    const treatmentValues = data.map(d => d[config.treatment]);
    const outcomeValues = data.map(d => d[config.outcome]);

    // Calculate basic statistics
    const treated = data.filter(d => d[config.treatment] === 1 || d[config.treatment] === true);
    const control = data.filter(d => d[config.treatment] === 0 || d[config.treatment] === false);

    const treatedMean = this.mean(treated.map(d => d[config.outcome]));
    const controlMean = this.mean(control.map(d => d[config.outcome]));

    const naiveEffect = treatedMean - controlMean;
    
    // Simulate adjusted effect (would be properly computed in production)
    const adjustedEffect = naiveEffect * (0.8 + Math.random() * 0.4);
    const standardError = Math.abs(adjustedEffect) * 0.1 + Math.random() * 0.05;
    
    const ciWidth = 1.96 * standardError;
    const pValue = Math.exp(-Math.abs(adjustedEffect / standardError));

    return {
      treatment: config.treatment,
      outcome: config.outcome,
      estimand: config.estimand as any,
      estimate: adjustedEffect,
      standardError,
      confidenceInterval: [adjustedEffect - ciWidth, adjustedEffect + ciWidth],
      pValue,
      method: config.method,
    };
  }

  // Counterfactual Analysis
  async computeCounterfactual(
    data: any[],
    config: {
      graphId: string;
      observation: Record<string, any>;
      intervention: Record<string, any>;
      outcomeVariable: string;
    }
  ): Promise<CounterfactualResult> {
    const graph = this.graphs.get(config.graphId);
    if (!graph) throw new Error(`Graph ${config.graphId} not found`);

    this.logger.log(`Computing counterfactual for ${config.outcomeVariable}`);

    // In production, use structural causal model
    await this.simulateDelay(500);

    const originalOutcome = config.observation[config.outcomeVariable] || this.mean(data.map(d => d[config.outcomeVariable]));
    
    // Simulate counterfactual outcome
    let counterfactualOutcome = originalOutcome;
    for (const [variable, value] of Object.entries(config.intervention)) {
      const originalValue = config.observation[variable];
      const effect = (value - originalValue) * (0.3 + Math.random() * 0.4);
      counterfactualOutcome += effect;
    }

    return {
      originalOutcome,
      counterfactualOutcome,
      causalEffect: counterfactualOutcome - originalOutcome,
      scenario: config.intervention,
    };
  }

  // A/B Test Analysis with Causal Inference
  async analyzeABTest(config: {
    testId: string;
    treatmentData: any[];
    controlData: any[];
    metric: string;
    alpha?: number;
    method?: 'ttest' | 'bayesian' | 'cuped';
  }): Promise<ABTestAnalysis> {
    const alpha = config.alpha || 0.05;
    
    const treatmentValues = config.treatmentData.map(d => d[config.metric]);
    const controlValues = config.controlData.map(d => d[config.metric]);

    const treatmentMean = this.mean(treatmentValues);
    const controlMean = this.mean(controlValues);
    const treatmentStd = this.std(treatmentValues);
    const controlStd = this.std(controlValues);

    const meanEffect = treatmentMean - controlMean;
    
    // Pooled standard error
    const n1 = treatmentValues.length;
    const n2 = controlValues.length;
    const pooledSE = Math.sqrt((treatmentStd ** 2 / n1) + (controlStd ** 2 / n2));
    
    // t-statistic and p-value
    const tStat = meanEffect / pooledSE;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));
    
    // Confidence interval
    const ciWidth = 1.96 * pooledSE;
    
    // Power calculation
    const effectSize = Math.abs(meanEffect) / Math.sqrt((treatmentStd ** 2 + controlStd ** 2) / 2);
    const power = this.calculatePower(n1 + n2, effectSize, alpha);
    
    // Required sample size for 80% power
    const requiredN = this.calculateRequiredSampleSize(effectSize, 0.8, alpha);

    return {
      testId: config.testId,
      treatment: 'treatment',
      control: 'control',
      metric: config.metric,
      sampleSize: { treatment: n1, control: n2 },
      meanEffect,
      confidenceInterval: [meanEffect - ciWidth, meanEffect + ciWidth],
      pValue,
      isSignificant: pValue < alpha,
      power,
      requiredSampleSize: requiredN,
    };
  }

  // Sensitivity Analysis
  async performSensitivityAnalysis(
    data: any[],
    config: {
      graphId: string;
      treatment: string;
      outcome: string;
      unmeasuredConfoundingStrength: number[];
    }
  ): Promise<{
    baselineEffect: number;
    sensitivityCurve: { confoundingStrength: number; adjustedEffect: number }[];
    robustnessValue: number;
  }> {
    const graph = this.graphs.get(config.graphId);
    if (!graph) throw new Error(`Graph ${config.graphId} not found`);

    // Get baseline effect
    const baselineResult = await this.estimateCausalEffect(data, {
      graphId: config.graphId,
      treatment: config.treatment,
      outcome: config.outcome,
    });

    // Compute sensitivity curve
    const sensitivityCurve = config.unmeasuredConfoundingStrength.map(strength => {
      const adjustment = baselineResult.estimate * (1 - strength * 0.5);
      return {
        confoundingStrength: strength,
        adjustedEffect: adjustment,
      };
    });

    // Find robustness value (strength at which effect becomes insignificant)
    const robustnessValue = sensitivityCurve.find(s => 
      Math.sign(s.adjustedEffect) !== Math.sign(baselineResult.estimate)
    )?.confoundingStrength || 1.0;

    return {
      baselineEffect: baselineResult.estimate,
      sensitivityCurve,
      robustnessValue,
    };
  }

  // Mediation Analysis
  async performMediationAnalysis(
    data: any[],
    config: {
      treatment: string;
      mediator: string;
      outcome: string;
    }
  ): Promise<{
    totalEffect: number;
    directEffect: number;
    indirectEffect: number;
    proportionMediated: number;
  }> {
    await this.simulateDelay(500);

    // Simulate mediation analysis results
    const totalEffect = 0.3 + Math.random() * 0.4;
    const proportionMediated = 0.2 + Math.random() * 0.5;
    const indirectEffect = totalEffect * proportionMediated;
    const directEffect = totalEffect - indirectEffect;

    return {
      totalEffect,
      directEffect,
      indirectEffect,
      proportionMediated,
    };
  }

  // Helper methods
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private std(values: number[]): number {
    const m = this.mean(values);
    const variance = values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private calculatePower(n: number, effectSize: number, alpha: number): number {
    const zAlpha = 1.96;
    const se = 1 / Math.sqrt(n / 2);
    const zBeta = (effectSize / se) - zAlpha;
    return this.normalCDF(zBeta);
  }

  private calculateRequiredSampleSize(effectSize: number, power: number, alpha: number): number {
    const zAlpha = 1.96;
    const zBeta = 0.84;  // for 80% power
    return Math.ceil(2 * Math.pow((zAlpha + zBeta) / effectSize, 2));
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
