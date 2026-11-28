import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { PrismaModule } from '../prisma/prisma.module';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MetricProvenanceService } from './metric-provenance.service';
import { OnboardingFunnelController } from './onboarding-funnel.controller';
import { OnboardingFunnelService } from './onboarding-funnel.service';
import { ProductAnalyticsService } from './product-analytics.service';
import { ValueLedgerService } from './value-ledger.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AnalyticsController, OnboardingFunnelController],
  providers: [
    AnalyticsService,
    MetricProvenanceService,
    ValueLedgerService,
    OnboardingFunnelService,
    ProductAnalyticsService,
    AgencyRoleGuard,
  ],
  exports: [
    AnalyticsService,
    MetricProvenanceService,
    ValueLedgerService,
    OnboardingFunnelService,
    ProductAnalyticsService,
  ],
})
export class AnalyticsModule {}
