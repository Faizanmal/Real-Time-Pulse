import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsUrl, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export enum SubscriptionPlanTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Plan to subscribe to', enum: SubscriptionPlanTier })
  @IsEnum(SubscriptionPlanTier)
  plan: SubscriptionPlanTier;

  @ApiProperty({ description: 'URL to redirect after successful payment' })
  @IsUrl()
  successUrl: string;

  @ApiProperty({ description: 'URL to redirect if payment is canceled' })
  @IsUrl()
  cancelUrl: string;

  @ApiPropertyOptional({ description: 'Billing interval', enum: ['month', 'year'] })
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
  [SubscriptionPlanTier.FREE]: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      portals: 1,
      widgets: 5,
      integrations: 2,
      users: 1,
      storage: 1,
      apiCalls: 1000,
      scheduledReports: 0,
      customBranding: false,
      prioritySupport: false,
      sso: false,
      advancedAnalytics: false,
      auditLogs: false,
      customDomain: false,
    },
  },
  [SubscriptionPlanTier.STARTER]: {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams and projects',
    monthlyPrice: 29,
    yearlyPrice: 290, // ~17% discount
    features: {
      portals: 5,
      widgets: 25,
      integrations: 5,
      users: 3,
      storage: 10,
      apiCalls: 10000,
      scheduledReports: 5,
      customBranding: true,
      prioritySupport: false,
      sso: false,
      advancedAnalytics: false,
      auditLogs: false,
      customDomain: false,
    },
    popular: false,
  },
  [SubscriptionPlanTier.PROFESSIONAL]: {
    id: 'professional',
    name: 'Professional',
    description: 'For growing businesses',
    monthlyPrice: 79,
    yearlyPrice: 790, // ~17% discount
    features: {
      portals: 20,
      widgets: 100,
      integrations: 15,
      users: 10,
      storage: 50,
      apiCalls: 50000,
      scheduledReports: 25,
      customBranding: true,
      prioritySupport: true,
      sso: false,
      advancedAnalytics: true,
      auditLogs: true,
      customDomain: true,
    },
    popular: true,
  },
  [SubscriptionPlanTier.ENTERPRISE]: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: 199,
    yearlyPrice: 1990, // ~17% discount
    features: {
      portals: -1, // unlimited
      widgets: -1,
      integrations: -1,
      users: -1,
      storage: 500,
      apiCalls: -1,
      scheduledReports: -1,
      customBranding: true,
      prioritySupport: true,
      sso: true,
      advancedAnalytics: true,
      auditLogs: true,
      customDomain: true,
    },
  },
};
