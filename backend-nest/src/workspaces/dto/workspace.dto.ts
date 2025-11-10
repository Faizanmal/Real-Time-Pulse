import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsHexColor,
  IsUrl,
  IsEmail,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsUrl()
  @IsOptional()
  website?: string;
}

export class WorkspaceResponseDto {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor: string;
  contactEmail?: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  role?: 'ADMIN' | 'MEMBER';
}

export class WorkspaceMemberResponseDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar?: string | null;
  role: string;
  createdAt: Date;
  lastLoginAt?: Date | null;
}

export class WorkspaceStatsDto {
  totalPortals: number;
  totalMembers: number;
  totalIntegrations: number;
  subscription?: {
    plan: string;
    status: string;
    maxPortals: number;
    maxUsers: number;
    trialEndsAt?: Date | null;
  };
}
