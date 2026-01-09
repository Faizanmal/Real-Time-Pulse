import {
  IsString,
  IsArray,
  IsOptional,
  IsISO8601,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ description: 'Name for the API key' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Scopes/permissions for the API key',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes: string[];

  @ApiPropertyOptional({ description: 'Expiration date for the API key' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
