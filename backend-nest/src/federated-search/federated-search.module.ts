import { Module } from '@nestjs/common';
import { FederatedSearchService } from './federated-search.service';
import { FederatedSearchController } from './federated-search.controller';
import { SemanticSearchService } from './semantic-search.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [FederatedSearchController],
  providers: [FederatedSearchService, SemanticSearchService],
  exports: [FederatedSearchService, SemanticSearchService],
})
export class FederatedSearchModule {}
