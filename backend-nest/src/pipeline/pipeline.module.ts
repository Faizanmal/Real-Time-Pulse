import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { PipelineConnectorService } from './pipeline-connector.service';
import { PipelineExecutorService } from './pipeline-executor.service';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [PrismaModule, CacheModule, ScheduleModule.forRoot()],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineExecutorService, PipelineConnectorService],
  exports: [PipelineService, PipelineExecutorService],
})
export class PipelineModule {}
