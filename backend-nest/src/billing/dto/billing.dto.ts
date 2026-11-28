import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsUrl, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { PLAN_CATALOG } from '../plan-catalog';

export enum SubscriptionPlanTier {
  PRO = 'PRO',
  AGENCY = 'AGENCY',
}

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'Plan to subscribe to',
    enum: SubscriptionPlanTier,
  })
  @IsEnum(SubscriptionPlanTier)
  plan: SubscriptionPlanTier;

  @ApiProperty({ description: 'URL to redirect after successful payment' })
  @IsUrl()
  successUrl: string;

  @ApiProperty({ description: 'URL to redirect if payment is canceled' })
  @IsUrl()
  cancelUrl: string;

  @ApiPropertyOptional({
    description: 'Billing interval',
    enum: ['month', 'year'],
  })
  @IsOptional()
  @IsString()
  interval?: 'month' | 'year';

  @ApiPropertyOptional({ description: 'Coupon code to apply' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class CreatePortalSessionDto {
  @ApiProperty({ description: 'URL to return to after portal session' })
  @IsUrl()
  returnUrl: string;
}

export class ChangePlanDto {
  @ApiProperty({ description: 'New plan', enum: SubscriptionPlanTier })
  @IsEnum(SubscriptionPlanTier)
  plan: SubscriptionPlanTier;

  @ApiPropertyOptional({ description: 'Prorate changes' })
  @IsOptional()
  @IsBoolean()
  prorate?: boolean;
}

export class CreateUsageBillingDto {
  @ApiProperty({ description: 'Usage metric type' })
  @IsString()
  metricType: string;

  @ApiProperty({ description: 'Quantity of usage' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Timestamp for usage' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export interface PlanFeatures {
  portals: number;
  widgets: number;
  integrations: number;
  users: number;
  storage: number; // in GB
  apiCalls: number; // per month
  scheduledReports: number;
  customBranding: boolean;
  prioritySupport: boolean;
  sso: boolean;
  advancedAnalytics: boolean;
  auditLogs: boolean;
  customDomain: boolean;
}

export interface PlanPricing {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PlanFeatures;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  popular?: boolean;
}

export const PLAN_PRICING: Record<SubscriptionPlanTier, PlanPricing> = {
  [SubscriptionPlanTier.PRO]: {
    id: 'pro',
    name: PLAN_CATALOG.PRO.name,
    description: PLAN_CATALOG.PRO.description,
    monthlyPrice: PLAN_CATALOG.PRO.monthlyPriceCents / 100,
    yearlyPrice: (PLAN_CATALOG.PRO.monthlyPriceCents * 10) / 100,
    features: {
      portals: PLAN_CATALOG.PRO.maxPortals,
      widgets: PLAN_CATALOG.PRO.maxWidgets,
      integrations: 2,
      users: PLAN_CATALOG.PRO.maxUsers,
      storage: 1,
      apiCalls: PLAN_CATALOG.PRO.maxAiRequestsPerMonth,
      scheduledReports: 0,
      customBranding: false,
      prioritySupport: false,
      sso: false,
      advancedAnalytics: false,
      auditLogs: false,
      customDomain: false,
    },
  },
  [SubscriptionPlanTier.AGENCY]: {
    id: 'agency',
    name: PLAN_CATALOG.AGENCY.name,
    description: PLAN_CATALOG.AGENCY.description,
    monthlyPrice: PLAN_CATALOG.AGENCY.monthlyPriceCents / 100,
    yearlyPrice: (PLAN_CATALOG.AGENCY.monthlyPriceCents * 10) / 100,
    features: {
      portals: PLAN_CATALOG.AGENCY.maxPortals,
      widgets: PLAN_CATALOG.AGENCY.maxWidgets,
      integrations: 15,
      users: PLAN_CATALOG.AGENCY.maxUsers,
      storage: 50,
      apiCalls: PLAN_CATALOG.AGENCY.maxAiRequestsPerMonth,
      scheduledReports: 25,
      customBranding: true,
      prioritySupport: true,
      sso: true,
      advancedAnalytics: true,
      auditLogs: true,
      customDomain: true,
    },
    popular: true,
  },
};
