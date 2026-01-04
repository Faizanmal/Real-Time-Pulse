import { IsString, IsInt, IsOptional, IsEnum } from 'class-validator';

export enum BadgeCategory {
  ACHIEVEMENT = 'ACHIEVEMENT',
  MILESTONE = 'MILESTONE',
  SKILL = 'SKILL',
  SOCIAL = 'SOCIAL',
  SPECIAL = 'SPECIAL',
}

export enum BadgeRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export class CreateBadgeDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  description: string;

  @IsString()
  icon: string;

  @IsEnum(BadgeCategory)
  category: BadgeCategory;

  @IsEnum(BadgeRarity)
  @IsOptional()
  rarity?: BadgeRarity;
}

export class AwardBadgeDto {
  @IsString()
  userId: string;

  @IsString()
  badgeId: string;
}

export class UpdateXpDto {
  @IsString()
  userId: string;

  @IsInt()
  amount: number;

  @IsString()
  reason: string;
}
