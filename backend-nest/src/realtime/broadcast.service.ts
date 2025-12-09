/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX BROADCAST SERVICE
 * ============================================================================
 * Centralized broadcast service for sending real-time updates to clients.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

// Event types
export type BroadcastEventType =
  | 'portal:created'
  | 'portal:updated'
  | 'portal:deleted'
  | 'widget:created'
  | 'widget:updated'
  | 'widget:deleted'
  | 'widget:data:refreshed'
  | 'alert:triggered'
  | 'alert:resolved'
  | 'insight:generated'
  | 'report:ready'
  | 'integration:synced'
  | 'integration:error'
  | 'notification:new'
  | 'comment:added'
  | 'comment:updated'
  | 'comment:deleted'
  | 'user:joined'
  | 'user:left'
  | 'subscription:updated';

// Broadcast options
export interface BroadcastOptions {
  excludeUsers?: string[];
  excludeSockets?: string[];
  priority?: 'high' | 'normal' | 'low';
  persist?: boolean;
  ttl?: number; // seconds
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  // ============================================
  // PORTAL BROADCASTS
  // ============================================

  portalCreated(workspaceId: string, portal: any, options?: BroadcastOptions): void {
    this.broadcast(workspaceId, 'portal:created', portal, options);
  }

  portalUpdated(workspaceId: string, portal: any, options?: BroadcastOptions): void {
    this.broadcast(workspaceId, 'portal:updated', portal, options);
    
    // Also notify portal-specific subscribers
    this.gateway.broadcastToPortal(portal.id, 'portal:updated', portal);
  }

  portalDeleted(workspaceId: string, portalId: string, options?: BroadcastOptions): void {
    this.broadcast(workspaceId, 'portal:deleted', { portalId }, options);
  }

  // ============================================
  // WIDGET BROADCASTS
  // ============================================

  widgetCreated(portalId: string, widget: any, options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'widget:created', widget);
  }

  widgetUpdated(portalId: string, widget: any, options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'widget:updated', widget);
    this.gateway.broadcastToWidget(widget.id, 'widget:updated', widget);
  }

  widgetDeleted(portalId: string, widgetId: string, options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'widget:deleted', { widgetId });
  }

  widgetDataRefreshed(widgetId: string, data: any, options?: BroadcastOptions): void {
    this.gateway.emitWidgetUpdate(widgetId, data);
  }

  // Batch widget update for efficiency
  widgetsBatchUpdate(portalId: string, widgets: { id: string; data: any }[]): void {
    this.gateway.broadcastToPortal(portalId, 'widgets:batch:updated', { widgets });
    
    // Also update individual widget subscribers
    for (const widget of widgets) {
      this.gateway.emitWidgetUpdate(widget.id, widget.data);
    }
  }

  // ============================================
  // ALERT BROADCASTS
  // ============================================

  alertTriggered(workspaceId: string, alert: any, options?: BroadcastOptions): void {
    this.gateway.emitAlert(workspaceId, {
      type: 'triggered',
      alert,
    });
  }

  alertResolved(workspaceId: string, alertId: string, options?: BroadcastOptions): void {
    this.broadcast(workspaceId, 'alert:resolved', { alertId }, options);
  }

  // ============================================
  // AI INSIGHT BROADCASTS
  // ============================================

  insightGenerated(workspaceId: string, insight: any, options?: BroadcastOptions): void {
    this.gateway.emitInsight(workspaceId, insight);
  }

  insightsUpdated(portalId: string, insights: any[], options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'insights:updated', { insights });
  }

  // ============================================
  // REPORT BROADCASTS
  // ============================================

  reportReady(workspaceId: string, report: any, userId?: string): void {
    if (userId) {
      this.gateway.broadcastToUser(userId, 'report:ready', report);
    } else {
      this.broadcast(workspaceId, 'report:ready', report);
    }
  }

  reportGenerating(workspaceId: string, reportId: string, progress: number, userId?: string): void {
    const data = { reportId, progress };
    if (userId) {
      this.gateway.broadcastToUser(userId, 'report:generating', data);
    } else {
      this.broadcast(workspaceId, 'report:generating', data);
    }
  }

  // ============================================
  // INTEGRATION BROADCASTS
  // ============================================

  integrationSynced(workspaceId: string, integration: any, options?: BroadcastOptions): void {
    this.broadcast(workspaceId, 'integration:synced', integration, options);
  }

  integrationError(workspaceId: string, integration: any, error: string, options?: BroadcastOptions): void {
    this.broadcast(workspaceId, 'integration:error', { integration, error }, options);
  }

  // ============================================
  // NOTIFICATION BROADCASTS
  // ============================================

  notification(userId: string, notification: any): void {
    this.gateway.broadcastToUser(userId, 'notification:new', notification);
  }

  notificationToWorkspace(workspaceId: string, notification: any): void {
    this.broadcast(workspaceId, 'notification:new', notification);
  }

  // ============================================
  // COMMENT BROADCASTS
  // ============================================

  commentAdded(portalId: string, comment: any, options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'comment:added', comment);
  }

  commentUpdated(portalId: string, comment: any, options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'comment:updated', comment);
  }

  commentDeleted(portalId: string, commentId: string, options?: BroadcastOptions): void {
    this.gateway.broadcastToPortal(portalId, 'comment:deleted', { commentId });
  }

  // ============================================
  // SUBSCRIPTION BROADCASTS
  // ============================================

  subscriptionUpdated(workspaceId: string, subscription: any): void {
    this.broadcast(workspaceId, 'subscription:updated', subscription);
  }

  // ============================================
  // USER BROADCASTS
  // ============================================

  userJoined(workspaceId: string, user: any): void {
    this.broadcast(workspaceId, 'user:joined', user);
  }

  userLeft(workspaceId: string, userId: string): void {
    this.broadcast(workspaceId, 'user:left', { userId });
  }

  // ============================================
  // GENERIC BROADCAST
  // ============================================

  broadcast(
    workspaceId: string,
    event: BroadcastEventType | string,
    data: any,
    options?: BroadcastOptions,
  ): void {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      priority: options?.priority || 'normal',
    };

    this.logger.debug(`Broadcasting ${event} to workspace ${workspaceId}`);
    this.gateway.broadcastToWorkspace(workspaceId, event, payload);
  }

  // Direct user broadcast
  broadcastToUser(userId: string, event: string, data: any): void {
    this.gateway.broadcastToUser(userId, event, {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Global broadcast to all connected clients
  broadcastGlobal(event: string, data: any): void {
    this.gateway.broadcastToAll(event, {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  batchBroadcast(
    broadcasts: Array<{
      workspaceId: string;
      event: string;
      data: any;
    }>,
  ): void {
    for (const { workspaceId, event, data } of broadcasts) {
      this.broadcast(workspaceId, event, data);
    }
  }

  // ============================================
  // PRESENCE UPDATES
  // ============================================

  presenceUpdate(workspaceId: string, presence: any): void {
    this.gateway.broadcastToWorkspace(workspaceId, 'presence:updated', presence);
  }

  cursorPosition(portalId: string, cursor: any): void {
    this.gateway.broadcastToPortal(portalId, 'cursor:moved', cursor);
  }
}
