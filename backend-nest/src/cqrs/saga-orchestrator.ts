/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX SAGA ORCHESTRATOR
 * ============================================================================
 * Saga pattern implementation for managing long-running business transactions
 * with compensation handling and state persistence.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEvent } from './event-sourcing.service';

// Saga State
export type SagaState = 'STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING' | 'COMPENSATED';

// Saga Step
export interface SagaStep<T = any> {
  name: string;
  execute: (context: SagaContext<T>) => Promise<void>;
  compensate: (context: SagaContext<T>) => Promise<void>;
  timeout?: number;
  retries?: number;
}

// Saga Context
export interface SagaContext<T = any> {
  sagaId: string;
  sagaType: string;
  data: T;
  currentStep: number;
  state: SagaState;
  completedSteps: string[];
  results: Record<string, any>;
  errors: string[];
  startedAt: Date;
  metadata: {
    userId?: string;
    workspaceId?: string;
    correlationId?: string;
  };
}

// Saga Definition
export interface SagaDefinition<T = any> {
  sagaType: string;
  steps: SagaStep<T>[];
  timeout?: number;
  onComplete?: (context: SagaContext<T>) => Promise<void>;
  onFailed?: (context: SagaContext<T>) => Promise<void>;
}

@Injectable()
export class SagaOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(SagaOrchestrator.name);
  private readonly sagas = new Map<string, SagaDefinition>();
  private readonly runningSagas = new Map<string, SagaContext>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    // Resume any interrupted sagas
    await this.resumeInterruptedSagas();
    this.logger.log('Saga Orchestrator initialized');
  }

  // Register a saga definition
  register<T>(definition: SagaDefinition<T>): void {
    this.sagas.set(definition.sagaType, definition);
    this.logger.log(`Registered saga: ${definition.sagaType}`);
  }

  // Start a new saga
  async start<T>(
    sagaType: string,
    data: T,
    metadata?: SagaContext['metadata'],
  ): Promise<string> {
    const definition = this.sagas.get(sagaType);
    if (!definition) {
      throw new Error(`Unknown saga type: ${sagaType}`);
    }

    const sagaId = this.generateSagaId();
    const context: SagaContext<T> = {
      sagaId,
      sagaType,
      data,
      currentStep: 0,
      state: 'STARTED',
      completedSteps: [],
      results: {},
      errors: [],
      startedAt: new Date(),
      metadata: metadata || {},
    };

    // Persist initial state
    await this.persistSagaState(context);
    this.runningSagas.set(sagaId, context);

    // Start execution
    this.executeSaga(context, definition).catch(error => {
      this.logger.error(`Saga ${sagaId} failed: ${error.message}`);
    });

    this.logger.log(`Started saga ${sagaType} with ID ${sagaId}`);
    return sagaId;
  }

  // Execute saga steps
  private async executeSaga<T>(
    context: SagaContext<T>,
    definition: SagaDefinition<T>,
  ): Promise<void> {
    context.state = 'RUNNING';
    await this.persistSagaState(context);

    try {
      for (let i = context.currentStep; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        context.currentStep = i;

        this.logger.debug(`Executing step ${step.name} for saga ${context.sagaId}`);

        try {
          // Execute with timeout and retries
          await this.executeStepWithRetry(step, context);
          
          context.completedSteps.push(step.name);
          await this.persistSagaState(context);

          // Emit step completion event
          this.eventEmitter.emit('saga.step.completed', {
            sagaId: context.sagaId,
            step: step.name,
            stepIndex: i,
          });
        } catch (error) {
          context.errors.push(`Step ${step.name} failed: ${error.message}`);
          await this.compensate(context, definition);
          return;
        }
      }

      // Saga completed successfully
      context.state = 'COMPLETED';
      await this.persistSagaState(context);
      this.runningSagas.delete(context.sagaId);

      // Execute completion callback
      if (definition.onComplete) {
        await definition.onComplete(context);
      }

      this.eventEmitter.emit('saga.completed', {
        sagaId: context.sagaId,
        sagaType: context.sagaType,
      });

      this.logger.log(`Saga ${context.sagaId} completed successfully`);
    } catch (error) {
      context.state = 'FAILED';
      context.errors.push(error.message);
      await this.persistSagaState(context);

      if (definition.onFailed) {
        await definition.onFailed(context);
      }

      this.eventEmitter.emit('saga.failed', {
        sagaId: context.sagaId,
        sagaType: context.sagaType,
        errors: context.errors,
      });

      this.logger.error(`Saga ${context.sagaId} failed: ${error.message}`);
    }
  }

  // Execute step with retry logic
  private async executeStepWithRetry<T>(
    step: SagaStep<T>,
    context: SagaContext<T>,
  ): Promise<void> {
    const maxRetries = step.retries || 3;
    const timeout = step.timeout || 30000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await Promise.race([
          step.execute(context),
          this.createTimeout(timeout, `Step ${step.name} timed out`),
        ]);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        this.logger.warn(
          `Step ${step.name} failed (attempt ${attempt}/${maxRetries}), retrying...`,
        );
        await this.delay(1000 * attempt); // Exponential backoff
      }
    }
  }

  // Compensate failed saga
  private async compensate<T>(
    context: SagaContext<T>,
    definition: SagaDefinition<T>,
  ): Promise<void> {
    context.state = 'COMPENSATING';
    await this.persistSagaState(context);

    this.logger.log(`Compensating saga ${context.sagaId}`);

    // Execute compensation in reverse order
    for (let i = context.completedSteps.length - 1; i >= 0; i--) {
      const stepName = context.completedSteps[i];
      const step = definition.steps.find(s => s.name === stepName);

      if (step) {
        try {
          this.logger.debug(`Compensating step ${step.name}`);
          await step.compensate(context);

          this.eventEmitter.emit('saga.step.compensated', {
            sagaId: context.sagaId,
            step: step.name,
          });
        } catch (error) {
          this.logger.error(`Compensation for step ${step.name} failed: ${error.message}`);
          context.errors.push(`Compensation failed for ${step.name}: ${error.message}`);
        }
      }
    }

    context.state = 'COMPENSATED';
    await this.persistSagaState(context);
    this.runningSagas.delete(context.sagaId);

    this.eventEmitter.emit('saga.compensated', {
      sagaId: context.sagaId,
      sagaType: context.sagaType,
    });
  }

  // Get saga status
  async getSagaStatus(sagaId: string): Promise<SagaContext | null> {
    // Check running sagas first
    if (this.runningSagas.has(sagaId)) {
      return this.runningSagas.get(sagaId) || null;
    }

    // Load from database
    return this.loadSagaState(sagaId);
  }

  // Abort a running saga
  async abort(sagaId: string): Promise<void> {
    const context = this.runningSagas.get(sagaId);
    if (!context) {
      throw new Error(`Saga ${sagaId} not found or not running`);
    }

    const definition = this.sagas.get(context.sagaType);
    if (!definition) {
      throw new Error(`Unknown saga type: ${context.sagaType}`);
    }

    context.errors.push('Saga aborted manually');
    await this.compensate(context, definition);
  }

  // Resume interrupted sagas
  private async resumeInterruptedSagas(): Promise<void> {
    try {
      const interruptedSagas = await this.prisma.sagaState.findMany({
        where: {
          state: { in: ['STARTED', 'RUNNING', 'COMPENSATING'] },
        },
      });

      for (const saga of interruptedSagas) {
        const definition = this.sagas.get(saga.sagaType);
        if (definition) {
          const context = JSON.parse(saga.context as string) as SagaContext;
          this.runningSagas.set(saga.sagaId, context);

          if (saga.state === 'COMPENSATING') {
            await this.compensate(context, definition);
          } else {
            await this.executeSaga(context, definition);
          }
        }
      }

      if (interruptedSagas.length > 0) {
        this.logger.log(`Resumed ${interruptedSagas.length} interrupted sagas`);
      }
    } catch (error) {
      this.logger.warn(`Failed to resume interrupted sagas: ${error.message}`);
    }
  }

  // Persist saga state to database
  private async persistSagaState(context: SagaContext): Promise<void> {
    await this.prisma.sagaState.upsert({
      where: { sagaId: context.sagaId },
      create: {
        sagaId: context.sagaId,
        sagaType: context.sagaType,
        state: context.state,
        context: JSON.stringify(context),
        startedAt: context.startedAt,
        updatedAt: new Date(),
      },
      update: {
        state: context.state,
        context: JSON.stringify(context),
        updatedAt: new Date(),
      },
    });
  }

  // Load saga state from database
  private async loadSagaState(sagaId: string): Promise<SagaContext | null> {
    const saga = await this.prisma.sagaState.findUnique({
      where: { sagaId },
    });

    if (!saga) return null;
    return JSON.parse(saga.context as string) as SagaContext;
  }

  // Helper methods
  private generateSagaId(): string {
    return `saga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example: Portal Creation Saga
export const portalCreationSaga: SagaDefinition<{
  portalId: string;
  name: string;
  workspaceId: string;
  widgets: any[];
}> = {
  sagaType: 'CreatePortal',
  timeout: 60000,
  steps: [
    {
      name: 'ValidateWorkspace',
      execute: async (ctx) => {
        // Validate workspace exists and has capacity
        ctx.results.workspaceValidated = true;
      },
      compensate: async (_ctx) => {
        // No compensation needed for validation
      },
    },
    {
      name: 'CreatePortalRecord',
      execute: async (ctx) => {
        // Create portal in database
        ctx.results.portalCreated = true;
      },
      compensate: async (ctx) => {
        // Delete portal if created
        if (ctx.results.portalCreated) {
          // await prisma.portal.delete({ where: { id: ctx.data.portalId } });
        }
      },
    },
    {
      name: 'CreateWidgets',
      execute: async (ctx) => {
        // Create widgets for portal
        ctx.results.widgetsCreated = ctx.data.widgets.length;
      },
      compensate: async (ctx) => {
        // Delete widgets if created
        if (ctx.results.widgetsCreated > 0) {
          // await prisma.widget.deleteMany({ where: { portalId: ctx.data.portalId } });
        }
      },
    },
    {
      name: 'InitializeCache',
      execute: async (ctx) => {
        // Initialize cache for portal
        ctx.results.cacheInitialized = true;
      },
      compensate: async (ctx) => {
        // Invalidate cache
        if (ctx.results.cacheInitialized) {
          // await cacheService.invalidate(`portal:${ctx.data.portalId}`);
        }
      },
    },
    {
      name: 'SendNotifications',
      execute: async (ctx) => {
        // Send notifications about new portal
        ctx.results.notificationsSent = true;
      },
      compensate: async (_ctx) => {
        // Cannot unsend notifications
      },
    },
  ],
  onComplete: async (ctx) => {
    console.log(`Portal ${ctx.data.name} created successfully`);
  },
  onFailed: async (ctx) => {
    console.error(`Portal creation failed: ${ctx.errors.join(', ')}`);
  },
};
