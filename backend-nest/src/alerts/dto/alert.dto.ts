import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

const CHANNELS = ['email', 'slack', 'webhook'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateAlertDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  portalId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  widgetId?: string;

  @ApiProperty({ description: 'Metric/operator/threshold rule', example: { metric: 'provider.sync_failures', operator: '>=', threshold: 1 } })
  @IsObject()
  condition: Record<string, unknown>;

  @ApiProperty({ enum: SEVERITIES, required: false, default: 'MEDIUM' })
  @IsIn(SEVERITIES)
  @IsOptional()
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ enum: CHANNELS, isArray: true, example: ['email'] })
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  emailRecipients?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  webhookUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  slackWebhook?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  slackChannel?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 900, minimum: 0, maximum: 86400 })
  @IsInt()
  @Min(0)
  @Max(86400)
  @IsOptional()
  suppressionWindowSeconds?: number;
}

export class UpdateAlertDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional() name?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() portalId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() widgetId?: string;
  @ApiProperty({ required: false }) @IsObject() @IsOptional() condition?: Record<string, unknown>;
  @ApiProperty({ enum: SEVERITIES, required: false }) @IsIn(SEVERITIES) @IsOptional() severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  @ApiProperty({ enum: CHANNELS, isArray: true, required: false }) @IsArray() @IsIn(CHANNELS, { each: true }) @IsOptional() channels?: string[];
  @ApiProperty({ required: false, type: [String] }) @IsArray() @IsOptional() emailRecipients?: string[];
  @ApiProperty({ required: false }) @IsString() @IsOptional() webhookUrl?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() slackWebhook?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() slackChannel?: string;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiProperty({ required: false, minimum: 0, maximum: 86400 }) @IsInt() @Min(0) @Max(86400) @IsOptional() suppressionWindowSeconds?: number;
}
