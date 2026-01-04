/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX EVENT SOURCING SERVICE
 * ============================================================================
 * Core event sourcing implementation with aggregate roots, event handlers,
 * and domain event processing.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Base Domain Event
export interface DomainEvent {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  timestamp: Date;
  payload: Record<string, any>;
  metadata: {
    userId?: string;
    workspaceId?: string;
    correlationId?: string;
    causationId?: string;
    source?: string;
  };
}

// Aggregate Root Base Class
export abstract class AggregateRoot {
  private uncommittedEvents: DomainEvent[] = [];
  private version = 0;

  constructor(public readonly id: string) {}

  get currentVersion(): number {
    return this.version;
  }

  protected apply(event: DomainEvent): void {
    this.when(event);
    this.uncommittedEvents.push(event);
    this.version++;
  }

  protected abstract when(event: DomainEvent): void;

  public loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.when(event);
      this.version = event.version;
    }
  }

  public getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  public clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }
}

// Event Handler Decorator
export function EventHandler(eventType: string): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata('eventHandler', eventType, target, propertyKey);
    return descriptor;
  };
}

// Command Handler Decorator
export function CommandHandler(commandType: string): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata('commandHandler', commandType, target);
    return target;
  };
}

// Query Handler Decorator
export function QueryHandler(queryType: string): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata('queryHandler', queryType, target);
    return target;
  };
}

@Injectable()
export class EventSourcingService {
  private readonly logger = new Logger(EventSourcingService.name);
  private readonly eventHandlers = new Map<
    string,
    Array<(...args: any[]) => any>
  >();

  constructor(
    @Inject('CQRS_OPTIONS') private readonly options: any,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Create a new domain event
  createEvent<T extends Record<string, any>>(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: T,
    metadata?: DomainEvent['metadata'],
    version?: number,
  ): DomainEvent {
    return {
      eventId: this.generateEventId(),
      aggregateId,
      aggregateType,
      eventType,
      version: version || 1,
      timestamp: new Date(),
      payload,
      metadata: metadata || {},
    };
  }

  // Register an event handler
  registerHandler(eventType: string, handler: (...args: any[]) => any): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
    this.logger.log(`Registered handler for event: ${eventType}`);
  }

  // Dispatch an event to all registered handlers
  async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.eventType) || [];

    this.logger.debug(
      `Dispatching event ${event.eventType} to ${handlers.length} handlers`,
    );

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Error in event handler for ${event.eventType}: ${error.message}`,
        );
        throw error;
      }
    }

    // Also emit to the event emitter for async processing
    this.eventEmitter.emit(event.eventType, event);
    this.eventEmitter.emit('domain.event', event);
  }

  // Generate a unique event ID
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Portal Aggregate Example
export class PortalAggregate extends AggregateRoot {
  private name: string;
  private workspaceId: string;
  private widgets: string[] = [];
  private isPublic: boolean = true;
  private isDeleted: boolean = false;

  constructor(id: string) {
    super(id);
  }

  // Factory method
  static create(
    id: string,
    name: string,
    workspaceId: string,
    userId: string,
  ): PortalAggregate {
    const portal = new PortalAggregate(id);
    portal.apply({
      eventId: `evt_${Date.now()}`,
      aggregateId: id,
      aggregateType: 'Portal',
      eventType: 'PortalCreated',
      version: 1,
      timestamp: new Date(),
      payload: { name, workspaceId },
      metadata: { userId, workspaceId },
    });
    return portal;
  }

  // Commands
  public rename(newName: string, userId: string): void {
    if (this.isDeleted) throw new Error('Cannot rename deleted portal');
    this.apply({
      eventId: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Portal',
      eventType: 'PortalRenamed',
      version: this.currentVersion + 1,
      timestamp: new Date(),
      payload: { oldName: this.name, newName },
      metadata: { userId, workspaceId: this.workspaceId },
    });
  }

  public addWidget(widgetId: string, userId: string): void {
    if (this.isDeleted) throw new Error('Cannot add widget to deleted portal');
    if (this.widgets.includes(widgetId))
      throw new Error('Widget already exists');
    this.apply({
      eventId: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Portal',
      eventType: 'WidgetAdded',
      version: this.currentVersion + 1,
      timestamp: new Date(),
      payload: { widgetId },
      metadata: { userId, workspaceId: this.workspaceId },
    });
  }

  public removeWidget(widgetId: string, userId: string): void {
    if (!this.widgets.includes(widgetId)) throw new Error('Widget not found');
    this.apply({
      eventId: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Portal',
      eventType: 'WidgetRemoved',
      version: this.currentVersion + 1,
      timestamp: new Date(),
      payload: { widgetId },
      metadata: { userId, workspaceId: this.workspaceId },
    });
  }

  public setVisibility(isPublic: boolean, userId: string): void {
    if (this.isDeleted)
      throw new Error('Cannot change visibility of deleted portal');
    this.apply({
      eventId: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Portal',
      eventType: 'VisibilityChanged',
      version: this.currentVersion + 1,
      timestamp: new Date(),
      payload: { isPublic },
      metadata: { userId, workspaceId: this.workspaceId },
    });
  }

  public delete(userId: string): void {
    if (this.isDeleted) throw new Error('Portal already deleted');
    this.apply({
      eventId: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Portal',
      eventType: 'PortalDeleted',
      version: this.currentVersion + 1,
      timestamp: new Date(),
      payload: {},
      metadata: { userId, workspaceId: this.workspaceId },
    });
  }

  // Event handlers
  protected when(event: DomainEvent): void {
    switch (event.eventType) {
      case 'PortalCreated':
        this.name = event.payload.name;
        this.workspaceId = event.payload.workspaceId;
        break;
      case 'PortalRenamed':
        this.name = event.payload.newName;
        break;
      case 'WidgetAdded':
        this.widgets.push(event.payload.widgetId);
        break;
      case 'WidgetRemoved':
        this.widgets = this.widgets.filter(
          (id) => id !== event.payload.widgetId,
        );
        break;
      case 'VisibilityChanged':
        this.isPublic = event.payload.isPublic;
        break;
      case 'PortalDeleted':
        this.isDeleted = true;
        break;
    }
  }

  // Getters for read model
  public getName(): string {
    return this.name;
  }
  public getWorkspaceId(): string {
    return this.workspaceId;
  }
  public getWidgets(): string[] {
    return [...this.widgets];
  }
  public getIsPublic(): boolean {
    return this.isPublic;
  }
  public getIsDeleted(): boolean {
    return this.isDeleted;
  }
}
