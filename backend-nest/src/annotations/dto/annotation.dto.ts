import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';

export enum AnnotationType {
  COMMENT = 'COMMENT',
  PIN = 'PIN',
  FLAG = 'FLAG',
  ALERT = 'ALERT',
  SUCCESS = 'SUCCESS',
  INFO = 'INFO',
}

export class CreateAnnotationDto {
  @IsString()
  portalId: string;

  @IsString()
  @IsOptional()
  widgetId?: string;

  @IsString()
  content: string;

  @IsEnum(AnnotationType)
  type: AnnotationType;

  @IsNumber()
  positionX: number;

  @IsNumber()
  positionY: number;

  @IsObject()
  @IsOptional()
  dataPoint?: any;
}

export class UpdateAnnotationDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  resolved?: boolean;
}

export class ReplyAnnotationDto {
  @IsString()
  content: string;
}
