import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, Min, IsEmail, MaxLength, MinLength, IsArray, ArrayUnique, IsUUID } from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Allow assigned client accounts to respond to versioned decisions',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowDecisions?: boolean;

  @ApiPropertyOptional({ description: 'Whether the share link is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'When set, only these same-workspace client accounts can use the link. Empty preserves bearer-link access.' })
  @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) @IsOptional()
  clientUserIds?: string[];
}

export class UpdateShareLinkDto extends PartialType(CreateShareLinkDto) {}

export class AccessShareLinkDto {
  @ApiPropertyOptional({ description: 'Password for protected share links' })
  @IsString()
  @IsOptional()
  password?: string;
}

export class SharedCommentDto {
  @IsString() @MinLength(1) @MaxLength(80) displayName: string;
  @IsString() @MinLength(1) @MaxLength(2000) content: string;
  @IsString() @IsOptional() password?: string;
}

export class ShareAccessRequestDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @IsOptional() @MaxLength(1000) message?: string;
}
