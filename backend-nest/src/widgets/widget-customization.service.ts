import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export interface WidgetStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  textColor?: string;
  headerColor?: string;
  fontFamily?: string;
  fontSize?: number;
  padding?: number;
  shadow?: string;
  customCSS?: string;
}

export interface ConditionalFormat {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'startsWith' | 'endsWith';
    value: string | number | boolean;
  };
  style: {
    backgroundColor?: string;
    textColor?: string;
    fontWeight?: string;
    icon?: string;
    badge?: string;
  };
  priority: number;
}

export interface DataTransformation {
  id: string;
  name: string;
  type: 'filter' | 'map' | 'aggregate' | 'sort' | 'limit' | 'custom';
  config: Record<string, unknown>;
  order: number;
}

export interface WidgetCustomization {
  widgetId: string;
  style: WidgetStyle;
  conditionalFormats: ConditionalFormat[];
  dataTransformations: DataTransformation[];
  animations?: {
    enabled: boolean;
    type: 'fade' | 'slide' | 'scale' | 'none';
    duration: number;
  };
  interactivity?: {
    clickable: boolean;
    clickAction?: 'expand' | 'navigate' | 'custom';
    hoverEffect?: 'highlight' | 'scale' | 'none';
    drilldownEnabled?: boolean;
  };
}

@Injectable()
export class WidgetCustomizationService {
  private readonly logger = new Logger(WidgetCustomizationService.name);
  private readonly CUSTOMIZATION_PREFIX = 'widget:customization:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get widget customization
   */
  async getCustomization(widgetId: string): Promise<WidgetCustomization | null> {
    // Check cache first
    const cached = await this.cacheService.get(`${this.CUSTOMIZATION_PREFIX}${widgetId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Check if widget exists
    const widget = await this.prisma.widget.findUnique({
      where: { id: widgetId },
      select: { config: true },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    // Extract customization from widget config
    const config = widget.config as Record<string, unknown>;
    if (config?.customization) {
      return config.customization as WidgetCustomization;
    }

    return null;
  }

  /**
   * Save widget customization
   */
  async saveCustomization(
    widgetId: string,
    workspaceId: string,
    customization: Partial<WidgetCustomization>,
  ): Promise<WidgetCustomization> {
    // Verify widget exists and belongs to workspace
    const widget = await this.prisma.widget.findFirst({
      where: {
        id: widgetId,
        portal: { workspaceId },
      },
      select: { id: true, config: true },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    // Validate custom CSS if provided
    if (customization.style?.customCSS) {
      this.validateCustomCSS(customization.style.customCSS);
    }

    // Merge with existing customization
    const existingConfig = widget.config as Record<string, unknown>;
    const existingCustomization = existingConfig?.customization as WidgetCustomization || {
      widgetId,
      style: {},
      conditionalFormats: [],
      dataTransformations: [],
    };

    const mergedCustomization: WidgetCustomization = {
      ...existingCustomization,
      ...customization,
      widgetId,
      style: {
        ...existingCustomization.style,
        ...customization.style,
      },
      conditionalFormats: customization.conditionalFormats ?? existingCustomization.conditionalFormats,
      dataTransformations: customization.dataTransformations ?? existingCustomization.dataTransformations,
    };

    // Update widget config
    await this.prisma.widget.update({
      where: { id: widgetId },
      data: {
        config: {
          ...existingConfig,
          customization: mergedCustomization,
        },
      },
    });

    // Cache the customization
    await this.cacheService.set(
      `${this.CUSTOMIZATION_PREFIX}${widgetId}`,
      JSON.stringify(mergedCustomization),
      24 * 60 * 60, // 24 hours
    );

    this.logger.log(`Widget customization saved for widget ${widgetId}`);
    return mergedCustomization;
  }

  /**
   * Add conditional format rule
   */
  async addConditionalFormat(
    widgetId: string,
    workspaceId: string,
    format: Omit<ConditionalFormat, 'id'>,
  ): Promise<ConditionalFormat> {
    const customization = await this.getCustomization(widgetId);
    const newFormat: ConditionalFormat = {
      ...format,
      id: `cf_${Date.now()}`,
    };

    const formats = customization?.conditionalFormats || [];
    formats.push(newFormat);

    // Sort by priority
    formats.sort((a, b) => a.priority - b.priority);

    await this.saveCustomization(widgetId, workspaceId, {
      conditionalFormats: formats,
    });

    return newFormat;
  }

  /**
   * Update conditional format rule
   */
  async updateConditionalFormat(
    widgetId: string,
    workspaceId: string,
    formatId: string,
    updates: Partial<ConditionalFormat>,
  ): Promise<ConditionalFormat> {
    const customization = await this.getCustomization(widgetId);
    if (!customization) {
      throw new NotFoundException('Widget customization not found');
    }

    const formatIndex = customization.conditionalFormats.findIndex((f) => f.id === formatId);
    if (formatIndex === -1) {
      throw new NotFoundException('Conditional format not found');
    }

    const updatedFormat = {
      ...customization.conditionalFormats[formatIndex],
      ...updates,
      id: formatId,
    };

    customization.conditionalFormats[formatIndex] = updatedFormat;

    await this.saveCustomization(widgetId, workspaceId, {
      conditionalFormats: customization.conditionalFormats,
    });

    return updatedFormat;
  }

  /**
   * Delete conditional format rule
   */
  async deleteConditionalFormat(
    widgetId: string,
    workspaceId: string,
    formatId: string,
  ): Promise<void> {
    const customization = await this.getCustomization(widgetId);
    if (!customization) {
      throw new NotFoundException('Widget customization not found');
    }

    const formats = customization.conditionalFormats.filter((f) => f.id !== formatId);

    await this.saveCustomization(widgetId, workspaceId, {
      conditionalFormats: formats,
    });
  }

  /**
   * Add data transformation
   */
  async addDataTransformation(
    widgetId: string,
    workspaceId: string,
    transformation: Omit<DataTransformation, 'id'>,
  ): Promise<DataTransformation> {
    const customization = await this.getCustomization(widgetId);
    const newTransformation: DataTransformation = {
      ...transformation,
      id: `dt_${Date.now()}`,
    };

    const transformations = customization?.dataTransformations || [];
    transformations.push(newTransformation);

    // Sort by order
    transformations.sort((a, b) => a.order - b.order);

    await this.saveCustomization(widgetId, workspaceId, {
      dataTransformations: transformations,
    });

    return newTransformation;
  }

  /**
   * Update data transformation
   */
  async updateDataTransformation(
    widgetId: string,
    workspaceId: string,
    transformationId: string,
    updates: Partial<DataTransformation>,
  ): Promise<DataTransformation> {
    const customization = await this.getCustomization(widgetId);
    if (!customization) {
      throw new NotFoundException('Widget customization not found');
    }

    const index = customization.dataTransformations.findIndex((t) => t.id === transformationId);
    if (index === -1) {
      throw new NotFoundException('Data transformation not found');
    }

    const updated = {
      ...customization.dataTransformations[index],
      ...updates,
      id: transformationId,
    };

    customization.dataTransformations[index] = updated;

    await this.saveCustomization(widgetId, workspaceId, {
      dataTransformations: customization.dataTransformations,
    });

    return updated;
  }

  /**
   * Delete data transformation
   */
  async deleteDataTransformation(
    widgetId: string,
    workspaceId: string,
    transformationId: string,
  ): Promise<void> {
    const customization = await this.getCustomization(widgetId);
    if (!customization) {
      throw new NotFoundException('Widget customization not found');
    }

    const transformations = customization.dataTransformations.filter(
      (t) => t.id !== transformationId,
    );

    await this.saveCustomization(widgetId, workspaceId, {
      dataTransformations: transformations,
    });
  }

  /**
   * Apply data transformations to data
   */
  applyTransformations(data: any[], transformations: DataTransformation[]): any[] {
    let result = [...data];

    for (const transform of transformations.sort((a, b) => a.order - b.order)) {
      switch (transform.type) {
        case 'filter':
          result = this.applyFilter(result, transform.config);
          break;
        case 'map':
          result = this.applyMap(result, transform.config);
          break;
        case 'aggregate':
          result = this.applyAggregate(result, transform.config);
          break;
        case 'sort':
          result = this.applySort(result, transform.config);
          break;
        case 'limit':
          result = this.applyLimit(result, transform.config);
          break;
        case 'custom':
          result = this.applyCustom(result, transform.config);
          break;
      }
    }

    return result;
  }

  /**
   * Apply conditional formatting to data item
   */
  applyConditionalFormats(
    item: Record<string, unknown>,
    formats: ConditionalFormat[],
  ): { item: Record<string, unknown>; appliedStyles: Record<string, unknown> } {
    const appliedStyles: Record<string, unknown> = {};

    for (const format of formats.sort((a, b) => a.priority - b.priority)) {
      const value = item[format.condition.field];
      if (this.evaluateCondition(value, format.condition)) {
        Object.assign(appliedStyles, format.style);
      }
    }

    return { item, appliedStyles };
  }

  /**
   * Validate custom CSS for security
   */
  private validateCustomCSS(css: string): void {
    // Block potentially dangerous CSS
    const dangerousPatterns = [
      /expression\s*\(/i,
      /javascript:/i,
      /behavior:/i,
      /@import/i,
      /url\s*\([^)]*data:/i,
      /position\s*:\s*fixed/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(css)) {
        throw new BadRequestException('Custom CSS contains disallowed content');
      }
    }

    // Limit CSS length
    if (css.length > 10000) {
      throw new BadRequestException('Custom CSS exceeds maximum length');
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(
    value: unknown,
    condition: ConditionalFormat['condition'],
  ): boolean {
    const { operator, value: conditionValue } = condition;

    switch (operator) {
      case '>':
        return Number(value) > Number(conditionValue);
      case '<':
        return Number(value) < Number(conditionValue);
      case '>=':
        return Number(value) >= Number(conditionValue);
      case '<=':
        return Number(value) <= Number(conditionValue);
      case '==':
        return value == conditionValue;
      case '!=':
        return value != conditionValue;
      case 'contains':
        return String(value).includes(String(conditionValue));
      case 'startsWith':
        return String(value).startsWith(String(conditionValue));
      case 'endsWith':
        return String(value).endsWith(String(conditionValue));
      default:
        return false;
    }
  }

  private applyFilter(data: any[], config: Record<string, unknown>): any[] {
    const { field, operator, value } = config;
    return data.filter((item) => {
      const itemValue = item[field as string];
      return this.evaluateCondition(itemValue, { field: field as string, operator: operator as any, value: value as any });
    });
  }

  private applyMap(data: any[], config: Record<string, unknown>): any[] {
    const { fields } = config as { fields: string[] };
    if (!fields) return data;
    return data.map((item) => {
      const mapped: Record<string, unknown> = {};
      for (const field of fields) {
        mapped[field] = item[field];
      }
      return mapped;
    });
  }

  private applyAggregate(data: any[], config: Record<string, unknown>): any[] {
    const { operation, field, groupBy } = config as { operation: string; field: string; groupBy?: string };
    
    if (groupBy) {
      const groups = new Map<string, any[]>();
      for (const item of data) {
        const key = String(item[groupBy]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      
      return Array.from(groups.entries()).map(([key, items]) => ({
        [groupBy]: key,
        [field]: this.calculateAggregate(items, field, operation),
      }));
    }

    return [{
      [field]: this.calculateAggregate(data, field, operation),
    }];
  }

  private calculateAggregate(data: any[], field: string, operation: string): number {
    const values = data.map((item) => Number(item[field]) || 0);
    switch (operation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }

  private applySort(data: any[], config: Record<string, unknown>): any[] {
    const { field, direction } = config as { field: string; direction: 'asc' | 'desc' };
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'desc' ? -comparison : comparison;
    });
  }

  private applyLimit(data: any[], config: Record<string, unknown>): any[] {
    const { count, offset } = config as { count: number; offset?: number };
    return data.slice(offset || 0, (offset || 0) + count);
  }

  private applyCustom(data: any[], config: Record<string, unknown>): any[] {
    // Custom transformations can be defined by type
    const { customType, customConfig } = config as { customType: string; customConfig: any };
    
    switch (customType) {
      case 'percentOfTotal':
        const field = customConfig?.field;
        const total = data.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
        return data.map((item) => ({
          ...item,
          [`${field}_percent`]: total > 0 ? ((Number(item[field]) || 0) / total) * 100 : 0,
        }));
      case 'runningTotal':
        let runningTotal = 0;
        const rtField = customConfig?.field;
        return data.map((item) => {
          runningTotal += Number(item[rtField]) || 0;
          return { ...item, runningTotal };
        });
      default:
        return data;
    }
  }
}
