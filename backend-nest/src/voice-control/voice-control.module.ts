import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { VoiceControlController } from './voice-control.controller';
import { VoiceControlService } from './voice-control.service';

@Module({
  imports: [PrismaModule],
  controllers: [VoiceControlController],
  providers: [VoiceControlService],
  exports: [VoiceControlService],
})
export class VoiceControlModule {}
