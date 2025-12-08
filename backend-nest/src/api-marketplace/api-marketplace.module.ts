import { Module } from '@nestjs/common';
import { ApiMarketplaceService } from './api-marketplace.service';
import { ApiMarketplaceController } from './api-marketplace.controller';
import { CustomEndpointService } from './custom-endpoint.service';
import { EndpointBuilderService } from './endpoint-builder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ApiMarketplaceController],
  providers: [
    ApiMarketplaceService,
    CustomEndpointService,
    EndpointBuilderService,
  ],
  exports: [
    ApiMarketplaceService,
    CustomEndpointService,
    EndpointBuilderService,
  ],
})
export class ApiMarketplaceModule {}
