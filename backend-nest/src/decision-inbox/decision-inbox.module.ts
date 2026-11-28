import { Module } from '@nestjs/common';

import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ShareLinksModule } from '../share-links/share-links.module';
import { AnalyticsModule } from '../analytics/analytics.module';

import { ClientDecisionController, DecisionInboxController } from './decision-inbox.controller';
import { DecisionInboxService } from './decision-inbox.service';

@Module({
  imports: [PrismaModule, ShareLinksModule, AnalyticsModule],
  controllers: [DecisionInboxController, ClientDecisionController],
  providers: [DecisionInboxService, AgencyRoleGuard, OptionalJwtAuthGuard],
  exports: [DecisionInboxService],
})
export class DecisionInboxModule {}
