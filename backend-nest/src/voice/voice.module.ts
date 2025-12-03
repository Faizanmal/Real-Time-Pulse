import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { VoiceCommandService } from './voice-command.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceCommandService],
  exports: [VoiceService, VoiceCommandService],
})
export class VoiceModule {}
