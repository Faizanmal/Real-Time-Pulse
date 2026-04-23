import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ApiMarketplaceController } from './api-marketplace.controller';
import { ApiMarketplaceService } from './api-marketplace.service';
import { CustomEndpointService } from './custom-endpoint.service';
import { EndpointBuilderService } from './endpoint-builder.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ApiMarketplaceController],
  providers: [ApiMarketplaceService, CustomEndpointService, EndpointBuilderService],
  exports: [ApiMarketplaceService, CustomEndpointService, EndpointBuilderService],
})
export class ApiMarketplaceModule {}
