import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { MLMarketplaceController } from './ml-marketplace.controller';
import { MLMarketplaceService } from './ml-marketplace.service';
import { MLModelExecutorService } from './ml-model-executor.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [MLMarketplaceController],
  providers: [MLMarketplaceService, MLModelExecutorService],
  exports: [MLMarketplaceService, MLModelExecutorService],
})
export class MLMarketplaceModule {}
