import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationModule } from '../integrations/integration.module';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AnalyticsModule } from '../analytics/analytics.module';

import { ShareLinksController } from './share-links.controller';
import { ShareLinksService } from './share-links.service';

@Module({
  imports: [PrismaModule, IntegrationModule, AnalyticsModule],
  controllers: [ShareLinksController],
  providers: [ShareLinksService, OptionalJwtAuthGuard],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
