/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX PORTAL GRAPHQL RESOLVER
 * ============================================================================
 * GraphQL resolver for Portal operations with subscriptions and data loading.
 */

import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Args,
  ID,
  ResolveField,
  Parent,
  Int,
  Context,
} from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { DataLoaderService } from '../dataloader.service';

// GraphQL Object Types (would be defined in separate files)
import {
  PortalType,
  WidgetType,
  CreatePortalInput,
  UpdatePortalInput,
  PortalConnection,
  PortalFilterInput,
  PortalSortInput,
} from '../types';

const pubSub = new PubSub();

@Resolver(() => PortalType)
export class PortalResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataLoader: DataLoaderService,
  ) {}

  // ============================================
  // QUERIES
  // ============================================

  @Query(() => PortalType, {
    nullable: true,
    description: 'Get a portal by ID',
  })
  @UseGuards(GqlAuthGuard)
  async portal(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.prisma.portal.findFirst({
      where: {
        id,
        workspaceId: user.workspaceId,
      },
    });
  }

  @Query(() => PortalConnection, { description: 'Get paginated portals' })
  @UseGuards(GqlAuthGuard)
  async portals(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 10 })
    first: number,
    @Args('after', { nullable: true }) after: string,
    @Args('filter', { nullable: true }) filter: PortalFilterInput,
    @Args('sort', { nullable: true }) sort: PortalSortInput,
    @CurrentUser() user: any,
  ): Promise<any> {
    const where: any = { workspaceId: user.workspaceId };

    // Apply filters
    if (filter) {
      if (filter.search) {
        where.OR = [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
        ];
      }
      if (filter.isPublic !== undefined) {
        where.isPublic = filter.isPublic;
      }
      if (filter.createdAfter) {
        where.createdAt = { gte: new Date(filter.createdAfter) };
      }
      if (filter.createdBefore) {
        where.createdAt = {
          ...where.createdAt,
          lte: new Date(filter.createdBefore),
        };
      }
    }

    // Apply cursor pagination
    let cursor: any;
    if (after) {
      cursor = { id: after };
    }

    // Apply sorting
    const orderBy: any = {};
    if (sort && sort.field) {
      orderBy[sort.field] = sort.direction;
    } else {
      orderBy.createdAt = 'desc';
    }

    const portals = await this.prisma.portal.findMany({
      where,
      take: first + 1, // Get one extra to check for next page
      ...(cursor && { cursor, skip: 1 }),
      orderBy,
    });

    const hasNextPage = portals.length > first;
    const edges = portals.slice(0, first).map((portal) => ({
      cursor: portal.id,
      node: portal,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: await this.prisma.portal.count({
        where: { workspaceId: user.workspaceId },
      }),
    };
  }

  @Query(() => [PortalType], { description: 'Get recent portals' })
  @UseGuards(GqlAuthGuard)
  async recentPortals(
    @Args('limit', { type: () => Int, defaultValue: 5 }) limit: number,
    @CurrentUser() user: any,
  ): Promise<any[]> {
    return this.prisma.portal.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  @Query(() => PortalType, {
    nullable: true,
    description: 'Get portal by share token (public)',
  })
  async publicPortal(@Args('shareToken') shareToken: string): Promise<any> {
    return this.prisma.portal.findFirst({
      where: {
        shareToken,
        isPublic: true,
      },
    });
  }

  // ============================================
  // MUTATIONS
  // ============================================

  @Mutation(() => PortalType, { description: 'Create a new portal' })
  @UseGuards(GqlAuthGuard)
  async createPortal(
    @Args('input') input: CreatePortalInput,
    @CurrentUser() user: any,
  ): Promise<any> {
    const portal = await this.prisma.portal.create({
      data: {
        name: input.name,
        slug: input.slug || this.generateSlug(input.name),
        description: input.description,
        isPublic: input.isPublic ?? true,
        layout: input.layout || [],
        workspaceId: user.workspaceId,
        createdById: user.id,
      },
    });

    // Publish event for subscriptions
    pubSub.publish('portalCreated', {
      portalCreated: portal,
      workspaceId: user.workspaceId,
    });

    return portal;
  }

  @Mutation(() => PortalType, { description: 'Update a portal' })
  @UseGuards(GqlAuthGuard)
  async updatePortal(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePortalInput,
    @CurrentUser() user: any,
  ): Promise<any> {
    // Verify ownership
    const existing = await this.prisma.portal.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });

    if (!existing) {
      throw new Error('Portal not found');
    }

    const portal = await this.prisma.portal.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        isPublic: input.isPublic,
        layout: input.layout,
      },
    });

    // Publish event for subscriptions
    pubSub.publish('portalUpdated', {
      portalUpdated: portal,
      workspaceId: user.workspaceId,
    });

    return portal;
  }

  @Mutation(() => Boolean, { description: 'Delete a portal' })
  @UseGuards(GqlAuthGuard)
  async deletePortal(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    // Verify ownership
    const existing = await this.prisma.portal.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });

    if (!existing) {
      throw new Error('Portal not found');
    }

    await this.prisma.portal.delete({ where: { id } });

    // Publish event for subscriptions
    pubSub.publish('portalDeleted', {
      portalDeleted: id,
      workspaceId: user.workspaceId,
    });

    return true;
  }

  @Mutation(() => PortalType, { description: 'Duplicate a portal' })
  @UseGuards(GqlAuthGuard)
  async duplicatePortal(
    @Args('id', { type: () => ID }) id: string,
    @Args('newName') newName: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    const original = await this.prisma.portal.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: { widgets: true },
    });

    if (!original) {
      throw new Error('Portal not found');
    }

    // Create new portal
    const newPortal = await this.prisma.portal.create({
      data: {
        name: newName,
        slug: this.generateSlug(newName),
        description: original.description,
        isPublic: original.isPublic,
        layout: original.layout as any,
        workspaceId: user.workspaceId,
        createdById: user.id,
        widgets: {
          create: original.widgets.map((widget) => ({
            name: widget.name,
            type: widget.type,
            config: widget.config as any,
            gridX: widget.gridX,
            gridY: widget.gridY,
            gridWidth: widget.gridWidth,
            gridHeight: widget.gridHeight,
            refreshInterval: widget.refreshInterval,
            order: widget.order,
            integrationId: widget.integrationId,
          })),
        },
      },
    });

    return newPortal;
  }

  // ============================================
  // SUBSCRIPTIONS
  // ============================================

  // @Subscription(() => PortalType, {
  //   description: 'Subscribe to portal creation events',
  //   filter: (payload, variables, context) => {
  //     return payload.workspaceId === context.workspaceId;
  //   },
  // })
  // portalCreated() {
  //   return pubSub.asyncIterator('portalCreated');
  // }

  // @Subscription(() => PortalType, {
  //   description: 'Subscribe to portal update events',
  //   filter: (payload, variables, context) => {
  //     return payload.workspaceId === context.workspaceId;
  //   },
  // })
  // portalUpdated() {
  //   return pubSub.asyncIterator('portalUpdated');
  // }

  // @Subscription(() => ID, {
  //   description: 'Subscribe to portal deletion events',
  //   filter: (payload, variables, context) => {
  //     return payload.workspaceId === context.workspaceId;
  //   },
  // })
  // portalDeleted() {
  //   return pubSub.asyncIterator('portalDeleted');
  // }

  // ============================================
  // FIELD RESOLVERS (with DataLoader)
  // ============================================

  @ResolveField('widgets', () => [WidgetType])
  async widgets(
    @Parent() portal: any,
    @Context() context: any,
  ): Promise<any[]> {
    return this.dataLoader.getWidgetsByPortalId(portal.id);
  }

  @ResolveField('createdBy')
  async createdBy(
    @Parent() portal: any,
    @Context() context: any,
  ): Promise<any> {
    return this.dataLoader.getUserById(portal.createdById);
  }

  @ResolveField('workspace')
  async workspace(
    @Parent() portal: any,
    @Context() context: any,
  ): Promise<any> {
    return this.dataLoader.getWorkspaceById(portal.workspaceId);
  }

  @ResolveField('widgetCount', () => Int)
  async widgetCount(@Parent() portal: any): Promise<number> {
    return this.prisma.widget.count({
      where: { portalId: portal.id },
    });
  }

  @ResolveField('shareUrl')
  shareUrl(@Parent() portal: any): string {
    const baseUrl = process.env.PUBLIC_URL || 'https://app.realtimepulse.io';
    return `${baseUrl}/v/${portal.shareToken}`;
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString(36)
    );
  }
}
