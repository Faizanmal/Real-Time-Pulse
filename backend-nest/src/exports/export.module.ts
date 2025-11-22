import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PortalModule } from '../portals/portal.module';
import { WidgetModule } from '../widgets/widget.module';

@Module({
  imports: [PrismaModule, PortalModule, WidgetModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
