import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { VoiceCommandService } from './voice-command.service';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceCommandService],
  exports: [VoiceService, VoiceCommandService],
})
export class VoiceModule {}
