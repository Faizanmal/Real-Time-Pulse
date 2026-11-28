import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';

export class CreatePortalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsObject()
  @IsOptional()
  layout?: Record<string, any>;
}

export class UpdatePortalDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsObject()
  @IsOptional()
  layout?: Record<string, any>;

  @IsIn(['ON_TRACK', 'NEEDS_ATTENTION', 'BLOCKED', 'COMPLETED'])
  @IsOptional()
  clientStatus?: string | null;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  clientStatusNote?: string | null;

  @IsString()
  @MaxLength(240)
  @IsOptional()
  latestDeliverable?: string | null;

  @IsString()
  @MaxLength(240)
  @IsOptional()
  pendingDecision?: string | null;
}

export class PublishPortalDto {
  @IsDateString()
  expectedUpdatedAt: string;
}

export class PortalResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shareToken: string;
  isPublic: boolean;
  draftMode: boolean;
  publishedAt: Date | null;
  publishRevision: number;
  layout: Record<string, any> | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  clientStatus?: string | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: Date | null;

  // Include workspace info if populated
  workspace?: {
    id: string;
    name: string;
    logo: string | null;
    primaryColor: string | null;
  };

  // Include widget count
  widgetCount?: number;
}

export class PortalListResponseDto {
  portals: PortalResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicPortalWidgetDto {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown> | null;
  sourceLabel: string;
  isDemo: boolean;
  layout?: { x: number; y: number; w: number; h: number };
}

export interface PublicPortalViewDto {
  id: string;
  name: string;
  description: string | null;
  workspaceName: string;
  primaryColor: string;
  widgets: PublicPortalWidgetDto[];
  metrics?: Array<Record<string, unknown>>;
  valueClaims?: Array<Record<string, unknown>>;
  viewMode?: 'published' | 'draft-preview' | 'legacy-live';
  publishedAt?: string | null;
  publishRevision?: number;
  clientStatus?: string | null;
  clientStatusNote?: string | null;
  latestDeliverable?: string | null;
  pendingDecision?: string | null;
  clientUpdateAt?: string | null;
  feedStatus?: {
    health: 'CURRENT' | 'STALE' | 'ATTENTION' | 'NO_DATA';
    lastSyncedAt: string | null;
    lastValidDataAt: string | null;
    sourceCount: number;
  };
}
