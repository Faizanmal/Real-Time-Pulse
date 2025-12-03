import { Module } from '@nestjs/common';
import { MLMarketplaceService } from './ml-marketplace.service';
import { MLMarketplaceController } from './ml-marketplace.controller';
import { MLModelExecutorService } from './ml-model-executor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [MLMarketplaceController],
  providers: [MLMarketplaceService, MLModelExecutorService],
  exports: [MLMarketplaceService, MLModelExecutorService],
})
export class MLMarketplaceModule {}
