/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX PROJECTION SERVICE
 * ============================================================================
 * Read model projection service for maintaining eventually consistent
 * materialized views from event streams.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from './event-sourcing.service';
import { EventStore } from './event-store';

// Projection Interface
export interface IProjection {
  name: string;
  eventTypes: string[];
  handle(event: DomainEvent): Promise<void>;
  rebuild?(): Promise<void>;
}

// Projection Status
export interface ProjectionStatus {
  name: string;
  lastProcessedPosition: number;
  lastProcessedTimestamp?: Date;
  state: 'running' | 'paused' | 'rebuilding' | 'error';
  errorMessage?: string;
  eventsProcessed: number;
  lag: number;
}

@Injectable()
export class ProjectionService implements OnModuleInit {
  private readonly logger = new Logger(ProjectionService.name);
  private readonly projections = new Map<string, IProjection>();
  private readonly projectionStatus = new Map<string, ProjectionStatus>();
  private isRunning = false;

  constructor(private readonly eventStore: EventStore) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Projection Service initialized');
  }

  // Register a projection
  register(projection: IProjection): void {
    this.projections.set(projection.name, projection);
    this.projectionStatus.set(projection.name, {
      name: projection.name,
      lastProcessedPosition: 0,
      state: 'paused',
      eventsProcessed: 0,
      lag: 0,
    });
    this.logger.log(`Registered projection: ${projection.name}`);
  }

  // Start all projections
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const [name, projection] of this.projections) {
      this.startProjection(name, projection).catch((error) => {
        this.logger.error(`Projection ${name} failed: ${error.message}`);
      });
    }

    this.logger.log('All projections started');
  }

  // Stop all projections
  async stop(): Promise<void> {
    this.isRunning = false;
    for (const status of this.projectionStatus.values()) {
      status.state = 'paused';
    }
    this.logger.log('All projections stopped');
  }

  // Start a single projection
  private async startProjection(name: string, projection: IProjection): Promise<void> {
    const status = this.projectionStatus.get(name);
    status.state = 'running';

    while (this.isRunning) {
      try {
        const events = await this.eventStore.getAllEvents({
          fromVersion: status.lastProcessedPosition,
          limit: 100,
        });

        for (const event of events) {
          if (
            !projection.eventTypes.includes(event.eventType) &&
            !projection.eventTypes.includes('*')
          ) {
            continue;
          }

          await projection.handle(event);
          status.lastProcessedPosition = event.version;
          status.lastProcessedTimestamp = event.timestamp;
          status.eventsProcessed++;
        }

        // Calculate lag
        const currentPosition = await this.eventStore.getStreamPosition();
        status.lag = currentPosition.global - status.lastProcessedPosition;

        // Wait before polling again if no events
        if (events.length === 0) {
          await this.delay(100);
        }
      } catch (error) {
        status.state = 'error';
        status.errorMessage = error.message;
        this.logger.error(`Projection ${name} error: ${error.message}`);
        await this.delay(5000); // Wait before retrying
        status.state = 'running';
      }
    }
  }

  // Rebuild a projection
  async rebuild(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection ${projectionName} not found`);
    }

    const status = this.projectionStatus.get(projectionName);
    status.state = 'rebuilding';
    status.lastProcessedPosition = 0;
    status.eventsProcessed = 0;

    this.logger.log(`Rebuilding projection: ${projectionName}`);

    if (projection.rebuild) {
      await projection.rebuild();
    }

    // Reprocess all events
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const events = await this.eventStore.getAllEvents({
        limit: batchSize,
        offset,
      });

      if (events.length === 0) break;

      for (const event of events) {
        if (
          projection.eventTypes.includes(event.eventType) ||
          projection.eventTypes.includes('*')
        ) {
          await projection.handle(event);
          status.eventsProcessed++;
        }
      }

      status.lastProcessedPosition = events[events.length - 1].version;
      offset += batchSize;

      this.logger.debug(`Rebuilt ${status.eventsProcessed} events for ${projectionName}`);
    }

    status.state = 'running';
    this.logger.log(`Projection ${projectionName} rebuilt successfully`);
  }

  // Get projection status
  getStatus(projectionName?: string): ProjectionStatus | ProjectionStatus[] {
    if (projectionName) {
      return this.projectionStatus.get(projectionName);
    }
    return Array.from(this.projectionStatus.values());
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Example Projections

// Portal Summary Projection
export class PortalSummaryProjection implements IProjection {
  name = 'PortalSummary';
  eventTypes = ['PortalCreated', 'PortalUpdated', 'PortalDeleted', 'WidgetAdded', 'WidgetRemoved'];

  private readonly logger = new Logger(PortalSummaryProjection.name);
  private summaries = new Map<string, any>();

  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'PortalCreated':
        this.summaries.set(event.aggregateId, {
          id: event.aggregateId,
          name: event.payload.name,
          workspaceId: event.payload.workspaceId,
          widgetCount: 0,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        break;

      case 'PortalUpdated': {
        const portal = this.summaries.get(event.aggregateId);
        if (portal) {
          Object.assign(portal, event.payload, { updatedAt: event.timestamp });
        }
        break;
      }

      case 'PortalDeleted':
        this.summaries.delete(event.aggregateId);
        break;

      case 'WidgetAdded': {
        const p1 = this.summaries.get(event.aggregateId);
        if (p1) {
          p1.widgetCount++;
          p1.updatedAt = event.timestamp;
        }
        break;
      }

      case 'WidgetRemoved': {
        const p2 = this.summaries.get(event.aggregateId);
        if (p2) {
          p2.widgetCount--;
          p2.updatedAt = event.timestamp;
        }
        break;
      }
    }
  }

  async rebuild(): Promise<void> {
    this.summaries.clear();
    this.logger.log('Portal summaries cleared for rebuild');
  }

  getSummary(portalId: string): any {
    return this.summaries.get(portalId);
  }

  getAllSummaries(): any[] {
    return Array.from(this.summaries.values());
  }
}

// Workspace Analytics Projection
export class WorkspaceAnalyticsProjection implements IProjection {
  name = 'WorkspaceAnalytics';
  eventTypes = ['*']; // Listen to all events

  private analytics = new Map<
    string,
    {
      workspaceId: string;
      totalPortals: number;
      totalWidgets: number;
      totalUsers: number;
      totalEvents: number;
      lastActivity: Date;
      eventsByType: Record<string, number>;
    }
  >();

  async handle(event: DomainEvent): Promise<void> {
    const workspaceId = event.metadata.workspaceId;
    if (!workspaceId) return;

    let stats = this.analytics.get(workspaceId);
    if (!stats) {
      stats = {
        workspaceId,
        totalPortals: 0,
        totalWidgets: 0,
        totalUsers: 0,
        totalEvents: 0,
        lastActivity: event.timestamp,
        eventsByType: {},
      };
      this.analytics.set(workspaceId, stats);
    }

    stats.totalEvents++;
    stats.lastActivity = event.timestamp;
    stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;

    // Update counters based on event type
    if (event.eventType === 'PortalCreated') stats.totalPortals++;
    if (event.eventType === 'PortalDeleted') stats.totalPortals--;
    if (event.eventType === 'WidgetAdded') stats.totalWidgets++;
    if (event.eventType === 'WidgetRemoved') stats.totalWidgets--;
    if (event.eventType === 'UserAdded') stats.totalUsers++;
    if (event.eventType === 'UserRemoved') stats.totalUsers--;
  }

  async rebuild(): Promise<void> {
    this.analytics.clear();
  }

  getAnalytics(workspaceId: string): any {
    return this.analytics.get(workspaceId);
  }
}

// User Activity Projection
export class UserActivityProjection implements IProjection {
  name = 'UserActivity';
  eventTypes = ['*'];

  private activities = new Map<
    string,
    {
      userId: string;
      lastSeen: Date;
      activityCount: number;
      recentActions: Array<{ action: string; timestamp: Date }>;
    }
  >();

  async handle(event: DomainEvent): Promise<void> {
    const userId = event.metadata.userId;
    if (!userId) return;

    let activity = this.activities.get(userId);
    if (!activity) {
      activity = {
        userId,
        lastSeen: event.timestamp,
        activityCount: 0,
        recentActions: [],
      };
      this.activities.set(userId, activity);
    }

    activity.lastSeen = event.timestamp;
    activity.activityCount++;
    activity.recentActions.unshift({
      action: event.eventType,
      timestamp: event.timestamp,
    });

    // Keep only last 100 actions
    if (activity.recentActions.length > 100) {
      activity.recentActions = activity.recentActions.slice(0, 100);
    }
  }

  async rebuild(): Promise<void> {
    this.activities.clear();
  }

  getUserActivity(userId: string): any {
    return this.activities.get(userId);
  }

  getActiveUsers(since: Date): any[] {
    return Array.from(this.activities.values()).filter((a) => a.lastSeen >= since);
  }
}
