/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX CQRS EVENT SOURCING MODULE
 * ============================================================================
 * Enterprise-grade CQRS (Command Query Responsibility Segregation) and
 * Event Sourcing implementation for high-scalability and audit trail.
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventSourcingService } from './event-sourcing.service';
import { CommandBus } from './command-bus';
import { QueryBus } from './query-bus';
import { EventStore } from './event-store';
import { ProjectionService } from './projection.service';
import { SnapshotService } from './snapshot.service';
import { SagaOrchestrator } from './saga-orchestrator';
import { EventReplayService } from './event-replay.service';

export interface CQRSModuleOptions {
  eventStore: {
    provider: 'postgresql' | 'mongodb' | 'eventstore' | 'kafka';
    connection?: string;
  };
  snapshots: {
    enabled: boolean;
    frequency: number; // Every N events
  };
  projections: {
    rebuildOnStartup: boolean;
  };
  sagas: {
    enabled: boolean;
    timeout: number;
  };
}

@Global()
@Module({})
export class CQRSModule {
  static forRoot(options: CQRSModuleOptions): DynamicModule {
    return {
      module: CQRSModule,
      providers: [
        {
          provide: 'CQRS_OPTIONS',
          useValue: options,
        },
        EventSourcingService,
        CommandBus,
        QueryBus,
        EventStore,
        ProjectionService,
        SnapshotService,
        SagaOrchestrator,
        EventReplayService,
      ],
      exports: [
        EventSourcingService,
        CommandBus,
        QueryBus,
        EventStore,
        ProjectionService,
        SnapshotService,
        SagaOrchestrator,
        EventReplayService,
      ],
    };
  }
}
