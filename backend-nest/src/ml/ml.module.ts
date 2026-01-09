import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MLModelService } from './ml-model.service';
import { CausalInferenceService } from './causal-inference.service';
import { MLController } from './ml.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [MLController],
  providers: [MLModelService, CausalInferenceService],
  exports: [MLModelService, CausalInferenceService],
})
export class MLModule {}
