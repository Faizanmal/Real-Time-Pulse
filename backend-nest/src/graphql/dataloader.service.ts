/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX DATALOADER SERVICE
 * ============================================================================
 * Efficient data loading with batching and caching to solve N+1 problems
 * in GraphQL queries.
 */

import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '../prisma/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class DataLoaderService {
  // User DataLoader
  private readonly userLoader: DataLoader<string, any>;
  
  // Workspace DataLoader
  private readonly workspaceLoader: DataLoader<string, any>;
  
  // Portal DataLoader
  private readonly portalLoader: DataLoader<string, any>;
  
  // Widget DataLoader
  private readonly widgetLoader: DataLoader<string, any>;
  
  // Widgets by Portal ID DataLoader
  private readonly widgetsByPortalLoader: DataLoader<string, any[]>;
  
  // Integration DataLoader
  private readonly integrationLoader: DataLoader<string, any>;
  
  // Alert DataLoader
  private readonly alertLoader: DataLoader<string, any>;
  
  // Comment DataLoader
  private readonly commentLoader: DataLoader<string, any>;

  constructor(private readonly prisma: PrismaService) {
    // Initialize all data loaders
    this.userLoader = this.createUserLoader();
    this.workspaceLoader = this.createWorkspaceLoader();
    this.portalLoader = this.createPortalLoader();
    this.widgetLoader = this.createWidgetLoader();
    this.widgetsByPortalLoader = this.createWidgetsByPortalLoader();
    this.integrationLoader = this.createIntegrationLoader();
    this.alertLoader = this.createAlertLoader();
    this.commentLoader = this.createCommentLoader();
  }

  // ============================================
  // PUBLIC ACCESSOR METHODS
  // ============================================

  async getUserById(id: string): Promise<any> {
    return this.userLoader.load(id);
  }

  async getUsersByIds(ids: string[]): Promise<any[]> {
    return this.userLoader.loadMany(ids);
  }

  async getWorkspaceById(id: string): Promise<any> {
    return this.workspaceLoader.load(id);
  }

  async getPortalById(id: string): Promise<any> {
    return this.portalLoader.load(id);
  }

  async getPortalsByIds(ids: string[]): Promise<any[]> {
    return this.portalLoader.loadMany(ids);
  }

  async getWidgetById(id: string): Promise<any> {
    return this.widgetLoader.load(id);
  }

  async getWidgetsByPortalId(portalId: string): Promise<any[]> {
    return this.widgetsByPortalLoader.load(portalId);
  }

  async getIntegrationById(id: string): Promise<any> {
    return this.integrationLoader.load(id);
  }

  async getAlertById(id: string): Promise<any> {
    return this.alertLoader.load(id);
  }

  async getCommentById(id: string): Promise<any> {
    return this.commentLoader.load(id);
  }

  // ============================================
  // DATALOADER FACTORY METHODS
  // ============================================

  private createUserLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const users = await this.prisma.user.findMany({
          where: { id: { in: [...ids] } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            avatar: true,
            role: true,
            workspaceId: true,
            createdAt: true,
            lastLoginAt: true,
          },
        });

        // Create a map for O(1) lookup
        const userMap = new Map(users.map(user => [user.id, user]));
        
        // Return users in the same order as the input ids
        return ids.map(id => userMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  private createWorkspaceLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const workspaces = await this.prisma.workspace.findMany({
          where: { id: { in: [...ids] } },
        });

        const workspaceMap = new Map(workspaces.map(ws => [ws.id, ws]));
        return ids.map(id => workspaceMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 50,
      },
    );
  }

  private createPortalLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const portals = await this.prisma.portal.findMany({
          where: { id: { in: [...ids] } },
        });

        const portalMap = new Map(portals.map(p => [p.id, p]));
        return ids.map(id => portalMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  private createWidgetLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const widgets = await this.prisma.widget.findMany({
          where: { id: { in: [...ids] } },
        });

        const widgetMap = new Map(widgets.map(w => [w.id, w]));
        return ids.map(id => widgetMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 200,
      },
    );
  }

  private createWidgetsByPortalLoader(): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(
      async (portalIds: readonly string[]) => {
        const widgets = await this.prisma.widget.findMany({
          where: { portalId: { in: [...portalIds] } },
          orderBy: { order: 'asc' },
        });

        // Group widgets by portal ID
        const widgetsByPortal = new Map<string, any[]>();
        for (const portalId of portalIds) {
          widgetsByPortal.set(portalId, []);
        }
        for (const widget of widgets) {
          widgetsByPortal.get(widget.portalId)?.push(widget);
        }

        return portalIds.map(id => widgetsByPortal.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 50,
      },
    );
  }

  private createIntegrationLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const integrations = await this.prisma.integration.findMany({
          where: { id: { in: [...ids] } },
        });

        const integrationMap = new Map(integrations.map(i => [i.id, i]));
        return ids.map(id => integrationMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 50,
      },
    );
  }

  private createAlertLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const alerts = await this.prisma.alert.findMany({
          where: { id: { in: [...ids] } },
        });

        const alertMap = new Map(alerts.map(a => [a.id, a]));
        return ids.map(id => alertMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  private createCommentLoader(): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (ids: readonly string[]) => {
        const comments = await this.prisma.comment.findMany({
          where: { id: { in: [...ids] } },
        });

        const commentMap = new Map(comments.map(c => [c.id, c]));
        return ids.map(id => commentMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 200,
      },
    );
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  clearUserCache(userId?: string): void {
    if (userId) {
      this.userLoader.clear(userId);
    } else {
      this.userLoader.clearAll();
    }
  }

  clearPortalCache(portalId?: string): void {
    if (portalId) {
      this.portalLoader.clear(portalId);
      this.widgetsByPortalLoader.clear(portalId);
    } else {
      this.portalLoader.clearAll();
      this.widgetsByPortalLoader.clearAll();
    }
  }

  clearWidgetCache(widgetId?: string): void {
    if (widgetId) {
      this.widgetLoader.clear(widgetId);
    } else {
      this.widgetLoader.clearAll();
    }
  }

  clearAllCaches(): void {
    this.userLoader.clearAll();
    this.workspaceLoader.clearAll();
    this.portalLoader.clearAll();
    this.widgetLoader.clearAll();
    this.widgetsByPortalLoader.clearAll();
    this.integrationLoader.clearAll();
    this.alertLoader.clearAll();
    this.commentLoader.clearAll();
  }

  // Prime the cache with known data
  primeUserCache(user: any): void {
    this.userLoader.prime(user.id, user);
  }

  primePortalCache(portal: any): void {
    this.portalLoader.prime(portal.id, portal);
  }

  primeWidgetCache(widget: any): void {
    this.widgetLoader.prime(widget.id, widget);
  }
}
