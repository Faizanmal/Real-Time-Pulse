import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { CreateShareLinkDto, UpdateShareLinkDto } from './dto/share-link.dto';

@Injectable()
export class ShareLinksService {
  private readonly logger = new Logger(ShareLinksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a share link for a portal
   */
  async create(workspaceId: string, userId: string, dto: CreateShareLinkDto) {
    // Verify portal exists and belongs to workspace
    const portal = await this.prisma.portal.findFirst({
      where: { id: dto.portalId, workspaceId },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    const shareLink = await this.prisma.shareLink.create({
      data: {
        portalId: dto.portalId,
        token: uuidv4(),
        password: hashedPassword,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxViews: dto.maxViews,
        allowExport: dto.allowExport ?? false,
        allowComments: dto.allowComments ?? false,
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    this.logger.log(`Share link created: ${shareLink.id} for portal ${dto.portalId}`);

    return {
      ...shareLink,
      shareUrl: this.generateShareUrl(shareLink.token),
    };
  }

  /**
   * Get all share links for a workspace
   */
  async findAll(workspaceId: string, portalId?: string) {
    const links = await this.prisma.shareLink.findMany({
      where: {
        portal: { workspaceId },
        ...(portalId && { portalId }),
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      ...link,
      shareUrl: this.generateShareUrl(link.token),
      hasPassword: !!link.password,
      password: undefined, // Don't expose password hash
    }));
  }

  /**
   * Get a single share link
   */
  async findOne(id: string, workspaceId: string) {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    return {
      ...link,
      shareUrl: this.generateShareUrl(link.token),
      hasPassword: !!link.password,
      password: undefined,
    };
  }

  /**
   * Update a share link
   */
  async update(id: string, workspaceId: string, dto: UpdateShareLinkDto) {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    // Handle password update
    let password = link.password;
    if (dto.password !== undefined) {
      password = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    }

    const updated = await this.prisma.shareLink.update({
      where: { id },
      data: {
        password,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        maxViews: dto.maxViews,
        allowExport: dto.allowExport,
        allowComments: dto.allowComments,
        isActive: dto.isActive,
      },
      include: {
        portal: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return {
      ...updated,
      shareUrl: this.generateShareUrl(updated.token),
      hasPassword: !!updated.password,
      password: undefined,
    };
  }

  /**
   * Delete a share link
   */
  async delete(id: string, workspaceId: string) {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    await this.prisma.shareLink.delete({ where: { id } });
    this.logger.log(`Share link deleted: ${id}`);
    return { message: 'Share link deleted successfully' };
  }

  /**
   * Regenerate share link token
   */
  async regenerateToken(id: string, workspaceId: string) {
    const link = await this.prisma.shareLink.findFirst({
      where: {
        id,
        portal: { workspaceId },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const newToken = uuidv4();
    const updated = await this.prisma.shareLink.update({
      where: { id },
      data: {
        token: newToken,
        currentViews: 0, // Reset view count
      },
    });

    return {
      token: newToken,
      shareUrl: this.generateShareUrl(newToken),
    };
  }

  /**
   * Access a shared portal (public endpoint)
   */
  async accessSharedPortal(token: string, password?: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        portal: {
          include: {
            widgets: {
              include: {
                integration: {
                  select: { provider: true, status: true },
                },
              },
              orderBy: { order: 'asc' },
            },
            workspace: {
              select: { name: true, logo: true, primaryColor: true },
            },
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found or expired');
    }

    // Check if active
    if (!link.isActive) {
      throw new ForbiddenException('This share link has been deactivated');
    }

    // Check expiration
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new ForbiddenException('This share link has expired');
    }

    // Check view limit
    if (link.maxViews && link.currentViews >= link.maxViews) {
      throw new ForbiddenException('This share link has reached its view limit');
    }

    // Check password
    if (link.password) {
      if (!password) {
        throw new BadRequestException('Password required');
      }
      const isValid = await bcrypt.compare(password, link.password);
      if (!isValid) {
        throw new ForbiddenException('Invalid password');
      }
    }

    // Increment view count
    await this.prisma.shareLink.update({
      where: { id: link.id },
      data: {
        currentViews: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    // Return portal data
    return {
      portal: {
        id: link.portal.id,
        name: link.portal.name,
        description: link.portal.description,
        layout: link.portal.layout,
        widgets: link.portal.widgets,
        workspace: link.portal.workspace,
      },
      permissions: {
        allowExport: link.allowExport,
        allowComments: link.allowComments,
      },
    };
  }

  /**
   * Check if password is required for a share link
   */
  async checkPasswordRequired(token: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      select: { password: true, isActive: true, expiresAt: true },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Share link not found or inactive');
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new ForbiddenException('This share link has expired');
    }

    return {
      passwordRequired: !!link.password,
    };
  }

  /**
   * Generate share URL
   */
  private generateShareUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return `${baseUrl}/share/${token}`;
  }
}
