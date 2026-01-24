import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortalDto, UpdatePortalDto, PortalResponseDto } from './dto/portal.dto';
import { v4 as uuidv4 } from 'uuid';
import { Prisma, Portal, User, Subscription } from '@prisma/client';

// Define the include object for reuse.
// This ensures all portal queries fetch the same related data.
const portalInclude = {
  workspace: {
    select: {
      id: true,
      name: true,
      logo: true,
      primaryColor: true,
    },
  },
  _count: {
    select: { widgets: true },
  },
};

// Define the type for the portal object returned by our queries.
// It's a `Portal` plus the fields from `portalInclude`.
type PortalWithDetails = Prisma.PortalGetPayload<{
  include: typeof portalInclude;
}>;

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new portal
   */
  async create(
    workspaceId: string,
    userId: string,
    dto: CreatePortalDto,
  ): Promise<PortalResponseDto> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Check if slug already exists in this workspace
    // No `as any` needed. Use the properly typed prisma client.
    const existingPortal: Portal | null = await this.prisma.portal.findFirst({
      where: {
        workspaceId,
        slug: dto.slug,
      },
    });

    if (existingPortal) {
      throw new ConflictException('Portal slug already exists in this workspace');
    }

    // Check subscription limits
    const subscription: Subscription | null = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    const portalCount: number = await this.prisma.portal.count({
      where: { workspaceId },
    });

    if (subscription && portalCount >= subscription.maxPortals) {
      throw new BadRequestException(
        `Portal limit reached. Upgrade your plan to create more portals.`,
      );
    }

    // Generate unique share token
    const shareToken = this.generateShareToken();

    // Create portal
    // The result is typed as `PortalWithDetails` because of the `include`
    const portal = (await this.prisma.portal.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        shareToken,
        isPublic: dto.isPublic ?? false,
        // Use `dto.layout ?? {}` as in original, assuming layout is non-nullable JSON
        layout: dto.layout ?? {},
        workspaceId,
        createdById: userId,
      },
      include: portalInclude, // Use the reusable include
    })) as PortalWithDetails;

    return this.formatPortalResponse(portal);
  }

  /**
   * Get all portals for a workspace with pagination
   */
  async findAll(
    workspaceId: string,
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ portals: PortalResponseDto[]; total: number }> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    const skip = (page - 1) * pageSize;

    // `Promise.all` correctly infers the types
    const [portals, total] = await Promise.all([
      this.prisma.portal.findMany({
        where: { workspaceId },
        include: portalInclude, // Use the reusable include
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.portal.count({
        where: { workspaceId },
      }),
    ]);

    return {
      // `p` is inferred as `PortalWithDetails`
      portals: portals.map((p) => this.formatPortalResponse(p)),
      total,
    };
  }

  /**
   * Get a single portal by ID
   */
  async findOne(portalId: string, workspaceId: string, userId: string): Promise<PortalResponseDto> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Type the result explicitly as it can be null
    const portal: PortalWithDetails | null = await this.prisma.portal.findUnique({
      where: { id: portalId },
      include: portalInclude, // Use the reusable include
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    return this.formatPortalResponse(portal);
  }

  /**
   * Get portal by share token (public access)
   */
  async findByShareToken(shareToken: string): Promise<PortalResponseDto> {
    // This query now uses `portalInclude` to fetch `_count`
    // instead of the unused `widgets` list, fixing a logic bug.
    const portal: PortalWithDetails | null = await this.prisma.portal.findUnique({
      where: { shareToken },
      include: portalInclude, // Use the reusable include
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    return this.formatPortalResponse(portal);
  }

  /**
   * Update a portal
   */
  async update(
    portalId: string,
    workspaceId: string,
    userId: string,
    dto: UpdatePortalDto,
  ): Promise<PortalResponseDto> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Verify portal exists and belongs to workspace
    const existingPortal: Portal | null = await this.prisma.portal.findUnique({
      where: { id: portalId },
    });

    if (!existingPortal) {
      throw new NotFoundException('Portal not found');
    }

    if (existingPortal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    // `dto.layout` can be `undefined`, which Prisma's update
    // correctly interprets as "do not update this field".
    const portal: PortalWithDetails = await this.prisma.portal.update({
      where: { id: portalId },
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
        layout: dto.layout,
      },
      include: portalInclude, // Use the reusable include
    });

    return this.formatPortalResponse(portal);
  }

  /**
   * Delete a portal
   */
  async remove(portalId: string, workspaceId: string, userId: string): Promise<void> {
    // Verify user belongs to workspace with proper permissions
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    // Verify portal exists and belongs to workspace
    const portal: Portal | null = await this.prisma.portal.findUnique({
      where: { id: portalId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    // Delete portal (cascade will delete widgets)
    await this.prisma.portal.delete({
      where: { id: portalId },
    });
  }

  /**
   * Regenerate share token for a portal
   */
  async regenerateShareToken(
    portalId: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ shareToken: string }> {
    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Verify portal exists and belongs to workspace
    const portal: Portal | null = await this.prisma.portal.findUnique({
      where: { id: portalId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    if (portal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this portal');
    }

    const newShareToken = this.generateShareToken();

    await this.prisma.portal.update({
      where: { id: portalId },
      data: { shareToken: newShareToken },
    });

    return { shareToken: newShareToken };
  }

  /**
   * Generate a unique share token
   */
  private generateShareToken(): string {
    return uuidv4();
  }

  /**
   * Verify user belongs to workspace
   */
  private async verifyUserInWorkspace(userId: string, workspaceId: string): Promise<void> {
    // Type the user result
    const user: User | null = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this workspace');
    }
  }

  /**
   * Verify user has required permissions in workspace
   */
  private async verifyUserPermission(
    userId: string,
    workspaceId: string,
    allowedRoles: string[],
  ): Promise<void> {
    // Type the user result
    const user: User | null = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    // Assuming user.role is a string.
    // If it's an enum, you might need to adjust `allowedRoles` type.
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Format portal response
   * This function is now strongly typed.
   */
  private formatPortalResponse(portal: PortalWithDetails): PortalResponseDto {
    return {
      id: portal.id,
      name: portal.name,
      slug: portal.slug,
      description: portal.description,
      shareToken: portal.shareToken,
      isPublic: portal.isPublic,

      layout: portal.layout as Record<string, any> | null, // `layout` is of type JsonValue
      workspaceId: portal.workspaceId,
      createdAt: portal.createdAt,
      updatedAt: portal.updatedAt,
      workspace: portal.workspace, // This is guaranteed to exist and be correctly shaped
      widgetCount: portal._count?.widgets, // This is now safe and guaranteed to be a number
    };
  }
}
