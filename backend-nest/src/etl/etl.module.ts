import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';

import { ETLPipelineService } from './etl-pipeline.service';
import { ETLController } from './etl.controller';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), EventEmitterModule.forRoot()],
  controllers: [ETLController],
  providers: [ETLPipelineService],
  exports: [ETLPipelineService],
})
export class ETLModule {}
