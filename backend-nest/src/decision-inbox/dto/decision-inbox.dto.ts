import { ClientDecisionResponseKind } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsUUID,
} from 'class-validator';

export class CreateClientDecisionDto {
  @IsUUID('all') sourceShareLinkId: string;
  @IsUUID('all') clientUserId: string;
  @IsString() @MinLength(1) @MaxLength(160) title: string;
  @IsString() @MinLength(1) @MaxLength(4000) prompt: string;
  @IsDateString() @IsOptional() dueAt?: string;
}

export class SubmitClientDecisionDto {
  @IsInt() @Min(0) expectedRevision: number;
  @IsEnum(ClientDecisionResponseKind) response: ClientDecisionResponseKind;
  @IsString() @MaxLength(2000) @IsOptional() comment?: string;
  @IsString() @MaxLength(200) @IsOptional() password?: string;
}

export class ClientDecisionListDto {
  @IsString() @MaxLength(200) @IsOptional() password?: string;
}

export class UpdateDecisionEscalationPolicyDto {
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsBoolean() @IsOptional() notificationOptIn?: boolean;
  @IsString() @MaxLength(80) @IsOptional() timeZone?: string;
  @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) @IsOptional() businessDays?: number[];
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) @IsOptional() businessHoursStart?: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) @IsOptional() businessHoursEnd?: string;
  @IsInt() @Min(15) @Max(10080) @IsOptional() reminderIntervalMinutes?: number;
  @IsInt() @Min(1) @Max(10) @IsOptional() maxReminders?: number;
}
