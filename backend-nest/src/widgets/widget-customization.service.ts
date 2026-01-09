import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Prisma } from '@prisma/client';

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
    operator:
      | '>'
      | '<'
      | '>='
      | '<='
      | '=='
      | '!='
      | 'contains'
      | 'startsWith'
      | 'endsWith';
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

export interface FilterConfig {
  field: string;
  operator: ConditionalFormat['condition']['operator'];
  value: string | number | boolean;
}

export interface MapConfig {
  fields: string[];
}

export interface AggregateConfig {
  groupBy: string;
  aggregations: Array<{
    field: string;
    function: 'sum' | 'avg' | 'count' | 'min' | 'max';
    alias?: string;
  }>;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface LimitConfig {
  count: number;
}

export interface DataTransformation {
  id: string;
  type: 'filter' | 'map' | 'aggregate' | 'sort' | 'limit' | 'custom';
  config:
    | FilterConfig
    | MapConfig
    | AggregateConfig
    | SortConfig
    | LimitConfig
    | Record<string, unknown>;
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
  async getCustomization(
    widgetId: string,
  ): Promise<WidgetCustomization | null> {
    // Check cache first
    const cached = await this.cacheService.get(
      `${this.CUSTOMIZATION_PREFIX}${widgetId}`,
    );
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
    const config = widget.config as Record<string, unknown> | null;
    if (config?.customization) {
      const customization = config.customization as WidgetCustomization;
      // Cache for future requests
      await this.cacheService.set(
        `${this.CUSTOMIZATION_PREFIX}${widgetId}`,
        JSON.stringify(customization),
        3600, // 1 hour
      );
      return customization;
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
    const existingCustomization =
      (existingConfig?.customization as WidgetCustomization) || {
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
      conditionalFormats:
        customization.conditionalFormats ??
        existingCustomization.conditionalFormats,
      dataTransformations:
        customization.dataTransformations ??
        existingCustomization.dataTransformations,
    };

    // Update widget config
    const updatedConfig = {
      ...existingConfig,
      customization: mergedCustomization,
    };

    await this.prisma.widget.update({
      where: { id: widgetId },
      data: {
        config: updatedConfig as unknown as Prisma.InputJsonValue,
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

    const formatIndex = customization.conditionalFormats.findIndex(
      (f) => f.id === formatId,
    );
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

    const formats = customization.conditionalFormats.filter(
      (f) => f.id !== formatId,
    );

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

    const index = customization.dataTransformations.findIndex(
      (t) => t.id === transformationId,
    );
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
  applyTransformations(
    data: any[],
    transformations: DataTransformation[],
  ): any[] {
    let result = [...data];

    for (const transform of transformations.sort((a, b) => a.order - b.order)) {
      switch (transform.type) {
        case 'filter':
          result = this.applyFilter(result, transform.config as FilterConfig);
          break;
        case 'map':
          result = this.applyMap(result, transform.config as MapConfig);
          break;
        case 'aggregate':
          result = this.applyAggregate(
            result,
            transform.config as AggregateConfig,
          );
          break;
        case 'sort':
          result = this.applySort(result, transform.config as SortConfig);
          break;
        case 'limit':
          result = this.applyLimit(result, transform.config as LimitConfig);
          break;
        case 'custom':
          result = this.applyCustom(
            result,
            transform.config as Record<string, unknown>,
          );
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

  private applyFilter(
    data: Record<string, unknown>[],
    config: FilterConfig,
  ): Record<string, unknown>[] {
    const { field, operator, value } = config;
    return data.filter((item) => {
      const itemValue = item[field];
      return this.evaluateCondition(itemValue, {
        field,
        operator,
        value,
      });
    });
  }

  private applyMap(
    data: Record<string, unknown>[],
    config: MapConfig,
  ): Record<string, unknown>[] {
    const { fields } = config;
    if (!fields) return data;
    return data.map((item) => {
      const mapped: Record<string, unknown> = {};
      for (const field of fields) {
        mapped[field] = item[field];
      }
      return mapped;
    });
  }

  private applyAggregate(
    data: Record<string, unknown>[],
    config: AggregateConfig,
  ): Record<string, unknown>[] {
    const { groupBy, aggregations } = config;

    if (groupBy) {
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const item of data) {
        const key = String(item[groupBy]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }

      return Array.from(groups.entries()).map(([key, items]) => {
        const result: Record<string, unknown> = { [groupBy]: key };
        aggregations.forEach((agg) => {
          const value = this.calculateAggregate(items, agg.field, agg.function);
          result[agg.alias || agg.field] = value;
        });
        return result;
      });
    }

    // No grouping, return single aggregated result
    const result: Record<string, unknown> = {};
    aggregations.forEach((agg) => {
      const value = this.calculateAggregate(data, agg.field, agg.function);
      result[agg.alias || agg.field] = value;
    });
    return [result];
  }

  private calculateAggregate(
    data: Record<string, unknown>[],
    field: string,
    operation: AggregateConfig['aggregations'][0]['function'],
  ): number {
    const values = data.map((item) => {
      const value = item[field];
      return typeof value === 'number' ? value : Number(value) || 0;
    });

    switch (operation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }

  private applySort(
    data: Record<string, unknown>[],
    config: SortConfig,
  ): Record<string, unknown>[] {
    const { field, direction } = config;
    return [...data].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const aVal = String(a[field] ?? '');
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const bVal = String(b[field] ?? '');
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'desc' ? -comparison : comparison;
    });
  }

  private applyLimit(
    data: Record<string, unknown>[],
    config: LimitConfig,
  ): Record<string, unknown>[] {
    const { count } = config;
    return data.slice(0, count);
  }

  private applyCustom(
    data: Record<string, unknown>[],
    config: Record<string, unknown>,
  ): Record<string, unknown>[] {
    // Custom transformations can be defined by type
    const { customType, customConfig } = config as {
      customType: string;
      customConfig?: Record<string, unknown>;
    };

    switch (customType) {
      case 'percentOfTotal': {
        const field = customConfig?.field as string;
        const total = data.reduce(
          (sum, item) => sum + (Number(item[field]) || 0),
          0,
        );
        return data.map((item) => ({
          ...item,
          [`${field}_percent`]:
            total > 0 ? ((Number(item[field]) || 0) / total) * 100 : 0,
        }));
      }
      case 'runningTotal': {
        let runningTotal = 0;
        const rtField = customConfig?.field as string;
        return data.map((item) => {
          runningTotal += Number(item[rtField]) || 0;
          return { ...item, runningTotal };
        });
      }
      default:
        return data;
    }
  }
}
