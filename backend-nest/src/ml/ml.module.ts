import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from '../prisma/prisma.module';

import { CausalInferenceService } from './causal-inference.service';
import { MLModelService } from './ml-model.service';
import { MLController } from './ml.controller';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [MLController],
  providers: [MLModelService, CausalInferenceService],
  exports: [MLModelService, CausalInferenceService],
})
export class MLModule {}
