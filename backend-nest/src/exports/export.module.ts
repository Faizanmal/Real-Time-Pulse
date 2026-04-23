import { Module } from '@nestjs/common';

import { PortalModule } from '../portals/portal.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WidgetModule } from '../widgets/widget.module';

import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [PrismaModule, PortalModule, WidgetModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
