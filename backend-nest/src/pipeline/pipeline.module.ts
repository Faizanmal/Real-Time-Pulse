import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';
import { PipelineExecutorService } from './pipeline-executor.service';
import { PipelineConnectorService } from './pipeline-connector.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule, ScheduleModule.forRoot()],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineExecutorService, PipelineConnectorService],
  exports: [PipelineService, PipelineExecutorService],
})
export class PipelineModule {}
