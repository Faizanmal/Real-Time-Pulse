import { Module } from '@nestjs/common';
import { ARVisualizationService } from './ar-visualization.service';
import { ARVisualizationController } from './ar-visualization.controller';
import { ARSceneService } from './ar-scene.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ARVisualizationController],
  providers: [ARVisualizationService, ARSceneService],
  exports: [ARVisualizationService, ARSceneService],
})
export class ARVisualizationModule {}
