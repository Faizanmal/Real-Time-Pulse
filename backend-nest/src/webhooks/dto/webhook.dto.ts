import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsNumber,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsUrl()
  url: string;

  @ApiProperty({
    description: 'Events to subscribe to',
    example: ['portal.created', 'portal.updated', 'widget.added'],
  })
  @IsArray()
  events: string[];

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiProperty({ required: false, default: 3 })
  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @ApiProperty({ required: false, default: 60 })
  @IsNumber()
  @IsOptional()
  retryDelay?: number;

  @ApiProperty({ required: false, default: 30 })
  @IsNumber()
  @IsOptional()
  timeoutSeconds?: number;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateWebhookDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  events?: string[];

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  retryDelay?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  timeoutSeconds?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
