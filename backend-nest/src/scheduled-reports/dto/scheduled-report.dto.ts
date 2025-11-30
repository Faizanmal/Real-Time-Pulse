import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsEmail,
  ArrayMinSize,
  IsObject,
} from 'class-validator';
import { ReportFormat } from '@prisma/client';

export class CreateScheduledReportDto {
  @ApiProperty({ description: 'Report name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Report description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Portal ID to generate report for' })
  @IsString()
  portalId: string;

  @ApiProperty({
    description: 'Report format',
    enum: ReportFormat,
    default: 'PDF',
  })
  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;

  @ApiProperty({
    description: 'Cron schedule expression (e.g., "0 9 * * 1" for Monday 9 AM)',
  })
  @IsString()
  schedule: string;

  @ApiPropertyOptional({ description: 'Timezone for schedule', default: 'UTC' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({
    description: 'Email recipients',
    type: [String],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMinSize(1)
  recipients: string[];

  @ApiPropertyOptional({ description: 'Template ID for custom report layout' })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Custom template configuration' })
  @IsObject()
  @IsOptional()
  customTemplate?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether the report is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateScheduledReportDto extends PartialType(
  CreateScheduledReportDto,
) {}
