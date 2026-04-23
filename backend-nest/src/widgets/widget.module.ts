import { Module, forwardRef } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { IntegrationModule } from '../integrations/integration.module';
import { PrismaModule } from '../prisma/prisma.module';

import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

@Module({
  imports: [PrismaModule, CacheModule, forwardRef(() => IntegrationModule)],
  controllers: [WidgetController],
  providers: [WidgetService],
  exports: [WidgetService],
})
export class WidgetModule {}
