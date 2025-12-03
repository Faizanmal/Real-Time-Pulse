import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

interface WidgetChange {
  widgetId: string;
  changeType: 'config' | 'position' | 'size' | 'content';
  oldValue: any;
  newValue: any;
  timestamp: number;
  userId: string;
}

interface ActivityLog {
  portalId: string;
  odId: string;
  action: string;
  widgetId?: string;
  changeType?: string;
  timestamp: Date;
  metadata?: any;
}

interface ChatMessage {
  id: string;
  odId?: string;
  userName?: string;
  avatar?: string;
  message: string;
  widgetId?: string;
  timestamp: string;
}

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);
  
  // In-memory change history for operational transformation
  private changeHistory: Map<string, WidgetChange[]> = new Map();
  
  // Version vectors for each portal
  private versionVectors: Map<string, Map<string, number>> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Verify user has access to a portal
   */
  async verifyPortalAccess(
    userId: string,
    workspaceId: string,
    portalId: string,
  ): Promise<boolean> {
    try {
      const portal = await this.prisma.portal.findFirst({
        where: {
          id: portalId,
          workspaceId,
        },
      });
      return !!portal;
    } catch (error) {
      this.logger.error(`Error verifying portal access: ${error}`);
      return false;
    }
  }

  /**
   * Transform a change using Operational Transformation (OT)
   * This handles conflict resolution for concurrent edits
   */
  async transformChange(
    portalId: string,
    change: WidgetChange,
  ): Promise<WidgetChange> {
    // Get history for this portal
    const history = this.changeHistory.get(portalId) || [];
    
    // Get version vector for this portal
    if (!this.versionVectors.has(portalId)) {
      this.versionVectors.set(portalId, new Map());
    }
    const versionVector = this.versionVectors.get(portalId)!;
    
    // Get user's last known version
    const userVersion = versionVector.get(change.userId) || 0;
    
    // Find concurrent changes (changes made by others after user's last change)
    const concurrentChanges = history.filter(
      (h) =>
        h.timestamp > userVersion &&
        h.userId !== change.userId &&
        h.widgetId === change.widgetId,
    );

    // Apply transformation based on change type
    let transformedChange = { ...change };
    
    for (const concurrent of concurrentChanges) {
      transformedChange = this.applyTransformation(transformedChange, concurrent);
    }

    // Update version vector
    versionVector.set(change.userId, change.timestamp);

    // Add to history
    history.push(transformedChange);
    this.changeHistory.set(portalId, history);

    // Limit history size
    if (history.length > 1000) {
      this.changeHistory.set(portalId, history.slice(-500));
    }

    return transformedChange;
  }

  /**
   * Apply operational transformation between two changes
   */
  private applyTransformation(
    incoming: WidgetChange,
    existing: WidgetChange,
  ): WidgetChange {
    // Same widget, same change type - need to merge
    if (
      incoming.widgetId === existing.widgetId &&
      incoming.changeType === existing.changeType
    ) {
      switch (incoming.changeType) {
        case 'position':
          // For position changes, last write wins but we could merge
          return {
            ...incoming,
            newValue: {
              ...existing.newValue,
              ...incoming.newValue,
            },
          };

        case 'size':
          // For size changes, merge dimensions
          return {
            ...incoming,
            newValue: {
              width: incoming.newValue.width ?? existing.newValue.width,
              height: incoming.newValue.height ?? existing.newValue.height,
            },
          };

        case 'config':
          // For config changes, deep merge
          return {
            ...incoming,
            newValue: this.deepMerge(existing.newValue, incoming.newValue),
          };

        case 'content':
          // For content changes, we could use CRDT but for now last write wins
          return incoming;

        default:
          return incoming;
      }
    }

    return incoming;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || typeof source !== 'object') {
      return source;
    }

    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * Save change to history for undo/redo support
   */
  async saveChangeHistory(
    portalId: string,
    change: WidgetChange,
  ): Promise<void> {
    try {
      // Store in Redis for persistence
      const key = `collaboration:history:${portalId}`;
      const historyJson = await this.cache.get(key);
      const history: WidgetChange[] = historyJson ? JSON.parse(historyJson) : [];
      
      history.push(change);
      
      // Keep last 100 changes per portal
      const trimmedHistory = history.slice(-100);
      
      await this.cache.set(key, JSON.stringify(trimmedHistory), 3600); // 1 hour TTL
    } catch (error) {
      this.logger.error(`Error saving change history: ${error}`);
    }
  }

  /**
   * Get change history for a portal
   */
  async getChangeHistory(
    portalId: string,
    limit: number = 50,
  ): Promise<WidgetChange[]> {
    try {
      const key = `collaboration:history:${portalId}`;
      const historyJson = await this.cache.get(key);
      const history: WidgetChange[] = historyJson ? JSON.parse(historyJson) : [];
      return history.slice(-limit);
    } catch (error) {
      this.logger.error(`Error getting change history: ${error}`);
      return [];
    }
  }

  /**
   * Log collaboration activity
   */
  async logActivity(activity: ActivityLog): Promise<void> {
    try {
      const key = `collaboration:activity:${activity.portalId}`;
      const activityJson = await this.cache.get(key);
      const activities: ActivityLog[] = activityJson ? JSON.parse(activityJson) : [];
      
      activities.push(activity);
      
      // Keep last 200 activities per portal
      const trimmedActivities = activities.slice(-200);
      
      await this.cache.set(key, JSON.stringify(trimmedActivities), 86400); // 24 hour TTL
    } catch (error) {
      this.logger.error(`Error logging activity: ${error}`);
    }
  }

  /**
   * Get activity feed for a portal
   */
  async getActivityFeed(
    portalId: string,
    limit: number = 50,
  ): Promise<ActivityLog[]> {
    try {
      const key = `collaboration:activity:${portalId}`;
      const activityJson = await this.cache.get(key);
      const activities: ActivityLog[] = activityJson ? JSON.parse(activityJson) : [];
      return activities.slice(-limit).reverse();
    } catch (error) {
      this.logger.error(`Error getting activity feed: ${error}`);
      return [];
    }
  }

  /**
   * Save chat message
   */
  async saveChatMessage(portalId: string, message: ChatMessage): Promise<void> {
    try {
      const key = `collaboration:chat:${portalId}`;
      const messagesJson = await this.cache.get(key);
      const messages: ChatMessage[] = messagesJson ? JSON.parse(messagesJson) : [];
      
      messages.push(message);
      
      // Keep last 500 messages per portal
      const trimmedMessages = messages.slice(-500);
      
      await this.cache.set(key, JSON.stringify(trimmedMessages), 86400); // 24 hour TTL
    } catch (error) {
      this.logger.error(`Error saving chat message: ${error}`);
    }
  }

  /**
   * Get chat messages for a portal
   */
  async getChatMessages(
    portalId: string,
    limit: number = 100,
  ): Promise<ChatMessage[]> {
    try {
      const key = `collaboration:chat:${portalId}`;
      const messagesJson = await this.cache.get(key);
      const messages: ChatMessage[] = messagesJson ? JSON.parse(messagesJson) : [];
      return messages.slice(-limit);
    } catch (error) {
      this.logger.error(`Error getting chat messages: ${error}`);
      return [];
    }
  }

  /**
   * Get collaboration statistics for a portal
   */
  async getCollaborationStats(portalId: string): Promise<{
    totalEdits: number;
    activeUsers: number;
    recentActivity: number;
  }> {
    try {
      const [historyJson, activityJson] = await Promise.all([
        this.cache.get(`collaboration:history:${portalId}`),
        this.cache.get(`collaboration:activity:${portalId}`),
      ]);

      const history: WidgetChange[] = historyJson ? JSON.parse(historyJson) : [];
      const activities: ActivityLog[] = activityJson ? JSON.parse(activityJson) : [];

      // Count unique users in last hour
      const oneHourAgo = Date.now() - 3600000;
      const recentActivities = activities.filter(
        (a) => new Date(a.timestamp).getTime() > oneHourAgo,
      );
      const activeUsers = new Set(recentActivities.map((a) => a.odId)).size;

      return {
        totalEdits: history.length,
        activeUsers,
        recentActivity: recentActivities.length,
      };
    } catch (error) {
      this.logger.error(`Error getting collaboration stats: ${error}`);
      return { totalEdits: 0, activeUsers: 0, recentActivity: 0 };
    }
  }

  /**
   * Clear collaboration data for a portal
   */
  async clearCollaborationData(portalId: string): Promise<void> {
    try {
      await Promise.all([
        this.cache.del(`collaboration:history:${portalId}`),
        this.cache.del(`collaboration:activity:${portalId}`),
        this.cache.del(`collaboration:chat:${portalId}`),
      ]);
      
      this.changeHistory.delete(portalId);
      this.versionVectors.delete(portalId);
    } catch (error) {
      this.logger.error(`Error clearing collaboration data: ${error}`);
    }
  }
}
