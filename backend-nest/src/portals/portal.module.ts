import { Module } from '@nestjs/common';

import { IntegrationModule } from '../integrations/integration.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';

import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [PrismaModule, IntegrationModule, CacheModule, NotificationsModule, RealtimeModule, AnalyticsModule, AuditModule],
  controllers: [PortalController],
  providers: [PortalService, AgencyRoleGuard],
  exports: [PortalService],
})
export class PortalModule {}
