import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateShareLinkDto {
  @ApiProperty({ description: 'Portal ID to create share link for' })
  @IsString()
  portalId: string;

  @ApiPropertyOptional({ description: 'Password to protect the share link' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ description: 'Expiration date for the share link' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Maximum number of views allowed' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxViews?: number;

  @ApiPropertyOptional({
    description: 'Allow exporting data from shared portal',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowExport?: boolean;

  @ApiPropertyOptional({
    description: 'Allow comments on shared portal',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowComments?: boolean;

  @ApiPropertyOptional({ description: 'Whether the share link is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateShareLinkDto extends PartialType(CreateShareLinkDto) {}

export class AccessShareLinkDto {
  @ApiPropertyOptional({ description: 'Password for protected share links' })
  @IsString()
  @IsOptional()
  password?: string;
}
