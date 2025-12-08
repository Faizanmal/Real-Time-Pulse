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
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportFormat } from '@prisma/client';

// Date range configuration for reports
export class DateRangeDto {
  @ApiProperty({
    description: 'Date range type',
    enum: ['last_7_days', 'last_30_days', 'last_90_days', 'custom', 'all_time'],
  })
  @IsString()
  type: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom' | 'all_time';

  @ApiPropertyOptional({ description: 'Custom start date (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Custom end date (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// Widget selection for reports
export class WidgetSelectionDto {
  @ApiPropertyOptional({ description: 'Widget IDs to include', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  widgetIds?: string[];

  @ApiPropertyOptional({ description: 'Include all widgets', default: true })
  @IsOptional()
  @IsBoolean()
  includeAll?: boolean;
}

// Email template customization
export class EmailTemplateDto {
  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Email header text' })
  @IsOptional()
  @IsString()
  headerText?: string;

  @ApiPropertyOptional({ description: 'Email body text' })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({ description: 'Email footer text' })
  @IsOptional()
  @IsString()
  footerText?: string;

  @ApiPropertyOptional({ description: 'Include company logo' })
  @IsOptional()
  @IsBoolean()
  includeLogo?: boolean;

  @ApiPropertyOptional({ description: 'Brand color for email template (hex)' })
  @IsOptional()
  @IsString()
  brandColor?: string;
}

// Delivery channel configuration
export class DeliveryChannelDto {
  @ApiProperty({
    description: 'Channel type',
    enum: ['email', 'slack', 'webhook'],
  })
  @IsString()
  type: 'email' | 'slack' | 'webhook';

  @ApiPropertyOptional({ description: 'Email recipients for this channel' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @ApiPropertyOptional({ description: 'Slack webhook URL' })
  @IsOptional()
  @IsString()
  slackWebhookUrl?: string;

  @ApiPropertyOptional({ description: 'Slack channel name' })
  @IsOptional()
  @IsString()
  slackChannel?: string;

  @ApiPropertyOptional({ description: 'Webhook URL for delivery' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}

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

  @ApiPropertyOptional({ description: 'Date range for report data' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @ApiPropertyOptional({ description: 'Specific widgets to include in report' })
  @IsOptional()
  @ValidateNested()
  @Type(() => WidgetSelectionDto)
  widgetSelection?: WidgetSelectionDto;

  @ApiPropertyOptional({ description: 'Email template customization' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailTemplateDto)
  emailTemplate?: EmailTemplateDto;

  @ApiPropertyOptional({ description: 'Additional delivery channels' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryChannelDto)
  deliveryChannels?: DeliveryChannelDto[];

  @ApiPropertyOptional({ description: 'Is this a one-time report?' })
  @IsOptional()
  @IsBoolean()
  isOneTime?: boolean;

  @ApiPropertyOptional({
    description: 'One-time report send date (ISO string)',
  })
  @IsOptional()
  @IsString()
  sendAt?: string;

  @ApiPropertyOptional({ description: 'Whether the report is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateScheduledReportDto extends PartialType(
  CreateScheduledReportDto,
) {}

export class ReportRunQueryDto {
  @ApiPropertyOptional({
    description: 'Number of records to return',
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;
}
