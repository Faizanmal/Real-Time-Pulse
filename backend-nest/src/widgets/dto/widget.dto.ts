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
    'TEXT_BLOCK',
    'IMAGE',
    'VIDEO_EMBED',
    'ASANA_TASK_LIST',
    'ASANA_PROJECT_PROGRESS',
    'CLICKUP_TASK_LIST',
    'CLICKUP_PROJECT_PROGRESS',
    'TRELLO_CARD_LIST',
    'TRELLO_BOARD_PROGRESS',
    'GA4_METRIC_KPI',
    'GA4_LINE_GRAPH',
    'GA4_TOP_PAGES',
    'HARVEST_BUDGET_TRACKER',
    'HARVEST_TOTAL_HOURS',
    'TOGGL_TOTAL_HOURS',
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
