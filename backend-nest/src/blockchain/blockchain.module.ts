import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { MerkleTreeService } from './merkle-tree.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [BlockchainController],
  providers: [BlockchainService, MerkleTreeService],
  exports: [BlockchainService, MerkleTreeService],
})
export class BlockchainModule {}
