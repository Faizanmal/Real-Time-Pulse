import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, IsObject } from 'class-validator';
import { TemplateCategory, WidgetType } from '@prisma/client';

// ============================================
// Widget Template DTOs
// ============================================

export class CreateWidgetTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Template category', enum: TemplateCategory })
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @ApiPropertyOptional({ description: 'Thumbnail image URL' })
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiProperty({ description: 'Widget type', enum: WidgetType })
  @IsEnum(WidgetType)
  widgetType: WidgetType;

  @ApiProperty({ description: 'Widget configuration' })
  @IsObject()
  config: Record<string, any>;

  @ApiPropertyOptional({ description: 'Layout settings' })
  @IsObject()
  @IsOptional()
  layout?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Make template public', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Tags for filtering' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateWidgetTemplateDto extends PartialType(CreateWidgetTemplateDto) {}

// ============================================
// Portal Template DTOs
// ============================================

export class CreatePortalTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Template category', enum: TemplateCategory })
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @ApiPropertyOptional({ description: 'Thumbnail image URL' })
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiProperty({ description: 'Portal layout configuration' })
  @IsObject()
  layout: Record<string, any>;

  @ApiProperty({ description: 'Array of widget configurations' })
  @IsArray()
  widgetConfigs: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Portal settings' })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Make template public', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Tags for filtering' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdatePortalTemplateDto extends PartialType(CreatePortalTemplateDto) {}

// ============================================
// Create Portal From Template DTO
// ============================================

export class CreatePortalFromTemplateDto {
  @ApiProperty({ description: 'Portal name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Portal slug (URL-friendly)' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ description: 'Portal description' })
  @IsString()
  @IsOptional()
  description?: string;
}
