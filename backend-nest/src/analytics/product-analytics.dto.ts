import { ProductCostBasis, ProductCostCategory, ProductTelemetryKind } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class RecordProductTelemetryDto {
  @IsUUID('4') eventId!: string;
  @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,79}$/) featureKey!: string;
  @IsEnum(ProductTelemetryKind) kind!: ProductTelemetryKind;
  @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,79}$/) eventName!: string;
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) value?: number;
  @IsOptional() @IsString() @Length(1, 32) unit?: string;
  @IsOptional() @IsEnum(ProductCostCategory) costCategory?: ProductCostCategory;
  @IsOptional() @IsEnum(ProductCostBasis) costBasis?: ProductCostBasis;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) costMicros?: number;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,79}$/) experimentKey?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,79}$/) variantKey?: string;
}
