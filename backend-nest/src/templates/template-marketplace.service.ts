/**
 * Template Marketplace Service
 * Provides dashboard and widget template sharing and discovery
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { v4 as uuidv4 } from 'uuid';

interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  type: 'dashboard' | 'widget' | 'portal';
  thumbnail: string;
  previewImages: string[];
  data: any; // Template configuration data
  
  // Author
  authorId: string;
  author?: { id: string; name: string; avatar?: string };
  
  // Metadata
  tags: string[];
  industry?: string;
  useCase?: string;
  
  // Stats
  downloads: number;
  rating: number;
  ratingCount: number;
  
  // Pricing
  isPremium: boolean;
  price?: number;
  
  // Dates
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  
  // Status
  status: 'draft' | 'pending_review' | 'published' | 'rejected';
}

type TemplateCategory =
  | 'analytics'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'operations'
  | 'hr'
  | 'customer-success'
  | 'product'
  | 'engineering'
  | 'executive'
  | 'other';

interface TemplateSearchOptions {
  query?: string;
  category?: TemplateCategory;
  type?: 'dashboard' | 'widget' | 'portal';
  industry?: string;
  tags?: string[];
  isPremium?: boolean;
  sortBy?: 'popular' | 'newest' | 'rating' | 'downloads';
  page?: number;
  limit?: number;
}

interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

@Injectable()
export class TemplateMarketplaceService {
  private readonly categories: { id: TemplateCategory; name: string; icon: string }[];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    this.categories = [
      { id: 'analytics', name: 'Analytics', icon: '📊' },
      { id: 'sales', name: 'Sales', icon: '💰' },
      { id: 'marketing', name: 'Marketing', icon: '📣' },
      { id: 'finance', name: 'Finance', icon: '💵' },
      { id: 'operations', name: 'Operations', icon: '⚙️' },
      { id: 'hr', name: 'Human Resources', icon: '👥' },
      { id: 'customer-success', name: 'Customer Success', icon: '🎯' },
      { id: 'product', name: 'Product', icon: '🚀' },
      { id: 'engineering', name: 'Engineering', icon: '🛠️' },
      { id: 'executive', name: 'Executive', icon: '👔' },
      { id: 'other', name: 'Other', icon: '📁' },
    ];
  }

  // ==================== TEMPLATE DISCOVERY ====================

  /**
   * Search templates
   */
  async searchTemplates(
    options: TemplateSearchOptions,
  ): Promise<{ templates: Template[]; total: number; page: number; totalPages: number }> {
    const { 
      query, 
      category, 
      type, 
      industry, 
      tags, 
      isPremium, 
      sortBy = 'popular',
      page = 1, 
      limit = 20,
    } = options;

    const cacheKey = `templates:search:${JSON.stringify(options)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: any = { status: 'published' };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } },
      ];
    }

    if (category) where.category = category;
    if (type) where.type = type;
    if (industry) where.industry = industry;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };
    if (isPremium !== undefined) where.isPremium = isPremium;

    const orderBy: any = {};
    switch (sortBy) {
      case 'popular':
        orderBy.downloads = 'desc';
        break;
      case 'newest':
        orderBy.publishedAt = 'desc';
        break;
      case 'rating':
        orderBy.rating = 'desc';
        break;
      case 'downloads':
        orderBy.downloads = 'desc';
        break;
    }

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
      }),
      this.prisma.template.count({ where }),
    ]);

    const result = {
      templates: templates as unknown as Template[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };

    await this.cache.set(cacheKey, JSON.stringify(result), 300); // 5 min cache
    return result;
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates(limit: number = 10): Promise<Template[]> {
    const cacheKey = `templates:featured:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const templates = await this.prisma.template.findMany({
      where: { status: 'published', isFeatured: true },
      orderBy: [{ downloads: 'desc' }, { rating: 'desc' }],
      take: limit,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    await this.cache.set(cacheKey, JSON.stringify(templates), 600);
    return templates as unknown as Template[];
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<Template> {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template as unknown as Template;
  }

  /**
   * Get templates by author
   */
  async getAuthorTemplates(authorId: string): Promise<Template[]> {
    const templates = await this.prisma.template.findMany({
      where: { authorId, status: 'published' },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    return templates as unknown as Template[];
  }

  /**
   * Get related templates
   */
  async getRelatedTemplates(templateId: string, limit: number = 5): Promise<Template[]> {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) return [];

    const related = await this.prisma.template.findMany({
      where: {
        id: { not: templateId },
        status: 'published',
        OR: [
          { category: template.category },
          { tags: { hasSome: template.tags as string[] } },
          { industry: template.industry },
        ],
      },
      orderBy: { downloads: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    return related as unknown as Template[];
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  /**
   * Create a new template
   */
  async createTemplate(
    authorId: string,
    data: {
      name: string;
      description: string;
      category: TemplateCategory;
      type: 'dashboard' | 'widget' | 'portal';
      data: any;
      tags?: string[];
      industry?: string;
      useCase?: string;
      isPremium?: boolean;
      price?: number;
    },
  ): Promise<Template> {
    const template = await this.prisma.template.create({
      data: {
        id: uuidv4(),
        ...data,
        authorId,
        thumbnail: '',
        previewImages: [],
        downloads: 0,
        rating: 0,
        ratingCount: 0,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    return template as unknown as Template;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    authorId: string,
    updates: Partial<Template>,
  ): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, authorId },
    });

    if (!template) {
      throw new NotFoundException('Template not found or not authorized');
    }

    const updated = await this.prisma.template.update({
      where: { id: templateId },
      data: {
        ...updates,
        updatedAt: new Date(),
      } as any,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Invalidate cache
    await this.cache.del('templates:*');

    return updated as unknown as Template;
  }

  /**
   * Submit template for review
   */
  async submitForReview(templateId: string, authorId: string): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, authorId, status: 'draft' },
    });

    if (!template) {
      throw new BadRequestException('Template not found or not in draft status');
    }

    // Validate template has required fields
    if (!template.name || !template.description || !template.thumbnail) {
      throw new BadRequestException('Template must have name, description, and thumbnail');
    }

    const updated = await this.prisma.template.update({
      where: { id: templateId },
      data: { status: 'pending_review', updatedAt: new Date() },
    });

    return updated as unknown as Template;
  }

  /**
   * Publish template (admin only)
   */
  async publishTemplate(templateId: string): Promise<Template> {
    const updated = await this.prisma.template.update({
      where: { id: templateId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.cache.del('templates:*');
    return updated as unknown as Template;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, authorId: string): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, authorId },
    });

    if (!template) {
      throw new NotFoundException('Template not found or not authorized');
    }

    await this.prisma.template.delete({ where: { id: templateId } });
    await this.cache.del('templates:*');
  }

  // ==================== TEMPLATE USAGE ====================

  /**
   * Install/use a template
   */
  async installTemplate(
    templateId: string,
    userId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; createdId: string }> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, status: 'published' },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check if premium and user has access
    if (template.isPremium) {
      const hasPurchased = await this.checkTemplatePurchase(templateId, userId);
      if (!hasPurchased) {
        throw new BadRequestException('Please purchase this template first');
      }
    }

    // Create instance from template
    let createdId: string;

    switch (template.type) {
      case 'dashboard':
        const portal = await this.prisma.portal.create({
          data: {
            id: uuidv4(),
            name: `${template.name} (Copy)`,
            description: template.description,
            workspaceId,
            createdById: userId,
            config: template.data,
            templateId,
            createdAt: new Date(),
          },
        });
        createdId = portal.id;
        break;
        
      case 'widget':
        const widget = await this.prisma.widget.create({
          data: {
            id: uuidv4(),
            name: template.name,
            type: template.data?.type || 'custom',
            config: template.data,
            createdById: userId,
            templateId,
            createdAt: new Date(),
          },
        });
        createdId = widget.id;
        break;
        
      default:
        throw new BadRequestException('Unsupported template type');
    }

    // Increment download count
    await this.prisma.template.update({
      where: { id: templateId },
      data: { downloads: { increment: 1 } },
    });

    // Track installation
    await this.prisma.templateInstallation.create({
      data: {
        id: uuidv4(),
        templateId,
        userId,
        workspaceId,
        createdId,
        installedAt: new Date(),
      },
    });

    return { success: true, createdId };
  }

  /**
   * Purchase a premium template
   */
  async purchaseTemplate(
    templateId: string,
    userId: string,
    paymentMethodId: string,
  ): Promise<{ success: boolean; purchaseId: string }> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, status: 'published', isPremium: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check if already purchased
    const existing = await this.prisma.templatePurchase.findFirst({
      where: { templateId, userId },
    });

    if (existing) {
      throw new BadRequestException('Template already purchased');
    }

    // Process payment (would integrate with Stripe)
    const purchaseId = uuidv4();

    // Record purchase
    await this.prisma.templatePurchase.create({
      data: {
        id: purchaseId,
        templateId,
        userId,
        price: template.price || 0,
        purchasedAt: new Date(),
      },
    });

    // Calculate author earnings (e.g., 70% to author)
    const authorEarnings = (template.price || 0) * 0.7;
    await this.prisma.authorEarnings.create({
      data: {
        id: uuidv4(),
        authorId: template.authorId,
        templateId,
        purchaseId,
        amount: authorEarnings,
        createdAt: new Date(),
      },
    });

    return { success: true, purchaseId };
  }

  private async checkTemplatePurchase(templateId: string, userId: string): Promise<boolean> {
    const purchase = await this.prisma.templatePurchase.findFirst({
      where: { templateId, userId },
    });
    return !!purchase;
  }

  // ==================== REVIEWS & RATINGS ====================

  /**
   * Add a review
   */
  async addReview(
    templateId: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<TemplateReview> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if user has used the template
    const installation = await this.prisma.templateInstallation.findFirst({
      where: { templateId, userId },
    });

    if (!installation) {
      throw new BadRequestException('You must use the template before reviewing');
    }

    // Check for existing review
    const existing = await this.prisma.templateReview.findFirst({
      where: { templateId, userId },
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this template');
    }

    const review = await this.prisma.templateReview.create({
      data: {
        id: uuidv4(),
        templateId,
        userId,
        rating,
        comment,
        createdAt: new Date(),
      },
    });

    // Update template rating
    await this.updateTemplateRating(templateId);

    return review as unknown as TemplateReview;
  }

  /**
   * Get reviews for a template
   */
  async getReviews(templateId: string): Promise<TemplateReview[]> {
    const reviews = await this.prisma.templateReview.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    return reviews as unknown as TemplateReview[];
  }

  private async updateTemplateRating(templateId: string): Promise<void> {
    const result = await this.prisma.templateReview.aggregate({
      where: { templateId },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.template.update({
      where: { id: templateId },
      data: {
        rating: result._avg.rating || 0,
        ratingCount: result._count,
      },
    });
  }

  // ==================== UTILITIES ====================

  /**
   * Get categories
   */
  getCategories(): { id: TemplateCategory; name: string; icon: string }[] {
    return this.categories;
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const cacheKey = `templates:tags:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const templates = await this.prisma.template.findMany({
      where: { status: 'published' },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const template of templates) {
      for (const tag of (template.tags as string[]) || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    await this.cache.set(cacheKey, JSON.stringify(tags), 3600);
    return tags;
  }

  /**
   * Get template statistics
   */
  async getMarketplaceStats(): Promise<{
    totalTemplates: number;
    totalDownloads: number;
    totalAuthors: number;
    categoryCounts: Record<string, number>;
  }> {
    const [totalTemplates, totalDownloads, authorCount, categoryData] = await Promise.all([
      this.prisma.template.count({ where: { status: 'published' } }),
      this.prisma.template.aggregate({
        where: { status: 'published' },
        _sum: { downloads: true },
      }),
      this.prisma.template.groupBy({
        by: ['authorId'],
        where: { status: 'published' },
      }),
      this.prisma.template.groupBy({
        by: ['category'],
        where: { status: 'published' },
        _count: true,
      }),
    ]);

    const categoryCounts: Record<string, number> = {};
    for (const item of categoryData) {
      categoryCounts[item.category] = item._count;
    }

    return {
      totalTemplates,
      totalDownloads: totalDownloads._sum.downloads || 0,
      totalAuthors: authorCount.length,
      categoryCounts,
    };
  }
}
