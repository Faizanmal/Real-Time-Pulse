import { IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'Alert condition',
    example: { metric: 'value', operator: '>', threshold: 100 },
  })
  @IsObject()
  condition: Record<string, any>;

  @ApiProperty({
    description: 'Notification channels',
    example: ['email', 'slack', 'webhook'],
  })
  @IsArray()
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
}

export class UpdateAlertDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  condition?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  channels?: string[];

  @ApiProperty({ required: false })
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

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
