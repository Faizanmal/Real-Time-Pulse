import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module';

import { CEPEngineService } from './cep-engine.service';
import { StreamProcessingService } from './stream-processing.service';
import { StreamingController } from './streaming.controller';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [StreamingController],
  providers: [StreamProcessingService, CEPEngineService],
  exports: [StreamProcessingService, CEPEngineService],
})
export class StreamingModule {}
