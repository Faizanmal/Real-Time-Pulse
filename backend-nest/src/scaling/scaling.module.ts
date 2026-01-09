import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MultiRegionService } from './multi-region.service';
import { HorizontalScalingService } from './horizontal-scaling.service';
import { ScalingController } from './scaling.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [ScalingController],
  providers: [MultiRegionService, HorizontalScalingService],
  exports: [MultiRegionService, HorizontalScalingService],
})
export class ScalingModule {}
