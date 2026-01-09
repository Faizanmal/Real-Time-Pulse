/**
 * =============================================================================
 * REAL-TIME PULSE - API UTILITIES
 * =============================================================================
 *
 * Standardized pagination, rate limit handling, and API helpers.
 */

import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Standard pagination query DTO
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Cursor-based pagination query DTO (for infinite scroll)
 */
export class CursorPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cursor for next page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Standard paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  links: {
    self: string;
    first: string;
    last: string;
    next: string | null;
    prev: string | null;
  };
}

/**
 * Cursor-based paginated response
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    count: number;
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  baseUrl: string,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
    links: {
      self: `${baseUrl}?page=${page}&limit=${limit}`,
      first: `${baseUrl}?page=1&limit=${limit}`,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
      next: hasNextPage ? `${baseUrl}?page=${page + 1}&limit=${limit}` : null,
      prev: hasPrevPage ? `${baseUrl}?page=${page - 1}&limit=${limit}` : null,
    },
  };
}

/**
 * Create cursor-based paginated response
 */
export function createCursorPaginatedResponse<T extends { id: string }>(
  data: T[],
  limit: number,
  cursorField: keyof T = 'id',
): CursorPaginatedResponse<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  return {
    data: items,
    meta: {
      hasMore,
      nextCursor:
        hasMore && items.length > 0
          ? String(items[items.length - 1][cursorField])
          : null,
      prevCursor: items.length > 0 ? String(items[0][cursorField]) : null,
      count: items.length,
    },
  };
}

// ============================================================================
// RATE LIMIT HEADERS
// ============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  info: RateLimitInfo,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(info.reset.getTime() / 1000).toString(),
  };

  if (info.retryAfter !== undefined) {
    headers['Retry-After'] = info.retryAfter.toString();
  }

  return headers;
}

// ============================================================================
// STANDARD RESPONSE WRAPPERS
// ============================================================================

/**
 * Standard success response
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    validationErrors?: Array<{
      field: string;
      message: string;
      value?: unknown;
    }>;
  };
  requestId?: string;
}

/**
 * Create success response
 */
export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

/**
 * Create error response
 */
export function error(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

// ============================================================================
// API VERSIONING
// ============================================================================

/**
 * API version enum
 */
export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2',
}

/**
 * Get API version from header or default
 */
export function getApiVersion(versionHeader?: string): ApiVersion {
  if (versionHeader === 'v2' || versionHeader === '2') {
    return ApiVersion.V2;
  }
  return ApiVersion.V1;
}

/**
 * API deprecation warning header
 */
export function createDeprecationHeaders(
  sunset: Date,
  successor?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Deprecation: 'true',
    Sunset: sunset.toUTCString(),
  };

  if (successor) {
    headers['Link'] = `<${successor}>; rel="successor-version"`;
  }

  return headers;
}

// ============================================================================
// QUERY FILTERS
// ============================================================================

/**
 * Standard filter operators
 */
export type FilterOperator =
  | 'eq' // equals
  | 'neq' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'in' // in array
  | 'nin' // not in array
  | 'like' // contains (case insensitive)
  | 'between' // between two values
  | 'null' // is null
  | 'notnull'; // is not null

/**
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Parse filter query string
 * Format: field[operator]=value
 * Example: ?status[eq]=active&createdAt[gte]=2024-01-01
 */
export function parseFilters(
  query: Record<string, unknown>,
): FilterCondition[] {
  const filters: FilterCondition[] = [];
  const filterRegex = /^(\w+)\[(\w+)\]$/;

  for (const [key, value] of Object.entries(query)) {
    const match = key.match(filterRegex);
    if (match) {
      const [, field, operator] = match;
      filters.push({
        field,
        operator: operator as FilterOperator,
        value,
      });
    }
  }

  return filters;
}

/**
 * Convert filters to Prisma where clause
 */
export function filtersToPrismaWhere(
  filters: FilterCondition[],
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const filter of filters) {
    switch (filter.operator) {
      case 'eq':
        where[filter.field] = filter.value;
        break;
      case 'neq':
        where[filter.field] = { not: filter.value };
        break;
      case 'gt':
        where[filter.field] = { gt: filter.value };
        break;
      case 'gte':
        where[filter.field] = { gte: filter.value };
        break;
      case 'lt':
        where[filter.field] = { lt: filter.value };
        break;
      case 'lte':
        where[filter.field] = { lte: filter.value };
        break;
      case 'in':
        where[filter.field] = {
          in: Array.isArray(filter.value) ? filter.value : [filter.value],
        };
        break;
      case 'nin':
        where[filter.field] = {
          notIn: Array.isArray(filter.value) ? filter.value : [filter.value],
        };
        break;
      case 'like':
        where[filter.field] = { contains: filter.value, mode: 'insensitive' };
        break;
      case 'between':
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          where[filter.field] = { gte: filter.value[0], lte: filter.value[1] };
        }
        break;
      case 'null':
        where[filter.field] = null;
        break;
      case 'notnull':
        where[filter.field] = { not: null };
        break;
    }
  }

  return where;
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Validate ID format (UUID)
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 64;
}

/**
 * Sanitize sort field to prevent SQL injection
 */
export function sanitizeSortField(
  field: string,
  allowedFields: string[],
  defaultField = 'createdAt',
): string {
  return allowedFields.includes(field) ? field : defaultField;
}
