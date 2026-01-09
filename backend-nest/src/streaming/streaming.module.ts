import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StreamProcessingService } from './stream-processing.service';
import { CEPEngineService } from './cep-engine.service';
import { StreamingController } from './streaming.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [StreamingController],
  providers: [StreamProcessingService, CEPEngineService],
  exports: [StreamProcessingService, CEPEngineService],
})
export class StreamingModule {}
