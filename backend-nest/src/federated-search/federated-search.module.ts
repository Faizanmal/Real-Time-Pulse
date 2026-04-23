import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { FederatedSearchController } from './federated-search.controller';
import { FederatedSearchService } from './federated-search.service';
import { SemanticSearchService } from './semantic-search.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [FederatedSearchController],
  providers: [FederatedSearchService, SemanticSearchService],
  exports: [FederatedSearchService, SemanticSearchService],
})
export class FederatedSearchModule {}
