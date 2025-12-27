import { Module, forwardRef } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { IntegrationModule } from '../integrations/integration.module';

@Module({
  imports: [PrismaModule, CacheModule, forwardRef(() => IntegrationModule)],
  controllers: [WidgetController],
  providers: [WidgetService],
  exports: [WidgetService],
})
export class WidgetModule {}
