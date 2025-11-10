import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateWidgetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum([
    'METRIC',
    'CHART_LINE',
    'CHART_BAR',
    'CHART_PIE',
    'CHART_AREA',
    'TABLE',
    'LIST',
    'PROGRESS',
    'KANBAN',
    'TIMELINE',
    'CALENDAR',
    'MAP',
    'GAUGE',
    'TEXT',
    'IMAGE',
  ])
  type: string;

  @IsString()
  @IsNotEmpty()
  portalId: string;

  @IsString()
  @IsOptional()
  integrationId?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsNumber()
  @Min(1)
  @Max(12)
  @IsOptional()
  gridWidth?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  gridHeight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gridX?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gridY?: number;

  @IsNumber()
  @Min(300)
  @Max(86400)
  @IsOptional()
  refreshInterval?: number;
}

export class UpdateWidgetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsNumber()
  @Min(1)
  @Max(12)
  @IsOptional()
  gridWidth?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  gridHeight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gridX?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gridY?: number;

  @IsNumber()
  @Min(300)
  @Max(86400)
  @IsOptional()
  refreshInterval?: number;
}

export class WidgetResponseDto {
  id: string;
  name: string;
  type: string;
  config: Record<string, any> | null;
  gridWidth: number;
  gridHeight: number;
  gridX: number;
  gridY: number;
  refreshInterval: number;
  lastRefreshedAt: Date | null;
  portalId: string;
  integrationId: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Populated relations
  integration?: {
    id: string;
    provider: string;
    name: string;
  };

  cachedData?: any;
}
