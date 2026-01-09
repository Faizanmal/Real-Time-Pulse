import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWidgetTemplateDto,
  UpdateWidgetTemplateDto,
  CreatePortalTemplateDto,
  UpdatePortalTemplateDto,
} from './dto/template.dto';
import { TemplateCategory, WidgetType } from '@prisma/client';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Widget Templates
  // ============================================

  /**
   * Create a widget template
   */
  async createWidgetTemplate(
    workspaceId: string,
    userId: string,
    dto: CreateWidgetTemplateDto,
  ) {
    const template = await this.prisma.widgetTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        thumbnail: dto.thumbnail,
        widgetType: dto.widgetType,
        config: dto.config,
        layout: dto.layout,
        isPublic: dto.isPublic ?? false,
        workspaceId: dto.isPublic ? null : workspaceId,
        createdById: userId,
        tags: dto.tags || [],
      },
    });

    this.logger.log(`Widget template created: ${template.id}`);
    return template;
  }

  /**
   * Get widget templates (public + workspace)
   */
  async findWidgetTemplates(
    workspaceId: string,
    _options?: {
      category?: TemplateCategory;
      widgetType?: string;
      search?: string;
      publicOnly?: boolean;
    },
  ) {
    const { category, widgetType, search, publicOnly } = _options || {};

    return this.prisma.widgetTemplate.findMany({
      where: {
        AND: [
          // Include public templates OR workspace templates
          publicOnly
            ? { isPublic: true }
            : {
                OR: [{ isPublic: true }, { workspaceId }],
              },
          ...(category ? [{ category }] : []),
          ...(widgetType ? [{ widgetType: widgetType as WidgetType }] : []),
          ...(search
            ? [
                {
                  OR: [
                    {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                    {
                      description: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                    { tags: { has: search } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a widget template
   */
  async findWidgetTemplate(id: string, workspaceId: string) {
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Widget template not found');
    }

    // Check access: public or same workspace
    if (!template.isPublic && template.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied');
    }

    return template;
  }

  /**
   * Update a widget template
   */
  async updateWidgetTemplate(
    id: string,
    workspaceId: string,
    dto: UpdateWidgetTemplateDto,
  ) {
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Widget template not found');
    }

    // Only workspace templates can be edited
    if (template.workspaceId !== workspaceId) {
      throw new ForbiddenException('You can only edit your own templates');
    }

    return this.prisma.widgetTemplate.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a widget template
   */
  async deleteWidgetTemplate(id: string, workspaceId: string) {
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Widget template not found');
    }

    if (template.workspaceId !== workspaceId) {
      throw new ForbiddenException('You can only delete your own templates');
    }

    await this.prisma.widgetTemplate.delete({ where: { id } });
    this.logger.log(`Widget template deleted: ${id}`);
    return { message: 'Template deleted successfully' };
  }

  /**
   * Use a widget template (increment usage count and return config)
   */
  async useWidgetTemplate(id: string, workspaceId: string) {
    const template = await this.findWidgetTemplate(id, workspaceId);

    // Increment usage count
    await this.prisma.widgetTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    return {
      widgetType: template.widgetType,
      config: template.config,
      layout: template.layout,
    };
  }

  // ============================================
  // Portal Templates
  // ============================================

  /**
   * Create a portal template
   */
  async createPortalTemplate(
    workspaceId: string,
    userId: string,
    dto: CreatePortalTemplateDto,
  ) {
    const template = await this.prisma.portalTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        thumbnail: dto.thumbnail,
        layout: dto.layout,
        widgetConfigs: dto.widgetConfigs,
        settings: dto.settings,
        isPublic: dto.isPublic ?? false,
        workspaceId: dto.isPublic ? null : workspaceId,
        createdById: userId,
        tags: dto.tags || [],
      },
    });

    this.logger.log(`Portal template created: ${template.id}`);
    return template;
  }

  /**
   * Get portal templates
   */
  async findPortalTemplates(
    workspaceId: string,
    _options?: {
      category?: TemplateCategory;
      search?: string;
      publicOnly?: boolean;
    },
  ) {
    const { category, search, publicOnly } = _options || {};

    return this.prisma.portalTemplate.findMany({
      where: {
        AND: [
          publicOnly
            ? { isPublic: true }
            : {
                OR: [{ isPublic: true }, { workspaceId }],
              },
          ...(category ? [{ category }] : []),
          ...(search
            ? [
                {
                  OR: [
                    {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                    {
                      description: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                    { tags: { has: search } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a portal template
   */
  async findPortalTemplate(id: string, workspaceId: string) {
    const template = await this.prisma.portalTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Portal template not found');
    }

    if (!template.isPublic && template.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied');
    }

    return template;
  }

  /**
   * Update a portal template
   */
  async updatePortalTemplate(
    id: string,
    workspaceId: string,
    dto: UpdatePortalTemplateDto,
  ) {
    const template = await this.prisma.portalTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Portal template not found');
    }

    if (template.workspaceId !== workspaceId) {
      throw new ForbiddenException('You can only edit your own templates');
    }

    return this.prisma.portalTemplate.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a portal template
   */
  async deletePortalTemplate(id: string, workspaceId: string) {
    const template = await this.prisma.portalTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Portal template not found');
    }

    if (template.workspaceId !== workspaceId) {
      throw new ForbiddenException('You can only delete your own templates');
    }

    await this.prisma.portalTemplate.delete({ where: { id } });
    this.logger.log(`Portal template deleted: ${id}`);
    return { message: 'Template deleted successfully' };
  }

  /**
   * Use a portal template
   */
  async usePortalTemplate(id: string, workspaceId: string) {
    const template = await this.findPortalTemplate(id, workspaceId);

    await this.prisma.portalTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    return {
      layout: template.layout,
      widgetConfigs: template.widgetConfigs,
      settings: template.settings,
    };
  }

  /**
   * Create portal from template
   */
  async createPortalFromTemplate(
    templateId: string,
    workspaceId: string,
    userId: string,
    portalData: { name: string; slug: string; description?: string },
  ) {
    const template = await this.usePortalTemplate(templateId, workspaceId);

    // Create portal with template configuration
    const portal = await this.prisma.portal.create({
      data: {
        workspaceId,
        name: portalData.name,
        slug: portalData.slug,
        description: portalData.description,
        layout: template.layout as any,
        createdById: userId,
      },
    });

    // Create widgets from template
    const widgetConfigs = template.widgetConfigs as {
      name?: string;
      type: string;
      config?: Record<string, unknown>;
      gridX?: number;
      gridY?: number;
      gridWidth?: number;
      gridHeight?: number;
    }[];
    if (widgetConfigs && widgetConfigs.length > 0) {
      await this.prisma.widget.createMany({
        data: widgetConfigs.map((config, index) => ({
          portalId: portal.id,
          name: config.name || `Widget ${index + 1}`,
          type: config.type as WidgetType,
          config: (config.config as any) || {},
          gridX: config.gridX || 0,
          gridY: config.gridY || index * 4,
          gridWidth: config.gridWidth || 4,
          gridHeight: config.gridHeight || 4,
          order: index,
        })),
      });
    }

    return this.prisma.portal.findUnique({
      where: { id: portal.id },
      include: { widgets: true },
    });
  }

  // ============================================
  // Template Categories
  // ============================================

  /**
   * Get available template categories with counts
   */
  async getCategories() {
    const [widgetCounts, portalCounts] = await Promise.all([
      this.prisma.widgetTemplate.groupBy({
        by: ['category'],
        _count: true,
        where: { isPublic: true },
      }),
      this.prisma.portalTemplate.groupBy({
        by: ['category'],
        _count: true,
        where: { isPublic: true },
      }),
    ]);

    const categories = [
      'PROJECT_MANAGEMENT',
      'ANALYTICS',
      'TIME_TRACKING',
      'MARKETING',
      'SALES',
      'DEVELOPMENT',
      'CUSTOM',
    ];

    return categories.map((category) => ({
      category,
      widgetTemplates:
        widgetCounts.find((c) => c.category === category)?._count || 0,
      portalTemplates:
        portalCounts.find((c) => c.category === category)?._count || 0,
    }));
  }
}
