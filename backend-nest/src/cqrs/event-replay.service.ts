/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX EVENT REPLAY SERVICE
 * ============================================================================
 * Service for replaying events for debugging, testing, and rebuilding
 * system state from event history.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventStore } from './event-store';
import { DomainEvent, EventSourcingService } from './event-sourcing.service';

// Replay Options
export interface ReplayOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  eventTypes?: string[];
  aggregateTypes?: string[];
  aggregateIds?: string[];
  speed?: number; // Replay speed multiplier (1 = real-time, 10 = 10x faster)
  batchSize?: number;
  pauseBetweenBatches?: number; // ms
  dryRun?: boolean; // Don't actually dispatch events
}

// Replay Progress
export interface ReplayProgress {
  totalEvents: number;
  processedEvents: number;
  currentTimestamp?: Date;
  startTime: Date;
  elapsedMs: number;
  estimatedRemainingMs: number;
  eventsPerSecond: number;
  status: 'running' | 'paused' | 'completed' | 'error';
  errors: string[];
}

// Replay Session
export interface ReplaySession {
  sessionId: string;
  options: ReplayOptions;
  progress: ReplayProgress;
}

@Injectable()
export class EventReplayService {
  private readonly logger = new Logger(EventReplayService.name);
  private readonly activeSessions = new Map<string, ReplaySession>();
  private readonly pausedSessions = new Set<string>();

  constructor(
    private readonly eventStore: EventStore,
    private readonly eventSourcingService: EventSourcingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Start a replay session
  async startReplay(options: ReplayOptions): Promise<string> {
    const sessionId = this.generateSessionId();

    // Count total events
    const events = await this.eventStore.getAllEvents({
      fromTimestamp: options.fromTimestamp,
      toTimestamp: options.toTimestamp,
      aggregateTypes: options.aggregateTypes,
    });

    const filteredEvents = this.filterEvents(events, options);

    const session: ReplaySession = {
      sessionId,
      options,
      progress: {
        totalEvents: filteredEvents.length,
        processedEvents: 0,
        startTime: new Date(),
        elapsedMs: 0,
        estimatedRemainingMs: 0,
        eventsPerSecond: 0,
        status: 'running',
        errors: [],
      },
    };

    this.activeSessions.set(sessionId, session);
    this.logger.log(`Starting replay session ${sessionId} with ${filteredEvents.length} events`);

    // Start replay in background
    this.executeReplay(sessionId, filteredEvents).catch((error) => {
      session.progress.status = 'error';
      session.progress.errors.push(error.message);
      this.logger.error(`Replay session ${sessionId} failed: ${error.message}`);
    });

    return sessionId;
  }

  // Execute the replay
  private async executeReplay(sessionId: string, events: DomainEvent[]): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const { options, progress } = session;
    const batchSize = options.batchSize || 100;
    const pauseBetweenBatches = options.pauseBetweenBatches || 10;
    let lastEventTime: Date | null = null;

    for (let i = 0; i < events.length; i += batchSize) {
      // Check if paused or stopped
      if (this.pausedSessions.has(sessionId)) {
        progress.status = 'paused';
        await this.waitUntilResumed(sessionId);
      }

      if (!this.activeSessions.has(sessionId)) {
        return; // Session was cancelled
      }

      const batch = events.slice(i, i + batchSize);

      for (const event of batch) {
        try {
          // Simulate time delay if speed option is set
          if (options.speed && options.speed > 0 && lastEventTime) {
            const timeDiff = event.timestamp.getTime() - lastEventTime.getTime();
            const adjustedDelay = timeDiff / options.speed;
            if (adjustedDelay > 0 && adjustedDelay < 10000) {
              await this.delay(adjustedDelay);
            }
          }
          lastEventTime = event.timestamp;

          // Dispatch event unless dry run
          if (!options.dryRun) {
            await this.eventSourcingService.dispatch(event);
          }

          progress.processedEvents++;
          progress.currentTimestamp = event.timestamp;

          // Emit progress event
          this.eventEmitter.emit('replay.progress', {
            sessionId,
            event,
            progress: { ...progress },
          });
        } catch (error) {
          progress.errors.push(`Event ${event.eventId}: ${error.message}`);
          this.logger.warn(`Error replaying event ${event.eventId}: ${error.message}`);
        }
      }

      // Update progress metrics
      progress.elapsedMs = Date.now() - progress.startTime.getTime();
      progress.eventsPerSecond = progress.processedEvents / (progress.elapsedMs / 1000);
      progress.estimatedRemainingMs =
        ((progress.totalEvents - progress.processedEvents) / progress.eventsPerSecond) * 1000;

      // Pause between batches
      if (pauseBetweenBatches > 0) {
        await this.delay(pauseBetweenBatches);
      }
    }

    progress.status = 'completed';
    this.logger.log(
      `Replay session ${sessionId} completed: ${progress.processedEvents} events processed`,
    );

    this.eventEmitter.emit('replay.completed', {
      sessionId,
      progress: { ...progress },
    });
  }

  // Pause a replay session
  pauseReplay(sessionId: string): boolean {
    if (this.activeSessions.has(sessionId)) {
      this.pausedSessions.add(sessionId);
      return true;
    }
    return false;
  }

  // Resume a paused replay
  resumeReplay(sessionId: string): boolean {
    if (this.pausedSessions.has(sessionId)) {
      this.pausedSessions.delete(sessionId);
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.progress.status = 'running';
      }
      return true;
    }
    return false;
  }

  // Stop a replay session
  stopReplay(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.pausedSessions.delete(sessionId);
      this.activeSessions.delete(sessionId);
      this.eventEmitter.emit('replay.stopped', { sessionId });
      return true;
    }
    return false;
  }

  // Get replay progress
  getProgress(sessionId: string): ReplayProgress | null {
    const session = this.activeSessions.get(sessionId);
    return session ? { ...session.progress } : null;
  }

  // Get all active sessions
  getActiveSessions(): ReplaySession[] {
    return Array.from(this.activeSessions.values());
  }

  // Replay events for a specific aggregate
  async replayAggregate(
    aggregateId: string,
    options?: { toVersion?: number; dryRun?: boolean },
  ): Promise<DomainEvent[]> {
    const events = await this.eventStore.getEvents(aggregateId);
    const filteredEvents = options?.toVersion
      ? events.filter((e) => e.version <= options.toVersion)
      : events;

    if (!options?.dryRun) {
      for (const event of filteredEvents) {
        await this.eventSourcingService.dispatch(event);
      }
    }

    return filteredEvents;
  }

  // Compare event streams
  async compareStreams(
    aggregateId1: string,
    aggregateId2: string,
  ): Promise<{
    matching: number;
    differences: Array<{ version: number; diff: string }>;
  }> {
    const events1 = await this.eventStore.getEvents(aggregateId1);
    const events2 = await this.eventStore.getEvents(aggregateId2);

    let matching = 0;
    const differences: Array<{ version: number; diff: string }> = [];

    const maxLength = Math.max(events1.length, events2.length);
    for (let i = 0; i < maxLength; i++) {
      const e1 = events1[i];
      const e2 = events2[i];

      if (!e1 || !e2) {
        differences.push({
          version: i + 1,
          diff: !e1 ? 'Missing in stream 1' : 'Missing in stream 2',
        });
      } else if (e1.eventType !== e2.eventType) {
        differences.push({
          version: i + 1,
          diff: `Event type mismatch: ${e1.eventType} vs ${e2.eventType}`,
        });
      } else if (JSON.stringify(e1.payload) !== JSON.stringify(e2.payload)) {
        differences.push({
          version: i + 1,
          diff: 'Payload mismatch',
        });
      } else {
        matching++;
      }
    }

    return { matching, differences };
  }

  // Time travel to a specific point
  async timeTravel(
    aggregateId: string,
    toTimestamp: Date,
  ): Promise<{ events: DomainEvent[]; finalState: any }> {
    const events = await this.eventStore.getEvents(aggregateId);
    const eventsUntilTimestamp = events.filter((e) => e.timestamp <= toTimestamp);

    // This would reconstruct the aggregate state at that point
    // Implementation depends on the aggregate type
    return {
      events: eventsUntilTimestamp,
      finalState: null, // Would be the reconstructed state
    };
  }

  // Private helpers
  private filterEvents(events: DomainEvent[], options: ReplayOptions): DomainEvent[] {
    return events.filter((event) => {
      if (options.eventTypes && !options.eventTypes.includes(event.eventType)) {
        return false;
      }
      if (options.aggregateTypes && !options.aggregateTypes.includes(event.aggregateType)) {
        return false;
      }
      if (options.aggregateIds && !options.aggregateIds.includes(event.aggregateId)) {
        return false;
      }
      return true;
    });
  }

  private async waitUntilResumed(sessionId: string): Promise<void> {
    while (this.pausedSessions.has(sessionId) && this.activeSessions.has(sessionId)) {
      await this.delay(100);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateSessionId(): string {
    return `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
