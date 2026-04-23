import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ARSceneService } from './ar-scene.service';
import { ARVisualizationController } from './ar-visualization.controller';
import { ARVisualizationService } from './ar-visualization.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ARVisualizationController],
  providers: [ARVisualizationService, ARSceneService],
  exports: [ARVisualizationService, ARSceneService],
})
export class ARVisualizationModule {}
