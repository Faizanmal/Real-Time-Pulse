/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX EVENT STORE
 * ============================================================================
 * Persistent event store implementation with support for multiple backends,
 * snapshots, and event replay capabilities.
 */

import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEvent } from './event-sourcing.service';

// Event Store Interface
export interface IEventStore {
  append(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(options?: EventQueryOptions): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, options?: EventQueryOptions): Promise<DomainEvent[]>;
  getEventCount(aggregateId: string): Promise<number>;
}

// Event Query Options
export interface EventQueryOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  fromVersion?: number;
  toVersion?: number;
  limit?: number;
  offset?: number;
  aggregateTypes?: string[];
}

// Stream Position
export interface StreamPosition {
  global: number;
  partition?: number;
}

@Injectable()
export class EventStore implements IEventStore, OnModuleInit {
  private readonly logger = new Logger(EventStore.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('CQRS_OPTIONS') private readonly options: any,
  ) {}

  async onModuleInit(): Promise<void> {
    // Ensure event store table exists
    await this.ensureEventStoreExists();
    this.logger.log('Event Store initialized');
  }

  // Append events to the store
  async append(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    const startTime = Date.now();

    try {
      // Use transaction for atomicity
      await this.prisma.$transaction(async (tx) => {
        for (const event of events) {
          // Check for optimistic concurrency
          const lastEvent = await tx.eventStoreEvent.findFirst({
            where: { aggregateId: event.aggregateId },
            orderBy: { version: 'desc' },
          });

          const expectedVersion = lastEvent ? lastEvent.version : 0;
          if (event.version !== expectedVersion + 1) {
            throw new Error(
              `Concurrency conflict for aggregate ${event.aggregateId}: expected version ${expectedVersion + 1}, got ${event.version}`,
            );
          }

          await tx.eventStoreEvent.create({
            data: {
              eventId: event.eventId,
              aggregateId: event.aggregateId,
              aggregateType: event.aggregateType,
              eventType: event.eventType,
              version: event.version,
              timestamp: event.timestamp,
              payload: JSON.stringify(event.payload),
              metadata: JSON.stringify(event.metadata),
            },
          });
        }
      });

      this.logger.debug(`Appended ${events.length} events in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to append events: ${error.message}`);
      throw error;
    }
  }

  // Get events for an aggregate
  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const events = await this.prisma.eventStoreEvent.findMany({
      where: {
        aggregateId,
        version: { gt: fromVersion },
      },
      orderBy: { version: 'asc' },
    });

    return events.map(this.mapToEvent);
  }

  // Get all events with optional filtering
  async getAllEvents(options: EventQueryOptions = {}): Promise<DomainEvent[]> {
    const where: any = {};

    if (options.fromTimestamp) {
      where.timestamp = { ...where.timestamp, gte: options.fromTimestamp };
    }
    if (options.toTimestamp) {
      where.timestamp = { ...where.timestamp, lte: options.toTimestamp };
    }
    if (options.aggregateTypes && options.aggregateTypes.length > 0) {
      where.aggregateType = { in: options.aggregateTypes };
    }

    const events = await this.prisma.eventStoreEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: options.limit,
      skip: options.offset,
    });

    return events.map(this.mapToEvent);
  }

  // Get events by type
  async getEventsByType(
    eventType: string,
    options: EventQueryOptions = {},
  ): Promise<DomainEvent[]> {
    const events = await this.prisma.eventStoreEvent.findMany({
      where: {
        eventType,
        ...(options.fromTimestamp && {
          timestamp: { gte: options.fromTimestamp },
        }),
        ...(options.toTimestamp && { timestamp: { lte: options.toTimestamp } }),
      },
      orderBy: { timestamp: 'asc' },
      take: options.limit,
      skip: options.offset,
    });

    return events.map(this.mapToEvent);
  }

  // Get event count for an aggregate
  async getEventCount(aggregateId: string): Promise<number> {
    return this.prisma.eventStoreEvent.count({
      where: { aggregateId },
    });
  }

  // Get the latest version for an aggregate
  async getLatestVersion(aggregateId: string): Promise<number> {
    const lastEvent = await this.prisma.eventStoreEvent.findFirst({
      where: { aggregateId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return lastEvent?.version || 0;
  }

  // Get stream position
  async getStreamPosition(): Promise<StreamPosition> {
    const count = await this.prisma.eventStoreEvent.count();
    return { global: count };
  }

  // Subscribe to events (for real-time processing)
  async *subscribe(fromPosition?: number): AsyncGenerator<DomainEvent> {
    let currentPosition = fromPosition || 0;

    while (true) {
      const events = await this.prisma.eventStoreEvent.findMany({
        where: { id: { gt: String(currentPosition) } },
        orderBy: { id: 'asc' },
        take: 100,
      });

      for (const event of events) {
        yield this.mapToEvent(event);
        currentPosition = parseInt(event.id, 10);
      }

      // Poll interval
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Create snapshot for an aggregate
  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number,
    state: any,
  ): Promise<void> {
    await this.prisma.eventStoreSnapshot.upsert({
      where: { aggregateId },
      create: {
        aggregateId,
        aggregateType,
        version,
        state: JSON.stringify(state),
        timestamp: new Date(),
      },
      update: {
        version,
        state: JSON.stringify(state),
        timestamp: new Date(),
      },
    });
  }

  // Get snapshot for an aggregate
  async getSnapshot(aggregateId: string): Promise<{ version: number; state: any } | null> {
    const snapshot = await this.prisma.eventStoreSnapshot.findUnique({
      where: { aggregateId },
    });

    if (!snapshot) return null;

    return {
      version: snapshot.version,
      state: JSON.parse(snapshot.state),
    };
  }

  // Archive old events
  async archiveEvents(beforeDate: Date): Promise<number> {
    const result = await this.prisma.eventStoreEvent.updateMany({
      where: {
        timestamp: { lt: beforeDate },
        archived: false,
      },
      data: { archived: true },
    });

    this.logger.log(`Archived ${result.count} events before ${beforeDate.toISOString()}`);
    return result.count;
  }

  // Map database record to DomainEvent
  private mapToEvent(record: any): DomainEvent {
    return {
      eventId: record.eventId,
      aggregateId: record.aggregateId,
      aggregateType: record.aggregateType,
      eventType: record.eventType,
      version: record.version,
      timestamp: record.timestamp,
      payload: typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload,
      metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
    };
  }

  // Ensure event store tables exist
  private async ensureEventStoreExists(): Promise<void> {
    // This would be handled by Prisma migrations in production
    // Here we just verify the connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Failed to connect to database for event store');
      throw error;
    }
  }
}

// Event Store Event (Prisma model would be defined in schema.prisma)
export interface EventStoreEventRecord {
  id: string;
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  timestamp: Date;
  payload: string;
  metadata: string;
  archived: boolean;
  createdAt: Date;
}

// Event Store Snapshot (Prisma model would be defined in schema.prisma)
export interface EventStoreSnapshotRecord {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: string;
  timestamp: Date;
}
