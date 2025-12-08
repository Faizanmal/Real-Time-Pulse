import { Module } from '@nestjs/common';
import { VoiceControlService } from './voice-control.service';
import { VoiceControlController } from './voice-control.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VoiceControlController],
  providers: [VoiceControlService],
  exports: [VoiceControlService],
})
export class VoiceControlModule {}
