import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ETLController } from './etl.controller';
import { ETLPipelineService } from './etl-pipeline.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), EventEmitterModule.forRoot()],
  controllers: [ETLController],
  providers: [ETLPipelineService],
  exports: [ETLPipelineService],
})
export class ETLModule {}
