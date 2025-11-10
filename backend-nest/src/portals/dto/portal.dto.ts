import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
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
}

export class PortalResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shareToken: string;
  isPublic: boolean;
  layout: Record<string, any> | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

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
