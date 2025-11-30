import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Portal ID where the comment belongs' })
  @IsString()
  portalId: string;

  @ApiPropertyOptional({ description: 'Widget ID if commenting on a specific widget' })
  @IsString()
  @IsOptional()
  widgetId?: string;

  @ApiProperty({ description: 'Comment content (supports @mentions)' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ description: 'Updated comment content' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}
