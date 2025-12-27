/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX SNAPSHOT SERVICE
 * ============================================================================
 * Aggregate snapshot service for optimizing event sourcing performance
 * by reducing event replay requirements.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventStore } from './event-store';
import { AggregateRoot, DomainEvent } from './event-sourcing.service';

// Snapshot Configuration
export interface SnapshotConfig {
  frequency: number; // Number of events between snapshots
  maxAge: number; // Max age in days before refresh
}

// Snapshot Data
export interface SnapshotData {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: any;
  timestamp: Date;
}

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);
  private readonly config: SnapshotConfig;
  private readonly aggregateFactories = new Map<string, () => AggregateRoot>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStore,
    @Inject('CQRS_OPTIONS') private readonly options: any,
  ) {
    this.config = {
      frequency: options.snapshots?.frequency || 100,
      maxAge: options.snapshots?.maxAge || 30,
    };
  }

  // Register aggregate factory
  registerFactory(aggregateType: string, factory: () => AggregateRoot): void {
    this.aggregateFactories.set(aggregateType, factory);
    this.logger.log(`Registered aggregate factory: ${aggregateType}`);
  }

  // Save a snapshot
  async saveSnapshot(
    aggregate: AggregateRoot,
    aggregateType: string,
  ): Promise<void> {
    const state = this.serializeAggregate(aggregate);

    await this.eventStore.createSnapshot(
      aggregate.id,
      aggregateType,
      aggregate.currentVersion,
      state,
    );

    this.logger.debug(
      `Saved snapshot for ${aggregateType}:${aggregate.id} at version ${aggregate.currentVersion}`,
    );
  }

  // Load aggregate with snapshot optimization
  async loadAggregate<T extends AggregateRoot>(
    aggregateId: string,
    aggregateType: string,
  ): Promise<T | null> {
    const factory = this.aggregateFactories.get(aggregateType);
    if (!factory) {
      throw new Error(
        `No factory registered for aggregate type: ${aggregateType}`,
      );
    }

    // Try to load from snapshot first
    const snapshot = await this.eventStore.getSnapshot(aggregateId);
    const aggregate = factory() as T;
    let fromVersion = 0;

    if (snapshot) {
      this.deserializeAggregate(aggregate, snapshot.state);
      fromVersion = snapshot.version;
      this.logger.debug(
        `Loaded ${aggregateType}:${aggregateId} from snapshot at version ${fromVersion}`,
      );
    }

    // Replay events since snapshot
    const events = await this.eventStore.getEvents(aggregateId, fromVersion);

    if (events.length === 0 && !snapshot) {
      return null; // Aggregate doesn't exist
    }

    aggregate.loadFromHistory(events);

    // Check if we should create a new snapshot
    if (events.length >= this.config.frequency) {
      await this.saveSnapshot(aggregate, aggregateType);
    }

    return aggregate;
  }

  // Check if snapshot is needed
  async shouldSnapshot(
    aggregateId: string,
    aggregateType: string,
  ): Promise<boolean> {
    const snapshot = await this.eventStore.getSnapshot(aggregateId);

    if (!snapshot) {
      const eventCount = await this.eventStore.getEventCount(aggregateId);
      return eventCount >= this.config.frequency;
    }

    const eventsSinceSnapshot =
      (await this.eventStore.getEventCount(aggregateId)) - snapshot.version;
    return eventsSinceSnapshot >= this.config.frequency;
  }

  // Scheduled snapshot maintenance
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async maintainSnapshots(): Promise<void> {
    this.logger.log('Starting snapshot maintenance...');

    const staleSnapshots = await this.prisma.eventStoreSnapshot.findMany({
      where: {
        timestamp: {
          lt: new Date(Date.now() - this.config.maxAge * 24 * 60 * 60 * 1000),
        },
      },
    });

    let refreshed = 0;
    for (const snapshot of staleSnapshots) {
      try {
        await this.refreshSnapshot(
          snapshot.aggregateId,
          snapshot.aggregateType,
        );
        refreshed++;
      } catch (error) {
        this.logger.error(
          `Failed to refresh snapshot for ${snapshot.aggregateId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Snapshot maintenance completed: ${refreshed} snapshots refreshed`,
    );
  }

  // Refresh a single snapshot
  async refreshSnapshot(
    aggregateId: string,
    aggregateType: string,
  ): Promise<void> {
    const aggregate = await this.loadAggregate(aggregateId, aggregateType);
    if (aggregate) {
      await this.saveSnapshot(aggregate, aggregateType);
    }
  }

  // Delete old snapshots
  async cleanupSnapshots(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.eventStoreSnapshot.deleteMany({
      where: {
        timestamp: { lt: cutoff },
      },
    });

    this.logger.log(`Deleted ${result.count} old snapshots`);
    return result.count;
  }

  // Get snapshot statistics
  async getStatistics(): Promise<{
    totalSnapshots: number;
    averageVersion: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
    byAggregateType: Record<string, number>;
  }> {
    const snapshots = await this.prisma.eventStoreSnapshot.findMany();

    const stats = {
      totalSnapshots: snapshots.length,
      averageVersion: 0,
      oldestSnapshot: null as Date | null,
      newestSnapshot: null as Date | null,
      byAggregateType: {} as Record<string, number>,
    };

    if (snapshots.length === 0) return stats;

    let totalVersion = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const snapshot of snapshots) {
      totalVersion += snapshot.version;

      if (!oldest || snapshot.timestamp < oldest) {
        oldest = snapshot.timestamp;
      }
      if (!newest || snapshot.timestamp > newest) {
        newest = snapshot.timestamp;
      }

      stats.byAggregateType[snapshot.aggregateType] =
        (stats.byAggregateType[snapshot.aggregateType] || 0) + 1;
    }

    stats.averageVersion = Math.round(totalVersion / snapshots.length);
    stats.oldestSnapshot = oldest;
    stats.newestSnapshot = newest;

    return stats;
  }

  // Serialize aggregate state
  private serializeAggregate(aggregate: AggregateRoot): any {
    // Use reflection or explicit getters to extract state
    const state: any = { id: aggregate.id, version: aggregate.currentVersion };

    // Get all getter methods and call them
    const prototype = Object.getPrototypeOf(aggregate);
    const getters = Object.getOwnPropertyNames(prototype).filter((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      return descriptor && typeof descriptor.get === 'function';
    });

    for (const getter of getters) {
      try {
        state[getter] = (aggregate as any)[getter];
      } catch {
        // Ignore getters that throw
      }
    }

    // Also check for methods starting with 'get'
    const methods = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name.startsWith('get') &&
        typeof (aggregate as any)[name] === 'function',
    );

    for (const method of methods) {
      const propName = method.charAt(3).toLowerCase() + method.slice(4);
      try {
        state[propName] = (aggregate as any)[method]();
      } catch {
        // Ignore methods that throw
      }
    }

    return state;
  }

  // Deserialize aggregate state
  private deserializeAggregate(aggregate: AggregateRoot, state: any): void {
    // This is a simplified implementation
    // In production, you'd want more robust serialization
    Object.assign(aggregate, state);
  }
}
