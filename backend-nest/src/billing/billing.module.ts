import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { BillingRoleGuard } from './billing-role.guard';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AiUsageLimitGuard } from './ai-usage-limit.guard';

@Module({
  imports: [PrismaModule, ConfigModule, AnalyticsModule],
  controllers: [BillingController],
  providers: [BillingService, AgencyRoleGuard, BillingRoleGuard, AiUsageLimitGuard],
  exports: [BillingService, AiUsageLimitGuard],
})
export class BillingModule {}
