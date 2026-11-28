import { Module } from '@nestjs/common';

import { PortalModule } from '../portals/portal.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WidgetModule } from '../widgets/widget.module';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { AnalyticsModule } from '../analytics/analytics.module';

import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [PrismaModule, PortalModule, WidgetModule, AnalyticsModule],
  controllers: [ExportController],
  providers: [ExportService, AgencyRoleGuard],
  exports: [ExportService],
})
export class ExportModule {}
