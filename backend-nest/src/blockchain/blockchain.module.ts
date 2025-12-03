import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { MerkleTreeService } from './merkle-tree.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [BlockchainController],
  providers: [BlockchainService, MerkleTreeService],
  exports: [BlockchainService, MerkleTreeService],
})
export class BlockchainModule {}
